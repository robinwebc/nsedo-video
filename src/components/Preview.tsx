import { useEffect, useRef } from "react";
import type { Project } from "../core/types";
import { clipTimelineDuration, locateTime, timelineDuration } from "../core/time";
import { usePrefs } from "../ui/prefs";

interface PreviewProps {
  project: Project;
  urls: Record<string, string>;
  playhead: number;
  playing: boolean;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  onFile: (file: File) => void;
}

function previewFilter(project: Project): string {
  const brightness = 1 + project.color.brightness;
  const contrast = 1 + project.color.contrast;
  const saturation = Math.max(0, 1 + project.color.saturation);
  const look =
    project.filter === "warm"
      ? "sepia(0.25) saturate(1.15)"
      : project.filter === "cool"
        ? "hue-rotate(14deg) saturate(0.92)"
        : project.filter === "mono"
          ? "grayscale(1)"
          : project.filter === "vivid"
            ? "saturate(1.45) contrast(1.05)"
            : "";
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) ${look}`.trim();
}

function aspectRatio(project: Project): number {
  if (project.aspect === "16:9") return 16 / 9;
  if (project.aspect === "9:16") return 9 / 16;
  if (project.aspect === "1:1") return 1;
  const clip = project.clips[0];
  const w = clip?.width || 16;
  const h = clip?.height || 9;
  return Math.max(0.3, w / h);
}

export function Preview({ project, urls, playhead, playing, setPlayhead, setPlaying, onFile }: PreviewProps) {
  const { t } = usePrefs();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadRef = useRef(playhead);
  const playingRef = useRef(playing);
  playheadRef.current = playhead;
  playingRef.current = playing;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playing) return;
    const loc = locateTime(project.clips, playhead);
    if (!loc) return;
    const url = urls[loc.clip.sourceId];
    if (!url) return;
    const target = loc.clip.inPoint + loc.local * loc.clip.speed;
    const apply = () => {
      if (Math.abs(video.currentTime - target) > 0.08) video.currentTime = target;
      video.pause();
    };
    if (video.dataset.sourceId !== loc.clip.sourceId) {
      video.dataset.sourceId = loc.clip.sourceId;
      video.src = url;
      video.onloadeddata = () => apply();
    } else apply();
  }, [playhead, playing, project, urls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) {
      videoRef.current?.pause();
      return;
    }
    let frame = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const loc = locateTime(project.clips, playheadRef.current);
      const duration = timelineDuration(project.clips);
      if (!loc) {
        setPlaying(false);
        return;
      }
      const url = urls[loc.clip.sourceId];
      if (!url) {
        setPlaying(false);
        return;
      }
      if (video.dataset.sourceId !== loc.clip.sourceId) {
        video.dataset.sourceId = loc.clip.sourceId;
        video.src = url;
        video.onloadeddata = () => {
          video.currentTime = loc.clip.inPoint + loc.local * loc.clip.speed;
          void video.play().catch(() => setPlaying(false));
        };
      }
      video.playbackRate = Math.min(4, Math.max(0.25, loc.clip.speed));
      video.muted = loc.clip.muted || loc.clip.volume <= 0.001;
      video.volume = video.muted ? 0 : Math.min(1, loc.clip.volume);
      if (video.readyState >= 2 && video.currentTime >= loc.clip.outPoint - 0.06) {
        const next = loc.clipEnd + 0.001;
        if (next >= duration - 0.03) {
          setPlayhead(duration);
          setPlaying(false);
          video.pause();
          return;
        }
        playheadRef.current = next;
        setPlayhead(next);
      } else if (video.readyState >= 2 && !video.paused) {
        const local = Math.max(0, video.currentTime - loc.clip.inPoint) / loc.clip.speed;
        const time = Math.min(loc.clipEnd, loc.clipStart + local);
        if (Math.abs(time - playheadRef.current) > 0.03) {
          playheadRef.current = time;
          setPlayhead(time);
        }
      } else if (video.paused && video.readyState >= 2) {
        void video.play().catch(() => setPlaying(false));
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [playing, project, urls, setPlayhead, setPlaying]);

  const loc = locateTime(project.clips, playhead);
  const activeTexts = project.texts.filter((text) => playhead >= text.start && playhead <= text.end);
  const activeCues = project.captions.filter((cue) => playhead >= cue.start && playhead <= cue.end);

  return (
    <div
      className="frame-wrap"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      {project.clips.length === 0 ? (
        <label className="drop">
          <input
            type="file"
            accept="video/*,.mp4,.webm,.mov,.mkv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
          {t("drop")}
        </label>
      ) : (
        <div
          className="frame"
          style={{ ["--ar" as string]: String(aspectRatio(project)) }}
          data-fit={project.aspect === "original" ? "contain" : "cover"}
        >
          <video
            ref={videoRef}
            className="video-el"
            playsInline
            style={{
              transform: loc ? `rotate(${loc.clip.rotate}deg)` : undefined,
              filter: previewFilter(project),
            }}
          />
          {activeTexts.map((text) => (
            <p key={text.id} className={`overlay-text is-${text.position} is-${text.size}`}>
              {text.text}
            </p>
          ))}
          {activeCues.map((cue) => (
            <p key={cue.id} className="overlay-text is-bottom is-sm">
              {cue.text}
            </p>
          ))}
        </div>
      )}
      <span className="sr-only">
        {project.clips.reduce((sum, clip) => sum + clipTimelineDuration(clip), 0).toFixed(1)}
      </span>
    </div>
  );
}
