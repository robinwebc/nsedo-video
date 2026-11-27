import { createId } from "./ids";
import { clipTimelineDuration, round3, timelineDuration } from "./time";
import type { Clip, EditOp, FilterName, Project, Rotate, TextPosition, TextSize } from "./types";

export interface ApplyResult {
  project: Project;
  notes: string[];
}

const MIN_SPAN = 0.05;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function asRotate(degrees: number): Rotate {
  const wrapped = ((degrees % 360) + 360) % 360;
  const snapped = (Math.round(wrapped / 90) * 90) % 360;
  return snapped as Rotate;
}

function cutRange(clips: Clip[], start: number, end: number, nextId: () => string): Clip[] {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(start, end);
  if (to - from < 0.001) return clips.map((clip) => ({ ...clip }));
  const result: Clip[] = [];
  let cursor = 0;
  for (const clip of clips) {
    const len = clipTimelineDuration(clip);
    const clipStart = cursor;
    const clipEnd = cursor + len;
    cursor = clipEnd;
    if (len <= 0) continue;
    const cutFrom = Math.max(clipStart, from);
    const cutTo = Math.min(clipEnd, to);
    if (cutTo - cutFrom < 0.001) {
      result.push({ ...clip });
      continue;
    }
    const keepLeft = cutFrom - clipStart > 0.02;
    const keepRight = clipEnd - cutTo > 0.02;
    if (keepLeft) {
      const leftOut = clip.inPoint + (cutFrom - clipStart) * clip.speed;
      const left: Clip = { ...clip, outPoint: round3(leftOut) };
      if (left.outPoint - left.inPoint >= MIN_SPAN) result.push(left);
    }
    if (keepRight) {
      const rightIn = clip.inPoint + (cutTo - clipStart) * clip.speed;
      const right: Clip = { ...clip, id: keepLeft ? nextId() : clip.id, inPoint: round3(rightIn) };
      if (right.outPoint - right.inPoint >= MIN_SPAN) result.push(right);
    }
  }
  return result;
}

function keepRange(clips: Clip[], start: number, end: number, nextId: () => string): Clip[] {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(start, end);
  const result: Clip[] = [];
  let cursor = 0;
  for (const clip of clips) {
    const len = clipTimelineDuration(clip);
    const clipStart = cursor;
    const clipEnd = cursor + len;
    cursor = clipEnd;
    const keepFrom = Math.max(clipStart, from);
    const keepTo = Math.min(clipEnd, to);
    if (keepTo - keepFrom < 0.02 || len <= 0) continue;
    const inPoint = clip.inPoint + (keepFrom - clipStart) * clip.speed;
    const outPoint = clip.inPoint + (keepTo - clipStart) * clip.speed;
    const next: Clip = {
      ...clip,
      id: keepFrom - clipStart > 0.02 ? nextId() : clip.id,
      inPoint: round3(inPoint),
      outPoint: round3(outPoint),
    };
    if (next.outPoint - next.inPoint >= MIN_SPAN) result.push(next);
  }
  return result;
}

function splitAt(clips: Clip[], at: number, nextId: () => string): Clip[] {
  const result: Clip[] = [];
  let cursor = 0;
  let done = false;
  for (const clip of clips) {
    const len = clipTimelineDuration(clip);
    const clipStart = cursor;
    const clipEnd = cursor + len;
    cursor = clipEnd;
    if (!done && at > clipStart + 0.05 && at < clipEnd - 0.05) {
      const sourceAt = clip.inPoint + (at - clipStart) * clip.speed;
      const point = round3(sourceAt);
      result.push({ ...clip, outPoint: point });
      result.push({ ...clip, id: nextId(), inPoint: point });
      done = true;
    } else {
      result.push({ ...clip });
    }
  }
  return result;
}

function mapClips(clips: Clip[], clipId: string | undefined, fn: (clip: Clip) => Clip): Clip[] {
  return clips.map((clip) => {
    if (clipId && clip.id !== clipId) return { ...clip };
    return fn({ ...clip });
  });
}

function applyOne(project: Project, op: EditOp, nextId: () => string, notes: string[]): Project {
  const next: Project = {
    ...project,
    clips: project.clips.map((clip) => ({ ...clip })),
    texts: project.texts.map((text) => ({ ...text })),
    captions: project.captions.map((cue) => ({ ...cue })),
    color: { ...project.color },
    music: project.music ? { ...project.music } : null,
    musicPending: project.musicPending ? { ...project.musicPending } : null,
  };

  switch (op.op) {
    case "cut":
      next.clips = cutRange(next.clips, op.start, op.end, nextId);
      return next;
    case "cutHead":
      next.clips = cutRange(next.clips, 0, Math.max(0, op.seconds), nextId);
      return next;
    case "cutTail": {
      const dur = timelineDuration(next.clips);
      next.clips = cutRange(next.clips, Math.max(0, dur - Math.max(0, op.seconds)), dur, nextId);
      return next;
    }
    case "keep":
      next.clips = keepRange(next.clips, op.start, op.end, nextId);
      return next;
    case "split":
      next.clips = splitAt(next.clips, op.at, nextId);
      return next;
    case "deleteClip":
      next.clips = next.clips.filter((clip) => clip.id !== op.clipId);
      return next;
    case "deleteClipIndex": {
      if (op.index < 0 || op.index >= next.clips.length) {
        notes.push("clip-index");
        return next;
      }
      next.clips = next.clips.filter((_, index) => index !== op.index);
      return next;
    }
    case "reorder": {
      const byId = new Map(next.clips.map((clip) => [clip.id, clip]));
      const used = new Set<string>();
      const ordered: Clip[] = [];
      for (const id of op.clipIds) {
        const clip = byId.get(id);
        if (clip && !used.has(id)) {
          ordered.push(clip);
          used.add(id);
        }
      }
      for (const clip of next.clips) {
        if (!used.has(clip.id)) ordered.push(clip);
      }
      next.clips = ordered;
      return next;
    }
    case "reverseClips":
      next.clips = [...next.clips].reverse();
      return next;
    case "speed": {
      if (!Number.isFinite(op.rate) || op.rate <= 0) {
        notes.push("speed");
        return next;
      }
      const rate = clamp(op.rate, 0.25, 4);
      next.clips = mapClips(next.clips, op.clipId, (clip) => ({ ...clip, speed: round3(rate) }));
      return next;
    }
    case "volume": {
      if (!Number.isFinite(op.level)) return next;
      next.clips = mapClips(next.clips, op.clipId, (clip) => {
        const level = op.mode === "mul" ? clip.volume * op.level : op.level;
        return { ...clip, volume: round3(clamp(level, 0, 2)), muted: level <= 0.001 ? true : clip.muted };
      });
      return next;
    }
    case "mute":
      next.clips = mapClips(next.clips, op.clipId, (clip) => ({ ...clip, muted: op.muted }));
      return next;
    case "aspect":
      next.aspect = op.aspect;
      return next;
    case "rotate":
      next.clips = mapClips(next.clips, op.clipId, (clip) => ({
        ...clip,
        rotate: asRotate(clip.rotate + op.degrees),
      }));
      return next;
    case "filter":
      next.filter = op.name;
      return next;
    case "color":
      next.color = {
        brightness: round3(clamp(next.color.brightness + (op.brightness ?? 0), -0.4, 0.4)),
        contrast: round3(clamp(next.color.contrast + (op.contrast ?? 0), -0.5, 1)),
        saturation: round3(clamp(next.color.saturation + (op.saturation ?? 0), -1, 1.5)),
      };
      return next;
    case "text": {
      const dur = timelineDuration(next.clips);
      const start = op.start ?? 0;
      const end = op.end ?? (dur > 0 ? Math.min(dur, Math.max(start + 0.5, 3)) : 3);
      const position: TextPosition = op.position ?? "center";
      const size: TextSize = op.size ?? "lg";
      next.texts = [
        ...next.texts,
        {
          id: nextId(),
          text: op.text.trim() || "শিরোনাম",
          start: round3(Math.max(0, start)),
          end: round3(Math.max(start + 0.2, end)),
          position,
          size,
        },
      ];
      return next;
    }
    case "music": {
      const volume = clamp(op.volume ?? next.music?.volume ?? next.musicPending?.volume ?? 0.35, 0, 1);
      const fadeIn = Math.max(0, op.fadeIn ?? next.music?.fadeIn ?? 0.8);
      const fadeOut = Math.max(0, op.fadeOut ?? next.music?.fadeOut ?? 1.4);
      if (next.music) next.music = { ...next.music, volume, fadeIn, fadeOut };
      else next.musicPending = { volume, fadeIn, fadeOut };
      return next;
    }
    case "captions":
      next.captionsBurnIn = op.burnIn !== false;
      if (op.language) next.captionLanguage = op.language;
      return next;
    case "quality":
      next.quality = op.quality;
      return next;
    case "removeSilence":
    case "highlight":
      notes.push(op.op);
      return next;
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
}

export function applyOps(project: Project, ops: EditOp[], ctx?: { nextId?: () => string }): ApplyResult {
  const nextId = ctx?.nextId ?? createId;
  const notes: string[] = [];
  let current = project;
  for (const op of ops) {
    current = applyOne(current, op, nextId, notes);
  }
  return { project: current, notes };
}

export function updateClip(project: Project, clipId: string, patch: Partial<Clip>): Project {
  return {
    ...project,
    clips: project.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const next = { ...clip, ...patch, id: clip.id, sourceId: clip.sourceId };
      next.inPoint = clamp(next.inPoint, 0, Math.max(0, next.duration - MIN_SPAN));
      next.outPoint = clamp(next.outPoint, next.inPoint + MIN_SPAN, Math.max(next.inPoint + MIN_SPAN, next.duration));
      next.speed = clamp(next.speed, 0.25, 4);
      next.volume = clamp(next.volume, 0, 2);
      return next;
    }),
  };
}

export const FILTERS: FilterName[] = ["none", "warm", "cool", "mono", "vivid"];
