export type Aspect = "original" | "16:9" | "9:16" | "1:1";
export type Quality = "draft" | "standard" | "high";
export type FilterName = "none" | "warm" | "cool" | "mono" | "vivid";
export type Rotate = 0 | 90 | 180 | 270;
export type TextPosition = "top" | "center" | "bottom";
export type TextSize = "sm" | "md" | "lg";
export type Lang = "bn" | "en";

export interface Clip {
  id: string;
  name: string;
  sourceId: string;
  /** Full source length in seconds. */
  duration: number;
  inPoint: number;
  outPoint: number;
  /** Playback rate. 1 is normal. */
  speed: number;
  /** Linear gain, 0 to 2. */
  volume: number;
  muted: boolean;
  rotate: Rotate;
  width: number;
  height: number;
}

export interface TextOverlay {
  id: string;
  text: string;
  start: number;
  end: number;
  position: TextPosition;
  size: TextSize;
}

export interface CaptionCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface MusicSettings {
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface MusicTrack extends MusicSettings {
  sourceId: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  clips: Clip[];
  aspect: Aspect;
  filter: FilterName;
  color: { brightness: number; contrast: number; saturation: number };
  texts: TextOverlay[];
  captions: CaptionCue[];
  captionsBurnIn: boolean;
  captionLanguage: Lang | null;
  music: MusicTrack | null;
  /** Set when a command asked for music and no file has been chosen yet. */
  musicPending: MusicSettings | null;
  quality: Quality;
}

export type EditOp =
  | { op: "cut"; start: number; end: number }
  | { op: "cutHead"; seconds: number }
  | { op: "cutTail"; seconds: number }
  | { op: "keep"; start: number; end: number }
  | { op: "split"; at: number }
  | { op: "deleteClip"; clipId: string }
  | { op: "deleteClipIndex"; index: number }
  | { op: "reorder"; clipIds: string[] }
  | { op: "reverseClips" }
  | { op: "speed"; rate: number; clipId?: string }
  | { op: "volume"; level: number; mode: "set" | "mul"; clipId?: string }
  | { op: "mute"; muted: boolean; clipId?: string }
  | { op: "aspect"; aspect: Aspect }
  | { op: "rotate"; degrees: number; clipId?: string }
  | { op: "filter"; name: FilterName }
  | { op: "color"; brightness?: number; contrast?: number; saturation?: number }
  | { op: "text"; text: string; start?: number; end?: number; position?: TextPosition; size?: TextSize }
  | { op: "music"; volume?: number; fadeIn?: number; fadeOut?: number }
  | { op: "removeSilence"; thresholdDb?: number; minDuration?: number }
  | { op: "highlight"; targetDuration?: number }
  | { op: "captions"; language?: Lang; burnIn?: boolean }
  | { op: "quality"; quality: Quality };

export type Encoder = "libx264" | "libopenh264" | "mpeg4";

export function isAnalysisOp(op: EditOp): op is Extract<EditOp, { op: "removeSilence" | "highlight" }> {
  return op.op === "removeSilence" || op.op === "highlight";
}
