import type { Clip, Encoder, MusicTrack, Project, Quality } from "./types";

export interface FrameSize {
  width: number;
  height: number;
}

function even(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

export function frameSize(project: Project): FrameSize {
  if (project.aspect === "16:9") {
    return project.quality === "draft" ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
  }
  if (project.aspect === "9:16") {
    return project.quality === "draft" ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
  }
  if (project.aspect === "1:1") {
    return project.quality === "draft" ? { width: 720, height: 720 } : { width: 1080, height: 1080 };
  }
  const clip = project.clips[0];
  let width = clip?.width || 1280;
  let height = clip?.height || 720;
  if (clip && (clip.rotate === 90 || clip.rotate === 270)) {
    [width, height] = [height, width];
  }
  const cap = project.quality === "draft" ? 1280 : project.quality === "high" ? 1920 : 1920;
  const scale = Math.min(1, cap / Math.max(width, height));
  return { width: even(width * scale), height: even(height * scale) };
}

export function trimNum(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function atempoChain(rate: number): string {
  const parts: number[] = [];
  let rest = rate;
  while (rest > 2.0001) {
    parts.push(2);
    rest /= 2;
  }
  while (rest < 0.4999) {
    parts.push(0.5);
    rest /= 0.5;
  }
  parts.push(Math.round(rest * 1000) / 1000);
  return parts.map((part) => `atempo=${part}`).join(",");
}

export function eqFilter(project: Project): string | null {
  const { brightness, contrast, saturation } = project.color;
  if (brightness === 0 && contrast === 0 && saturation === 0) return null;
  return `eq=brightness=${trimNum(brightness)}:contrast=${trimNum(1 + contrast)}:saturation=${trimNum(1 + saturation)}`;
}

export function lookFilter(project: Project): string | null {
  switch (project.filter) {
    case "warm":
      return "eq=saturation=1.15:gamma_r=1.06:gamma_b=0.92";
    case "cool":
      return "eq=saturation=0.95:gamma_r=0.94:gamma_b=1.08";
    case "mono":
      return "hue=s=0";
    case "vivid":
      return "eq=saturation=1.4:contrast=1.05";
    default:
      return null;
  }
}

export function clipVideoFilters(clip: Clip, project: Project, size: FrameSize): string {
  const filters: string[] = [];
  if (clip.rotate === 90) filters.push("transpose=1");
  else if (clip.rotate === 270) filters.push("transpose=2");
  else if (clip.rotate === 180) filters.push("hflip,vflip");
  if (Math.abs(clip.speed - 1) > 0.001) filters.push(`setpts=${trimNum(1 / clip.speed)}*PTS`);
  if (project.aspect === "original") {
    filters.push(`scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease`);
    filters.push(`pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=black`);
  } else {
    filters.push(`scale=${size.width}:${size.height}:force_original_aspect_ratio=increase`);
    filters.push(`crop=${size.width}:${size.height}`);
  }
  filters.push("setsar=1");
  const eq = eqFilter(project);
  if (eq) filters.push(eq);
  const look = lookFilter(project);
  if (look) filters.push(look);
  filters.push("fps=30", "format=yuv420p");
  return filters.join(",");
}

export function clipAudioFilters(clip: Clip): string {
  const filters = ["aformat=sample_rates=44100:channel_layouts=stereo"];
  if (Math.abs(clip.speed - 1) > 0.001) filters.push(atempoChain(clip.speed));
  filters.push(`volume=${trimNum(clip.muted ? 0 : clip.volume)}`);
  return filters.join(",");
}

export function encoderArgs(encoder: Encoder, quality: Quality): string[] {
  if (encoder === "libx264") {
    const crf = quality === "draft" ? "30" : quality === "high" ? "18" : "23";
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-pix_fmt", "yuv420p"];
  }
  if (encoder === "libopenh264") {
    const bitrate = quality === "draft" ? "1500k" : quality === "high" ? "8000k" : "4000k";
    return ["-c:v", "libopenh264", "-b:v", bitrate, "-pix_fmt", "yuv420p"];
  }
  const q = quality === "draft" ? "8" : quality === "high" ? "2" : "5";
  return ["-c:v", "mpeg4", "-q:v", q, "-pix_fmt", "yuv420p"];
}

export function chooseEncoder(available: Iterable<string>): Encoder {
  const names = new Set(available);
  if (names.has("libx264")) return "libx264";
  if (names.has("libopenh264")) return "libopenh264";
  return "mpeg4";
}

export function clipRenderArgs(
  input: string,
  output: string,
  clip: Clip,
  project: Project,
  size: FrameSize,
  encoder: Encoder,
): string[] {
  return [
    "-ss",
    trimNum(clip.inPoint),
    "-to",
    trimNum(clip.outPoint),
    "-i",
    input,
    "-filter_complex",
    `[0:v]${clipVideoFilters(clip, project, size)}[v];[0:a]${clipAudioFilters(clip)}[a]`,
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
  ];
}

export function silentClipArgs(
  input: string,
  output: string,
  clip: Clip,
  project: Project,
  size: FrameSize,
  encoder: Encoder,
): string[] {
  const seconds = Math.max(0.1, (clip.outPoint - clip.inPoint) / (clip.speed || 1));
  return [
    "-ss",
    trimNum(clip.inPoint),
    "-to",
    trimNum(clip.outPoint),
    "-i",
    input,
    "-f",
    "lavfi",
    "-t",
    trimNum(seconds),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-filter_complex",
    `[0:v]${clipVideoFilters(clip, project, size)}[v];[1:a]${clipAudioFilters({ ...clip, muted: clip.muted, volume: clip.muted ? 0 : clip.volume })}[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-shortest",
    ...encoderArgs(encoder, project.quality),
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    output,
  ];
}

export function concatArgs(inputs: string[], output: string, encoder: Encoder, quality: Quality): string[] {
  const graph = `${inputs.map((_, index) => `[${index}:v][${index}:a]`).join("")}concat=n=${inputs.length}:v=1:a=1[v][a]`;
  return [
    ...inputs.flatMap((input) => ["-i", input]),
    "-filter_complex",
    graph,
    "-map",
    "[v]",
    "-map",
    "[a]",
    ...encoderArgs(encoder, quality),
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    output,
  ];
}

export function musicFilter(duration: number, music: MusicTrack, musicIn = "[1:a]", mainIn = "[0:a]"): string {
  const fadeOutAt = Math.max(0, duration - music.fadeOut);
  return `${musicIn}afade=t=in:st=0:d=${trimNum(music.fadeIn)},afade=t=out:st=${trimNum(fadeOutAt)}:d=${trimNum(music.fadeOut)},volume=${trimNum(music.volume)}[ma];${mainIn}[ma]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`;
}

export function silenceDetectArgs(input: string, start: number, end: number, thresholdDb: number, minDuration: number): string[] {
  return [
    "-ss",
    trimNum(start),
    "-to",
    trimNum(end),
    "-i",
    input,
    "-af",
    `silencedetect=noise=${trimNum(thresholdDb)}dB:d=${trimNum(minDuration)}`,
    "-f",
    "null",
    "-",
  ];
}

export function audioExtractArgs(input: string, output: string): string[] {
  return ["-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output];
}

export function parseEncoderList(log: string): string[] {
  return [...log.matchAll(/^\s*[VAS.]+\s+([a-z0-9_]+)/gm)].map((match) => match[1]);
}
