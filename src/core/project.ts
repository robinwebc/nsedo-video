import { createId } from "./ids";
import type { Clip, Project } from "./types";

export function createProject(name: string): Project {
  return {
    id: createId(),
    name: name.trim() || "নতুন প্রজেক্ট",
    clips: [],
    aspect: "original",
    filter: "none",
    color: { brightness: 0, contrast: 0, saturation: 0 },
    texts: [],
    captions: [],
    captionsBurnIn: true,
    captionLanguage: null,
    music: null,
    musicPending: null,
    quality: "standard",
  };
}

export function createClip(input: {
  name: string;
  sourceId: string;
  duration: number;
  width: number;
  height: number;
}): Clip {
  const duration = Number.isFinite(input.duration) && input.duration > 0 ? input.duration : 0;
  return {
    id: createId(),
    name: input.name.trim() || "ক্লিপ",
    sourceId: input.sourceId,
    duration,
    inPoint: 0,
    outPoint: duration,
    speed: 1,
    volume: 1,
    muted: false,
    rotate: 0,
    width: input.width || 0,
    height: input.height || 0,
  };
}
