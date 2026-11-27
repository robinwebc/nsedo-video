import type { Clip } from "./types";

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function clipTimelineDuration(clip: Clip): number {
  const span = Math.max(0, clip.outPoint - clip.inPoint);
  const speed = clip.speed > 0 ? clip.speed : 1;
  return span / speed;
}

export function timelineDuration(clips: Clip[]): number {
  return clips.reduce((sum, clip) => sum + clipTimelineDuration(clip), 0);
}

export interface TimeLocation {
  clip: Clip;
  index: number;
  clipStart: number;
  clipEnd: number;
  /** Seconds into this clip on the timeline. */
  local: number;
}

export function locateTime(clips: Clip[], time: number): TimeLocation | null {
  if (clips.length === 0) return null;
  const t = Math.max(0, time);
  let cursor = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const len = clipTimelineDuration(clip);
    const clipEnd = cursor + len;
    if (t < clipEnd || index === clips.length - 1) {
      const local = Math.min(len, Math.max(0, t - cursor));
      return { clip, index, clipStart: cursor, clipEnd, local };
    }
    cursor = clipEnd;
  }
  return null;
}

export function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const whole = Math.floor(rem);
  const tenth = Math.floor((rem - whole) * 10);
  return `${String(mins).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenth}`;
}

export function formatSeconds(seconds: number): string {
  const n = round3(seconds);
  return Number.isInteger(n) ? String(n) : String(n);
}
