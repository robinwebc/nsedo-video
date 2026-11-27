import { endpointAllowed, type AiSettings } from "../core/agent";
import {
  audioExtractArgs,
  chooseEncoder,
  clipRenderArgs,
  concatArgs,
  encoderArgs,
  frameSize,
  musicFilter,
  parseEncoderList,
  silenceDetectArgs,
  silentClipArgs,
} from "../core/exportPlan";
import { parseSrt } from "../core/srt";
import { offsetSilence, parseSilenceLog } from "../core/silence";
import { clipTimelineDuration, timelineDuration } from "../core/time";
import type { CaptionCue, Lang, Project, TextOverlay } from "../core/types";
import { createId } from "../core/ids";
import { blobBytes, getEngine, type FfmpegEngine } from "./engine";
import { renderOverlayPng } from "./overlay";

export class ProcessError extends Error {
  log: string;
  constructor(message: string, log = "") {
    super(message);
    this.name = "ProcessError";
    this.log = log;
  }
}

export type ProgressPhase = "load" | "clip" | "join" | "finish" | "save";

export interface ProgressInfo {
  ratio: number;
  phase: ProgressPhase;
  index?: number;
  total?: number;
}

async function runChecked(engine: FfmpegEngine, args: string[], onProgress?: (ratio: number) => void): Promise<string> {
  const result = await engine.run(args, onProgress);
  if (result.code !== 0) throw new ProcessError("ffmpeg failed", result.log);
  return result.log;
}

export async function detectSilence(
  project: Project,
  files: Map<string, Blob>,
  thresholdDb: number,
  minDuration: number,
  onProgress?: (info: ProgressInfo) => void,
): Promise<ReturnType<typeof parseSilenceLog>> {
  onProgress?.({ ratio: 0.02, phase: "load" });
  const engine = getEngine();
  const ranges: ReturnType<typeof parseSilenceLog> = [];
  let cursor = 0;
  for (let index = 0; index < project.clips.length; index += 1) {
    const clip = project.clips[index];
    const blob = files.get(clip.sourceId);
    const length = clipTimelineDuration(clip);
    if (!blob) {
      cursor += length;
      continue;
    }
    onProgress?.({ ratio: index / Math.max(1, project.clips.length), phase: "clip", index, total: project.clips.length });
    const input = await engine.put(`silence-${clip.id}.bin`, await blobBytes(blob));
    const result = await engine.run(silenceDetectArgs(input, clip.inPoint, clip.outPoint, thresholdDb, minDuration));
    const local = parseSilenceLog(result.log, Math.max(0, clip.outPoint - clip.inPoint));
    ranges.push(...offsetSilence(local, cursor, clip.speed));
    await engine.remove(`silence-${clip.id}.bin`);
    cursor += length;
  }
  return ranges;
}

async function probeEncoder(engine: FfmpegEngine) {
  const log = await engine.encoders();
  return chooseEncoder(parseEncoderList(log));
}

export async function exportProject(options: {
  project: Project;
  files: Map<string, Blob>;
  onProgress?: (info: ProgressInfo) => void;
}): Promise<{ bytes: Uint8Array; filename: string; savedUri: string | null; encoder: string }> {
  const { project, files, onProgress } = options;
  if (project.clips.length === 0) throw new ProcessError("empty");
  onProgress?.({ ratio: 0.01, phase: "load" });
  const engine = getEngine();
  const encoder = await probeEncoder(engine);
  const size = frameSize(project);
  const rendered: string[] = [];
  for (let index = 0; index < project.clips.length; index += 1) {
    const clip = project.clips[index];
    const blob = files.get(clip.sourceId);
    if (!blob) throw new ProcessError("missing-file");
    onProgress?.({ ratio: 0.05 + (0.55 * index) / project.clips.length, phase: "clip", index, total: project.clips.length });
    const input = await engine.put(`in-${index}.mp4`, await blobBytes(blob));
    const output = `clip-${index}.mp4`;
    const outPath = await engine.path(output);
    const primary = clipRenderArgs(input, outPath, clip, project, size, encoder);
    try {
      await runChecked(engine, primary, (ratio) => {
        onProgress?.({
          ratio: 0.05 + (0.55 * (index + ratio)) / project.clips.length,
          phase: "clip",
          index,
          total: project.clips.length,
        });
      });
    } catch (error) {
      const fallback = silentClipArgs(input, outPath, clip, project, size, encoder);
      try {
        await runChecked(engine, fallback);
      } catch (inner) {
        const log = inner instanceof ProcessError ? inner.log : error instanceof ProcessError ? error.log : "";
        throw new ProcessError("clip", log);
      }
    }
    rendered.push(outPath);
    await engine.remove(`in-${index}.mp4`);
  }

  let current = rendered[0];
  if (rendered.length > 1) {
    onProgress?.({ ratio: 0.66, phase: "join" });
    const joined = await engine.path("joined.mp4");
    await runChecked(engine, concatArgs(rendered, joined, encoder, project.quality));
    for (const file of rendered) await engine.remove(file.split("/").pop() ?? file);
    current = joined;
  }

  const plates: { file: string; overlay: TextOverlay | CaptionCue }[] = [];
  const burnCaptions = project.captionsBurnIn ? project.captions : [];
  const layers = [
    ...project.texts.map((text) => ({ ...text, size: text.size })),
    ...burnCaptions.map((cue) => ({ ...cue, position: "bottom" as const, size: "sm" as const })),
  ];
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    const png = await renderOverlayPng({
      width: size.width,
      height: size.height,
      text: layer.text,
      position: layer.position,
      size: layer.size,
    });
    const name = `plate-${index}.png`;
    plates.push({ file: await engine.put(name, png), overlay: layer });
  }

  const musicBlob = project.music ? files.get(project.music.sourceId) : undefined;
  const needsFinish = plates.length > 0 || Boolean(musicBlob && project.music);
  let finalName = current.split("/").pop() ?? current;
  if (needsFinish) {
    onProgress?.({ ratio: 0.8, phase: "finish" });
    const musicPath = musicBlob && project.music ? await engine.put("music.bin", await blobBytes(musicBlob)) : null;
    const args = ["-i", current];
    plates.forEach((plate) => args.push("-i", plate.file));
    if (musicPath) args.push("-i", musicPath);
    const chains: string[] = [];
    let label = "[0:v]";
    plates.forEach((plate, index) => {
      const out = index === plates.length - 1 ? "[v]" : `[v${index}]`;
      chains.push(
        `${label}[${index + 1}:v]overlay=0:0:enable='between(t,${plate.overlay.start.toFixed(3)},${plate.overlay.end.toFixed(3)})'${out}`,
      );
      label = out;
    });
    if (plates.length === 0) chains.push("[0:v]null[v]");
    if (musicPath && project.music) {
      const musicIndex = plates.length + 1;
      chains.push(musicFilter(timelineDuration(project.clips), project.music, `[${musicIndex}:a]`, "[0:a]"));
    } else chains.push("[0:a]anull[a]");
    const output = await engine.path("final.mp4");
    args.push(
      "-filter_complex",
      chains.join(";"),
      "-map",
      "[v]",
      "-map",
      "[a]",
      ...encoderArgs(encoder, project.quality),
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      output,
    );
    await runChecked(engine, args);
    finalName = "final.mp4";
  }

  onProgress?.({ ratio: 0.94, phase: "save" });
  const bytes = await engine.read(finalName);
  const filename = `${project.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "nsedo"}-${project.quality}.mp4`;
  let savedUri: string | null = null;
  if (engine.kind === "native") {
    savedUri = await engine.saveVideo(finalName, filename);
  }
  onProgress?.({ ratio: 1, phase: "save" });
  return { bytes, filename, savedUri, encoder };
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
}

export async function transcribeProject(
  project: Project,
  files: Map<string, Blob>,
  settings: AiSettings,
  language: Lang,
): Promise<CaptionCue[]> {
  if (!settings.whisperApiKey.trim()) throw new ProcessError("whisper-key");
  if (!endpointAllowed(settings.whisperBaseUrl)) throw new ProcessError("endpoint");
  const engine = getEngine();
  const cues: CaptionCue[] = [];
  let cursor = 0;
  for (const clip of project.clips) {
    const blob = files.get(clip.sourceId);
    const length = clipTimelineDuration(clip);
    if (!blob) {
      cursor += length;
      continue;
    }
    const input = await engine.put(`cap-${clip.id}.mp4`, await blobBytes(blob));
    const wav = await engine.path(`cap-${clip.id}.wav`);
    await runChecked(engine, [
      "-ss",
      String(clip.inPoint),
      "-to",
      String(clip.outPoint),
      "-i",
      input,
      ...audioExtractArgs(input, wav).slice(2),
    ]);
    const audio = await engine.read(`cap-${clip.id}.wav`);
    await engine.remove(`cap-${clip.id}.mp4`);
    await engine.remove(`cap-${clip.id}.wav`);
    const local = await transcribeWav(audio, settings, language);
    const speed = clip.speed || 1;
    for (const cue of local) {
      cues.push({
        ...cue,
        id: createId(),
        start: cursor + cue.start / speed,
        end: cursor + cue.end / speed,
      });
    }
    cursor += length;
  }
  return cues;
}

async function transcribeWav(audio: Uint8Array, settings: AiSettings, language: Lang): Promise<CaptionCue[]> {
  const base = settings.whisperBaseUrl.replace(/\/$/, "");
  const body = new FormData();
  const copy = new Uint8Array(audio.byteLength);
  copy.set(audio);
  body.append("file", new Blob([copy], { type: "audio/wav" }), "speech.wav");
  body.append("model", settings.whisperModel || "whisper-1");
  body.append("response_format", "verbose_json");
  body.append("language", language === "bn" ? "bn" : "en");
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.whisperApiKey}` },
    body,
  });
  if (!response.ok) throw new ProcessError(`whisper ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/plain") || contentType.includes("application/x-subrip")) {
    return parseSrt(await response.text());
  }
  const payload = (await response.json()) as { text?: string; segments?: WhisperSegment[] };
  if (Array.isArray(payload.segments) && payload.segments.length > 0) {
    return payload.segments
      .map((segment) => ({
        id: createId(),
        start: segment.start ?? 0,
        end: segment.end ?? (segment.start ?? 0) + 1,
        text: (segment.text ?? "").trim(),
      }))
      .filter((cue) => cue.text && cue.end > cue.start);
  }
  if (payload.text?.trim()) {
    return [{ id: createId(), start: 0, end: 4, text: payload.text.trim() }];
  }
  return [];
}
