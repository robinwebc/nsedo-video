import type { EditOp } from "./types";

export interface TimeRange {
  start: number;
  end: number;
}

export function parseSilenceLog(log: string, duration: number): TimeRange[] {
  const re = /silence_(start|end):\s*(-?\d+(?:\.\d+)?)/g;
  const ranges: TimeRange[] = [];
  let open: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(log))) {
    const time = Number(match[2]);
    if (match[1] === "start") open = time;
    else if (open !== null) {
      ranges.push({ start: Math.max(0, open), end: Math.min(duration, time) });
      open = null;
    }
  }
  if (open !== null) ranges.push({ start: Math.max(0, open), end: duration });
  return ranges.filter((range) => range.end - range.start > 0.05);
}

export function offsetSilence(ranges: TimeRange[], clipStart: number, speed: number): TimeRange[] {
  const rate = speed > 0 ? speed : 1;
  return ranges.map((range) => ({
    start: clipStart + range.start / rate,
    end: clipStart + range.end / rate,
  }));
}

export function invertRanges(duration: number, cuts: TimeRange[], minKeep = 0.2): TimeRange[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const keeps: TimeRange[] = [];
  let cursor = 0;
  for (const cut of sorted) {
    const start = Math.max(0, cut.start);
    const end = Math.min(duration, cut.end);
    if (start > cursor + minKeep) keeps.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (duration > cursor + minKeep) keeps.push({ start: cursor, end: duration });
  return keeps;
}

/** Cuts are ordered from the end so each timestamp stays valid as earlier media is removed. */
export function rangesToCutOps(ranges: TimeRange[]): EditOp[] {
  return [...ranges]
    .filter((range) => range.end - range.start > 0.05)
    .sort((a, b) => b.start - a.start)
    .map((range) => ({ op: "cut", start: range.start, end: range.end }));
}

export function safeSilenceCuts(ranges: TimeRange[], duration: number): EditOp[] {
  const kept = invertRanges(duration, ranges, 0.15).reduce((sum, range) => sum + (range.end - range.start), 0);
  if (kept < 0.3) return [];
  return rangesToCutOps(ranges);
}

export function planHighlight(audible: TimeRange[], duration: number, target = 15): TimeRange[] {
  const span = Math.max(0, duration);
  if (span <= 0) return [];
  if (audible.length === 0) {
    const length = Math.min(span, target);
    const start = Math.max(0, span / 2 - length / 2);
    return [{ start, end: Math.min(span, start + length) }];
  }
  const ranked = [...audible].sort((a, b) => b.end - b.start - (a.end - a.start));
  const trimmed: TimeRange[] = [];
  let used = 0;
  for (const range of ranked) {
    if (used >= target - 0.05) break;
    const room = target - used;
    const length = range.end - range.start;
    if (length < 0.25) continue;
    if (length > room) {
      trimmed.push({ start: range.start, end: range.start + room });
      used += room;
      break;
    }
    trimmed.push(range);
    used += length;
  }
  trimmed.sort((a, b) => a.start - b.start);
  return trimmed;
}

export function keepsToCutOps(keeps: TimeRange[], duration: number): EditOp[] {
  const gaps = invertRanges(duration, keeps, 0);
  return rangesToCutOps(gaps);
}
