import { formatSeconds } from "./time";
import type { EditOp, Lang } from "./types";

export function describeOp(op: EditOp, lang: Lang): string {
  const bn = lang === "bn";
  switch (op.op) {
    case "cut":
      return bn
        ? `${formatSeconds(op.start)}–${formatSeconds(op.end)} সে. কাটা`
        : `Cut ${formatSeconds(op.start)}–${formatSeconds(op.end)}s`;
    case "cutHead":
      return bn ? `প্রথম ${formatSeconds(op.seconds)} সে. কাটা` : `Cut the first ${formatSeconds(op.seconds)}s`;
    case "cutTail":
      return bn ? `শেষ ${formatSeconds(op.seconds)} সে. কাটা` : `Cut the last ${formatSeconds(op.seconds)}s`;
    case "keep":
      return bn
        ? `${formatSeconds(op.start)}–${formatSeconds(op.end)} সে. রাখা`
        : `Keep ${formatSeconds(op.start)}–${formatSeconds(op.end)}s`;
    case "split":
      return bn ? `${formatSeconds(op.at)} সে. এ ভাগ` : `Split at ${formatSeconds(op.at)}s`;
    case "deleteClip":
      return bn ? "ক্লিপ মুছে ফেলা" : "Delete clip";
    case "deleteClipIndex":
      return bn ? `ক্লিপ ${op.index + 1} মুছে ফেলা` : `Delete clip ${op.index + 1}`;
    case "reorder":
      return bn ? "ক্লিপের ক্রম বদল" : "Reorder clips";
    case "reverseClips":
      return bn ? "ক্লিপ উল্টো ক্রমে" : "Reverse clip order";
    case "speed":
      return bn ? `গতি ${formatSeconds(op.rate)}x` : `Speed ${formatSeconds(op.rate)}x`;
    case "volume":
      return bn
        ? op.mode === "mul"
          ? `শব্দ ${op.level < 1 ? "কমানো" : "বাড়ানো"}`
          : `ভলিউম ${Math.round(op.level * 100)}%`
        : op.mode === "mul"
          ? op.level < 1
            ? "Quieter"
            : "Louder"
          : `Volume ${Math.round(op.level * 100)}%`;
    case "mute":
      return op.muted ? (bn ? "মিউট" : "Mute") : bn ? "শব্দ চালু" : "Unmute";
    case "aspect":
      return bn ? `আকৃতি ${op.aspect === "original" ? "মূল" : op.aspect}` : `Aspect ${op.aspect}`;
    case "rotate":
      return bn ? `${op.degrees}° ঘোরানো` : `Rotate ${op.degrees}°`;
    case "filter":
      return bn ? `ফিল্টার: ${filterLabel(op.name, "bn")}` : `Filter: ${filterLabel(op.name, "en")}`;
    case "color":
      return bn ? "রঙ সমন্বয়" : "Colour adjust";
    case "text":
      return bn ? `লেখা: ${op.text}` : `Text: ${op.text}`;
    case "music":
      return bn ? "ব্যাকগ্রাউন্ড সঙ্গীত" : "Background music";
    case "removeSilence":
      return bn ? "নীরব অংশ কাটা" : "Remove silence";
    case "highlight":
      return bn ? "হাইলাইট রিল" : "Highlight reel";
    case "captions":
      return bn
        ? `${op.language === "en" ? "ইংরেজি" : "বাংলা"} সাবটাইটেল`
        : `${op.language === "en" ? "English" : "Bangla"} subtitles`;
    case "quality":
      return bn ? `রপ্তানি: ${op.quality}` : `Export quality: ${op.quality}`;
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
}

export function filterLabel(name: string, lang: Lang): string {
  const labels: Record<string, [string, string]> = {
    none: ["মূল", "Original"],
    warm: ["উষ্ণ", "Warm"],
    cool: ["শীতল", "Cool"],
    mono: ["সাদা-কালো", "Mono"],
    vivid: ["উজ্জ্বল রং", "Vivid"],
  };
  const pair = labels[name] ?? [name, name];
  return lang === "bn" ? pair[0] : pair[1];
}

export function summarizeOps(ops: EditOp[], lang: Lang): string {
  if (ops.length === 0) {
    return lang === "bn" ? "এই নির্দেশ থেকে কোনো সম্পাদনা বোঝা যায়নি।" : "No edit matched that command.";
  }
  return ops.map((op) => describeOp(op, lang)).join(" · ");
}
