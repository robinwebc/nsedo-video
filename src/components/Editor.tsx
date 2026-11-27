import { useEffect, useMemo, useRef, useState } from "react";
import { applyOps } from "../core/apply";
import { planCommand, type PlanOutcome } from "../core/agent";
import { historyCommit, historyInit, historyRedo, historyUndo, type HistoryState } from "../core/history";
import { createId } from "../core/ids";
import { suggestCommands } from "../core/suggestions";
import { keepsToCutOps, invertRanges, planHighlight, safeSilenceCuts } from "../core/silence";
import { cuesToSrt, parseSrt } from "../core/srt";
import { timelineDuration } from "../core/time";
import type { EditOp, Project, Quality } from "../core/types";
import { idbDelete, idbGet, idbPut } from "../lib/db";
import { loadProject, saveProject } from "../lib/library";
import { downloadBytes, downloadText, fileTitle, readVideoMeta } from "../lib/media";
import { detectSilence, exportProject, ProcessError, transcribeProject, type ProgressInfo } from "../lib/process";
import { loadSettings, saveSettings } from "../lib/settingsStore";
import { usePrefs } from "../ui/prefs";
import { CommandBar } from "./CommandBar";
import { ExportDialog, SettingsDialog } from "./Dialogs";
import { IconExport, IconMoon, IconPlus, IconRedo, IconSettings, IconSun, IconUndo, Mark } from "./Icons";
import { Inspector } from "./Inspector";
import { Preview } from "./Preview";
import { Timeline } from "./Timeline";

type Tool = "clip" | "look" | "text" | "audio";

export function EditorScreen({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  const { t, lang, theme, setLang, setTheme } = usePrefs();
  const initial = loadProject(projectId);
  const [history, setHistory] = useState<HistoryState<Project> | null>(initial ? historyInit(initial) : null);
  const [gesture, setGesture] = useState<Project | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.clips[0]?.id ?? null);
  const [command, setCommand] = useState("");
  const [plan, setPlan] = useState<PlanOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("clip");
  const [sheet, setSheet] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportLog, setExportLog] = useState("");
  const [exportBytes, setExportBytes] = useState<Uint8Array | null>(null);
  const [exportName, setExportName] = useState<string | null>(null);
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const files = useRef(new Map<string, Blob>());
  const videoInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const project = history?.present ?? null;

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const ids = [...project.clips.map((clip) => clip.sourceId), project.music?.sourceId].filter((id): id is string => Boolean(id));
    void (async () => {
      for (const id of ids) {
        if (files.current.has(id) || cancelled) continue;
        const blob = await idbGet(id);
        if (!blob || cancelled) continue;
        files.current.set(id, blob);
        const url = URL.createObjectURL(blob);
        setUrls((current) => ({ ...current, [id]: url }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  useEffect(() => {
    if (project) saveProject(project);
  }, [project]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory((current) => (current ? (event.shiftKey ? historyRedo(current) : historyUndo(current)) : current));
        return;
      }
      if (typing) return;
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "s" && project) {
        splitAtPlayhead();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedId && project) {
        commit(applyOps(project, [{ op: "deleteClip", clipId: selectedId }]).project);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const suggestions = useMemo(() => (project ? suggestCommands(project, lang) : []), [project, lang]);

  function commit(next: Project) {
    setHistory((current) => (current ? historyCommit(current, next) : historyInit(next)));
    setGesture(null);
  }

  function beginGesture() {
    if (project) setGesture(project);
  }

  function previewProject(next: Project) {
    setHistory((current) => (current ? { ...current, present: next } : current));
  }

  function endGesture() {
    setHistory((current) => {
      if (!current || !gesture) return current;
      return historyCommit({ ...current, present: gesture }, current.present);
    });
    setGesture(null);
  }

  async function addVideo(file: File) {
    if (!project) return;
    const sourceId = createId();
    const meta = await readVideoMeta(file).catch(() => ({ duration: 0, width: 0, height: 0 }));
    await idbPut(sourceId, file).catch(() => undefined);
    files.current.set(sourceId, file);
    const url = URL.createObjectURL(file);
    setUrls((current) => ({ ...current, [sourceId]: url }));
    const clip = {
      id: createId(),
      name: fileTitle(file.name),
      sourceId,
      duration: meta.duration,
      inPoint: 0,
      outPoint: meta.duration,
      speed: 1,
      volume: 1,
      muted: false,
      rotate: 0 as const,
      width: meta.width,
      height: meta.height,
    };
    const next = { ...project, name: project.clips.length === 0 ? fileTitle(file.name) : project.name, clips: [...project.clips, clip] };
    commit(next);
    setSelectedId(clip.id);
  }

  async function addMusic(file: File) {
    if (!project) return;
    const sourceId = createId();
    await idbPut(sourceId, file).catch(() => undefined);
    files.current.set(sourceId, file);
    const pending = project.musicPending ?? project.music ?? { volume: 0.35, fadeIn: 0.8, fadeOut: 1.4 };
    commit({
      ...project,
      musicPending: null,
      music: { sourceId, name: file.name, volume: pending.volume, fadeIn: pending.fadeIn, fadeOut: pending.fadeOut },
    });
  }

  function splitAtPlayhead() {
    if (!project) return;
    const next = applyOps(project, [{ op: "split", at: playhead }]).project;
    commit(next);
  }

  function moveSelected(direction: -1 | 1) {
    if (!project || !selectedId) return;
    const ids = project.clips.map((clip) => clip.id);
    const index = ids.indexOf(selectedId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    commit(applyOps(project, [{ op: "reorder", clipIds: ids }]).project);
  }

  async function makePlan(text: string) {
    if (!project || !text.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await planCommand(text.trim(), project, loadSettings());
      setPlan(next);
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan(ops: EditOp[]) {
    if (!project) return;
    setBusy(true);
    setNotice(null);
    let current = project;
    const notes: string[] = [];
    let askMusic = false;
    try {
      for (const op of ops) {
        if (op.op === "removeSilence" || op.op === "highlight") {
          try {
            const ranges = await detectSilence(current, files.current, op.op === "removeSilence" ? (op.thresholdDb ?? -35) : -32, op.op === "removeSilence" ? (op.minDuration ?? 0.4) : 0.3, setProgress);
            const duration = timelineDuration(current.clips);
            const cuts =
              op.op === "removeSilence"
                ? safeSilenceCuts(ranges, duration)
                : keepsToCutOps(planHighlight(invertRanges(duration, ranges, 0.2), duration, op.targetDuration ?? 15), duration);
            if (cuts.length === 0) notes.push(t("analysisEmpty"));
            current = applyOps(current, cuts).project;
          } catch (error) {
            notes.push(t("analysisFailed"));
            if (error instanceof ProcessError) setExportLog(error.log);
          }
        } else if (op.op === "captions") {
          current = applyOps(current, [op]).project;
          const settings = loadSettings();
          if (!settings.whisperApiKey.trim()) notes.push(t("needKey"));
          else {
            try {
              const cues = await transcribeProject(current, files.current, settings, op.language ?? lang);
              current = { ...current, captions: cues, captionLanguage: op.language ?? lang };
            } catch {
              notes.push(t("whisperFailed"));
            }
          }
        } else {
          current = applyOps(current, [op]).project;
          if (op.op === "music" && !current.music) askMusic = true;
        }
      }
      commit(current);
      setPlan(null);
      setNotice([t("applied"), ...notes].filter(Boolean).join(" · "));
      if (askMusic) musicInput.current?.click();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function runExport() {
    if (!project) return;
    setExportError(null);
    setExportLog("");
    setExportBytes(null);
    setExportName(null);
    setSavedUri(null);
    setBusy(true);
    try {
      const result = await exportProject({ project, files: files.current, onProgress: setProgress });
      setExportBytes(result.bytes);
      setExportName(result.filename);
      setSavedUri(result.savedUri);
    } catch (error) {
      setExportError(t("exportFailed"));
      if (error instanceof ProcessError) setExportLog(error.log);
      else if (error instanceof Error) setExportLog(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!project || !history) {
    return (
      <div className="home">
        <p className="lede">{t("emptyTitle")}</p>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="editor">
      <header className="topbar">
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t("back")}
        </button>
        <div className="brand brand-compact">
          <Mark size={28} />
          <input
            className="name-input"
            aria-label={t("name")}
            value={project.name}
            onChange={(event) => commit({ ...project, name: event.target.value })}
          />
        </div>
        <div className="top-actions">
          <button type="button" className="icon-button" aria-label={t("undo")} disabled={history.past.length === 0} onClick={() => setHistory(historyUndo(history))}>
            <IconUndo />
          </button>
          <button type="button" className="icon-button" aria-label={t("redo")} disabled={history.future.length === 0} onClick={() => setHistory(historyRedo(history))}>
            <IconRedo />
          </button>
          <div className="seg" role="group" aria-label={t("language")}>
            <button type="button" className={lang === "bn" ? "is-on" : ""} onClick={() => setLang("bn")}>
              বাং
            </button>
            <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
              EN
            </button>
          </div>
          <button type="button" className="icon-button" aria-label={theme === "dark" ? t("themeLight") : t("themeDark")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button type="button" className="icon-button" aria-label={t("settings")} onClick={() => setSettingsOpen(true)}>
            <IconSettings />
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setExportOpen(true)}>
            <IconExport />
            <span>{t("export")}</span>
          </button>
        </div>
      </header>
      <div className="stage">
        <Preview
          project={project}
          urls={urls}
          playhead={playhead}
          playing={playing}
          setPlayhead={setPlayhead}
          setPlaying={setPlaying}
          onFile={(file) => void addVideo(file)}
        />
        <CommandBar
          value={command}
          onChange={setCommand}
          busy={busy}
          suggestions={suggestions}
          onPlan={() => void makePlan(command)}
          onSuggest={(text) => {
            setCommand(text);
            void makePlan(text);
          }}
          plan={plan}
          onPlanChange={(ops) => setPlan((current) => (current ? { ...current, ops } : current))}
          onApply={() => plan && void applyPlan(plan.ops)}
          onDismiss={() => setPlan(null)}
          notice={notice}
        />
      </div>
      <Inspector
        project={project}
        tool={tool}
        setTool={(next) => {
          setTool(next);
          setSheet(true);
        }}
        open={sheet}
        onClose={() => setSheet(false)}
        selectedId={selectedId}
        onChange={commit}
        onSplit={splitAtPlayhead}
        onDelete={() => {
          if (!selectedId) return;
          commit(applyOps(project, [{ op: "deleteClip", clipId: selectedId }]).project);
          setSelectedId(null);
        }}
        onMove={moveSelected}
        onAddText={() => {
          const duration = timelineDuration(project.clips);
          commit(
            applyOps(project, [{ op: "text", text: lang === "bn" ? "শিরোনাম" : "Title", start: 0, end: duration > 0 ? Math.min(3, duration) : 3 }]).project,
          );
        }}
        onPickMusic={() => musicInput.current?.click()}
        onImportSrt={(file) => {
          void file.text().then((text) => commit({ ...project, captions: parseSrt(text) }));
        }}
        onExportSrt={() => downloadText(cuesToSrt(project.captions), `${project.name}.srt`, "application/x-subrip")}
        onCaptions={() => void applyPlan([{ op: "captions", language: lang, burnIn: project.captionsBurnIn }])}
      />
      <Timeline
        project={project}
        playhead={playhead}
        playing={playing}
        selectedId={selectedId}
        onSeek={(time) => {
          setPlaying(false);
          setPlayhead(time);
        }}
        onToggle={() => setPlaying((value) => !value)}
        onSelect={setSelectedId}
        beginGesture={beginGesture}
        preview={previewProject}
        endGesture={endGesture}
      />
      <div className="toolbar">
        <button type="button" onClick={() => videoInput.current?.click()}>
          <IconPlus />
          {t("addClip")}
        </button>
        <button type="button" onClick={() => { setTool("clip"); setSheet(true); }}>
          {t("clips")}
        </button>
        <button type="button" onClick={() => { setTool("look"); setSheet(true); }}>
          {t("look")}
        </button>
        <button type="button" onClick={() => { setTool("text"); setSheet(true); }}>
          {t("text")}
        </button>
        <button type="button" onClick={() => { setTool("audio"); setSheet(true); }}>
          {t("audio")}
        </button>
      </div>
      <input
        ref={videoInput}
        hidden
        type="file"
        accept="video/*,.mp4,.webm,.mov,.mkv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void addVideo(file);
          event.target.value = "";
        }}
      />
      <input
        ref={musicInput}
        hidden
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void addMusic(file);
          event.target.value = "";
        }}
      />
      {settingsOpen ? (
        <SettingsDialog
          initial={loadSettings()}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {exportOpen ? (
        <ExportDialog
          quality={project.quality}
          onQuality={(quality: Quality) => commit({ ...project, quality })}
          busy={busy}
          progress={progress}
          error={exportError}
          log={exportLog}
          resultName={exportName}
          savedUri={savedUri}
          onStart={() => void runExport()}
          onDownload={() => {
            if (exportBytes && exportName) downloadBytes(exportBytes, exportName, "video/mp4");
          }}
          onClose={() => {
            if (!busy) setExportOpen(false);
          }}
        />
      ) : null}
      <button type="button" className="add-fab" onClick={() => videoInput.current?.click()}>
        <IconPlus />
        <span>{t("addClip")}</span>
      </button>
    </div>
  );
}

export async function createProjectFromFile(file: File): Promise<string> {
  const { createProject, createClip } = await import("../core/project");
  const meta = await readVideoMeta(file).catch(() => ({ duration: 0, width: 0, height: 0 }));
  const sourceId = createId();
  await idbPut(sourceId, file).catch(() => undefined);
  const project = createProject(fileTitle(file.name));
  project.clips = [createClip({ name: fileTitle(file.name), sourceId, duration: meta.duration, width: meta.width, height: meta.height })];
  saveProject(project);
  return project.id;
}

export async function removeProject(id: string): Promise<void> {
  const project = loadProject(id);
  if (project) {
    const ids = [...project.clips.map((clip) => clip.sourceId), project.music?.sourceId].filter((item): item is string => Boolean(item));
    await Promise.all(ids.map((item) => idbDelete(item).catch(() => undefined)));
  }
  const { deleteStoredProject } = await import("../lib/library");
  deleteStoredProject(id);
}
