import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Clip, Project } from "../core/types";
import { clipTimelineDuration, formatTimecode, timelineDuration } from "../core/time";
import { updateClip } from "../core/apply";
import { IconPause, IconPlay } from "./Icons";
import { usePrefs } from "../ui/prefs";

interface TimelineProps {
  project: Project;
  playhead: number;
  playing: boolean;
  selectedId: string | null;
  onSeek: (time: number) => void;
  onToggle: () => void;
  onSelect: (id: string) => void;
  beginGesture: () => void;
  preview: (project: Project) => void;
  endGesture: () => void;
}

export function Timeline({
  project,
  playhead,
  playing,
  selectedId,
  onSeek,
  onToggle,
  onSelect,
  beginGesture,
  preview,
  endGesture,
}: TimelineProps) {
  const { t } = usePrefs();
  const scroller = useRef<HTMLDivElement>(null);
  const duration = timelineDuration(project.clips);
  const px = duration > 40 ? 28 : duration > 18 ? 42 : 64;
  const width = Math.max(duration * px, 240);
  const step = px >= 48 ? 1 : px >= 24 ? 2 : 5;
  const ticks = useMemo(() => {
    const marks: number[] = [];
    for (let time = 0; time <= duration + 0.001; time += step) marks.push(Number(time.toFixed(3)));
    return marks;
  }, [duration, step]);

  let cursor = 0;
  const bars = project.clips.map((clip) => {
    const len = clipTimelineDuration(clip);
    const bar = { clip, start: cursor, len };
    cursor += len;
    return bar;
  });

  function seekFromClient(clientX: number) {
    const node = scroller.current;
    if (!node || duration <= 0) return;
    const rect = node.getBoundingClientRect();
    const x = clientX - rect.left + node.scrollLeft;
    onSeek(Math.max(0, Math.min(duration, x / px)));
  }

  function startTrim(clip: Clip, edge: "in" | "out", event: ReactPointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const originIn = clip.inPoint;
    const originOut = clip.outPoint;
    beginGesture();
    const move = (ev: globalThis.PointerEvent) => {
      const delta = ((ev.clientX - startX) / px) * clip.speed;
      const patch =
        edge === "in"
          ? { inPoint: Math.min(originOut - 0.1, Math.max(0, originIn + delta)) }
          : { outPoint: Math.max(originIn + 0.1, Math.min(clip.duration, originOut + delta)) };
      preview(updateClip(project, clip.id, patch));
    };
    const up = () => {
      endGesture();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <section className="dock" aria-label={t("timeline")}>
      <div className="transport">
        <button type="button" className="icon-button is-light" onClick={onToggle} aria-label={playing ? t("pause") : t("play")}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <span className="timecode">
          {formatTimecode(playhead)} <span className="timecode-total">/ {formatTimecode(duration)}</span>
        </span>
        <span className="transport-note">{t("privacyShort")}</span>
      </div>
      <div
        className="timeline"
        ref={scroller}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest(".trim")) return;
          seekFromClient(event.clientX);
        }}
      >
        <div className="timeline-inner" style={{ width }}>
          <div className="ruler" aria-hidden="true">
            {ticks.map((time) => (
              <span key={time} style={{ left: time * px }}>
                {formatTimecode(time).slice(0, 5)}
              </span>
            ))}
          </div>
          <div className="clips">
            {bars.map(({ clip, start, len }) => (
              <div
                key={clip.id}
                className={clip.id === selectedId ? "clip is-selected" : "clip"}
                style={{ left: start * px, width: Math.max(28, len * px) }}
              >
                <button type="button" className="trim" aria-label={t("inPoint")} onPointerDown={(event) => startTrim(clip, "in", event)} />
                <button
                  type="button"
                  className="clip-body"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(clip.id);
                  }}
                >
                  <span>{clip.name}</span>
                  <small>{formatTimecode(len)}</small>
                </button>
                <button type="button" className="trim" aria-label={t("outPoint")} onPointerDown={(event) => startTrim(clip, "out", event)} />
              </div>
            ))}
          </div>
          <div className="playhead" style={{ left: Math.min(width, playhead * px) }} />
        </div>
      </div>
    </section>
  );
}
