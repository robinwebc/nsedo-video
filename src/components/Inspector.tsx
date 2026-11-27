import { FILTERS, updateClip } from "../core/apply";
import { filterLabel } from "../core/describe";
import type { Aspect, FilterName, Project, Rotate, TextPosition } from "../core/types";
import { usePrefs } from "../ui/prefs";

type Tool = "clip" | "look" | "text" | "audio";

interface InspectorProps {
  project: Project;
  tool: Tool;
  setTool: (tool: Tool) => void;
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onChange: (project: Project) => void;
  onSplit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddText: () => void;
  onPickMusic: () => void;
  onImportSrt: (file: File) => void;
  onExportSrt: () => void;
  onCaptions: () => void;
}

const ASPECTS: Aspect[] = ["original", "16:9", "9:16", "1:1"];
const ROTATIONS: Rotate[] = [0, 90, 180, 270];

export function Inspector(props: InspectorProps) {
  const { t, lang } = usePrefs();
  const clip = props.project.clips.find((item) => item.id === props.selectedId) ?? null;
  const aspectLabel = (aspect: Aspect) =>
    aspect === "original" ? t("original") : aspect === "16:9" ? t("wide") : aspect === "9:16" ? t("reel") : t("square");
  const filterName = (name: FilterName) =>
    name === "none" ? t("filterNone") : name === "warm" ? t("filterWarm") : name === "cool" ? t("filterCool") : name === "mono" ? t("filterMono") : t("filterVivid");

  return (
    <>
      {props.open ? <button type="button" className="sheet-backdrop" aria-label={t("close")} onClick={props.onClose} /> : null}
      <aside className={props.open ? "inspector is-open" : "inspector"} aria-label={t("tools")}>
        <div className="tabs" role="tablist">
          {(["clip", "look", "text", "audio"] as Tool[]).map((tool) => (
            <button key={tool} type="button" role="tab" aria-selected={props.tool === tool} className={props.tool === tool ? "is-on" : ""} onClick={() => props.setTool(tool)}>
              {t(tool === "clip" ? "clips" : tool === "look" ? "look" : tool === "text" ? "text" : "audio")}
            </button>
          ))}
          <button type="button" className="icon-button sheet-close" onClick={props.onClose} aria-label={t("close")}>
            ×
          </button>
        </div>
        <div className="inspector-body">
          {props.tool === "clip" ? (
            clip ? (
              <div className="stack">
                <label className="field">
                  <span>{t("name")}</span>
                  <input value={clip.name} onChange={(event) => props.onChange(updateClip(props.project, clip.id, { name: event.target.value }))} />
                </label>
                <div className="pair">
                  <label className="field">
                    <span>{t("inPoint")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={Number(clip.inPoint.toFixed(2))}
                      onChange={(event) => props.onChange(updateClip(props.project, clip.id, { inPoint: Number(event.target.value) }))}
                    />
                  </label>
                  <label className="field">
                    <span>{t("outPoint")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={Number(clip.outPoint.toFixed(2))}
                      onChange={(event) => props.onChange(updateClip(props.project, clip.id, { outPoint: Number(event.target.value) }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>
                    {t("speed")} <b>{clip.speed.toFixed(2)}x</b>
                  </span>
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={clip.speed}
                    onChange={(event) => props.onChange(updateClip(props.project, clip.id, { speed: Number(event.target.value) }))}
                  />
                </label>
                <label className="field">
                  <span>
                    {t("volume")} <b>{Math.round(clip.volume * 100)}%</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={clip.volume}
                    onChange={(event) => props.onChange(updateClip(props.project, clip.id, { volume: Number(event.target.value) }))}
                  />
                </label>
                <div className="row-buttons">
                  <button type="button" className="btn btn-ghost" onClick={() => props.onChange(updateClip(props.project, clip.id, { muted: !clip.muted }))}>
                    {clip.muted ? t("unmute") : t("mute")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={props.onSplit}>
                    {t("split")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => props.onMove(-1)}>
                    {t("moveLeft")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => props.onMove(1)}>
                    {t("moveRight")}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={props.onDelete}>
                    {t("deleteClip")}
                  </button>
                </div>
                <p className="label">{t("rotate")}</p>
                <div className="choice">
                  {ROTATIONS.map((degrees) => (
                    <button
                      key={degrees}
                      type="button"
                      className={clip.rotate === degrees ? "is-on" : ""}
                      onClick={() => props.onChange(updateClip(props.project, clip.id, { rotate: degrees }))}
                    >
                      {degrees}°
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="hint">{t("noClips")}</p>
            )
          ) : null}
          {props.tool === "look" ? (
            <div className="stack">
              <p className="label">{t("aspect")}</p>
              <div className="choice">
                {ASPECTS.map((aspect) => (
                  <button
                    key={aspect}
                    type="button"
                    className={props.project.aspect === aspect ? "is-on" : ""}
                    onClick={() => props.onChange({ ...props.project, aspect })}
                  >
                    {aspectLabel(aspect)}
                  </button>
                ))}
              </div>
              <p className="label">{t("filter")}</p>
              <div className="choice">
                {FILTERS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={props.project.filter === name ? "is-on" : ""}
                    onClick={() => props.onChange({ ...props.project, filter: name })}
                  >
                    {filterName(name)}
                  </button>
                ))}
              </div>
              <p className="hint">{filterLabel(props.project.filter, lang)}</p>
              {(["brightness", "contrast", "saturation"] as const).map((key) => (
                <label key={key} className="field">
                  <span>
                    {t(key)} <b>{props.project.color[key].toFixed(2)}</b>
                  </span>
                  <input
                    type="range"
                    min={key === "brightness" ? -0.4 : key === "contrast" ? -0.5 : -1}
                    max={key === "brightness" ? 0.4 : key === "contrast" ? 1 : 1.5}
                    step={0.01}
                    value={props.project.color[key]}
                    onChange={(event) =>
                      props.onChange({
                        ...props.project,
                        color: { ...props.project.color, [key]: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
          {props.tool === "text" ? (
            <div className="stack">
              <button type="button" className="btn btn-primary" onClick={props.onAddText}>
                {t("addText")}
              </button>
              {props.project.texts.map((text) => (
                <div key={text.id} className="block">
                  <input
                    value={text.text}
                    aria-label={t("text")}
                    onChange={(event) =>
                      props.onChange({
                        ...props.project,
                        texts: props.project.texts.map((item) => (item.id === text.id ? { ...item, text: event.target.value } : item)),
                      })
                    }
                  />
                  <div className="choice">
                    {(["top", "center", "bottom"] as TextPosition[]).map((position) => (
                      <button
                        key={position}
                        type="button"
                        className={text.position === position ? "is-on" : ""}
                        onClick={() =>
                          props.onChange({
                            ...props.project,
                            texts: props.project.texts.map((item) => (item.id === text.id ? { ...item, position } : item)),
                          })
                        }
                      >
                        {t(position)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => props.onChange({ ...props.project, texts: props.project.texts.filter((item) => item.id !== text.id) })}
                  >
                    {t("removeText")}
                  </button>
                </div>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={props.project.captionsBurnIn}
                  onChange={(event) => props.onChange({ ...props.project, captionsBurnIn: event.target.checked })}
                />
                <span>{t("burnIn")}</span>
              </label>
              <div className="row-buttons">
                <button type="button" className="btn btn-ghost" onClick={props.onCaptions}>
                  {t("generateCaptions")}
                </button>
                <label className="btn btn-ghost file-btn">
                  {t("importSrt")}
                  <input
                    type="file"
                    accept=".srt,text/plain"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) props.onImportSrt(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" className="btn btn-ghost" onClick={props.onExportSrt} disabled={props.project.captions.length === 0}>
                  {t("exportSrt")}
                </button>
              </div>
              {props.project.captions.map((cue) => (
                <div key={cue.id} className="block">
                  <input
                    value={cue.text}
                    aria-label={t("captions")}
                    onChange={(event) =>
                      props.onChange({
                        ...props.project,
                        captions: props.project.captions.map((item) => (item.id === cue.id ? { ...item, text: event.target.value } : item)),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => props.onChange({ ...props.project, captions: props.project.captions.filter((item) => item.id !== cue.id) })}
                  >
                    {t("removeCue")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {props.tool === "audio" ? (
            <div className="stack">
              <button type="button" className="btn btn-primary" onClick={props.onPickMusic}>
                {t("chooseMusic")}
              </button>
              {props.project.music ? (
                <>
                  <p className="hint">{props.project.music.name}</p>
                  <label className="field">
                    <span>
                      {t("musicVolume")} <b>{Math.round(props.project.music.volume * 100)}%</b>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={props.project.music.volume}
                      onChange={(event) =>
                        props.onChange({
                          ...props.project,
                          music: props.project.music ? { ...props.project.music, volume: Number(event.target.value) } : null,
                        })
                      }
                    />
                  </label>
                  <div className="pair">
                    <label className="field">
                      <span>{t("fadeIn")}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={props.project.music.fadeIn}
                        onChange={(event) =>
                          props.onChange({
                            ...props.project,
                            music: props.project.music ? { ...props.project.music, fadeIn: Number(event.target.value) } : null,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t("fadeOut")}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={props.project.music.fadeOut}
                        onChange={(event) =>
                          props.onChange({
                            ...props.project,
                            music: props.project.music ? { ...props.project.music, fadeOut: Number(event.target.value) } : null,
                          })
                        }
                      />
                    </label>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => props.onChange({ ...props.project, music: null })}>
                    {t("removeMusic")}
                  </button>
                </>
              ) : (
                <p className="hint">{props.project.musicPending ? t("chooseMusic") : t("music")}</p>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
