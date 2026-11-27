import { createId } from "./ids";
import type { CaptionCue } from "./types";

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function formatSrtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

export function parseSrtTime(value: string): number | null {
  const match = value.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  const secs = Number(match[3]);
  const fraction = match[4].padEnd(3, "0").slice(0, 3);
  return hours * 3600 + mins * 60 + secs + Number(fraction) / 1000;
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text.trim()}\n`)
    .join("\n");
}

export function parseSrt(text: string): CaptionCue[] {
  const blocks = text.replace(/\r/g, "").trim().split(/\n\s*\n/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [left, right] = lines[timingIndex].split("-->");
    const start = parseSrtTime(left ?? "");
    const end = parseSrtTime(right ?? "");
    if (start === null || end === null || end <= start) continue;
    const body = lines.slice(timingIndex + 1).join("\n").trim();
    if (!body) continue;
    cues.push({ id: createId(), start, end, text: body });
  }
  return cues;
}
