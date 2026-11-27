import { summarizeOps } from "./describe";
import type { EditOp, FilterName, Lang, TextPosition } from "./types";

export interface CommandPlan {
  summary: string;
  ops: EditOp[];
  source: "rules" | "model";
  language: Lang;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

const NUMBER_WORDS: Record<string, number> = {
  আড়াই: 2.5,
  আড়াই: 2.5,
  দেড়: 1.5,
  দেড়: 1.5,
  দ্বিগুণ: 2,
  ডাবল: 2,
  আধা: 0.5,
  দশ: 10,
  নয়: 9,
  নয়: 9,
  আট: 8,
  সাত: 7,
  ছয়: 6,
  ছয়: 6,
  পাঁচ: 5,
  পাচ: 5,
  চার: 4,
  তিন: 3,
  দুই: 2,
  এক: 1,
  half: 0.5,
  double: 2,
  twice: 2,
  ten: 10,
  nine: 9,
  eight: 8,
  seven: 7,
  six: 6,
  five: 5,
  four: 4,
  three: 3,
  two: 2,
  one: 1,
};

const NUMBER_PATTERN = `(?:\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

export function commandLanguage(input: string): Lang {
  return /[\u0980-\u09FF]/.test(input) ? "bn" : "en";
}

export function normalizeCommand(input: string): string {
  return input
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[০-৯]/g, (digit) => String(BN_DIGITS.indexOf(digit)))
    .replace(/[।]/g, " ")
    .replace(/\s+/g, " ");
}

function toNumber(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d/.test(token)) {
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  }
  return NUMBER_WORDS[token] ?? null;
}

function protectPhrases(input: string): string {
  return input
    .replace(/black and white/g, "black-and-white")
    .replace(/কালো এবং সাদা/g, "কালো-সাদা")
    .replace(/কালো ও সাদা/g, "কালো-সাদা");
}

export function splitClauses(input: string): string[] {
  const text = protectPhrases(input);
  const parts: string[] = [];
  let buf = "";
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "“") {
      quote = "”";
      buf += ch;
      continue;
    }
    const rest = text.slice(i);
    const sep = rest.match(/^(?:,| এবং | and | আর )/);
    if (sep && buf.trim()) {
      parts.push(buf.trim());
      buf = "";
      i += sep[0].length - 1;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.length ? parts : [text.trim()].filter(Boolean);
}

function matchSilence(text: string): EditOp | null {
  if (/(নীরবতা|চুপচাপ|silent parts|remove silence|cut silence|strip silence|silence removal|auto-?cut silence)/.test(text)) {
    return { op: "removeSilence", thresholdDb: -35, minDuration: 0.4 };
  }
  return null;
}

function matchCaptions(text: string): EditOp | null {
  if (!/(সাবটাইটেল|subtitle|ক্যাপশন|caption)/.test(text)) return null;
  let language: Lang | undefined;
  if (/(বাংলা|bangla|bengali)/.test(text)) language = "bn";
  else if (/(ইংরেজি|english)/.test(text)) language = "en";
  const burnIn = !/(srt only|শুধু srt|without burn)/.test(text);
  return { op: "captions", language, burnIn };
}

function matchHighlight(text: string): EditOp | null {
  if (/(হাইলাইট|highlight|বেস্ট মোমেন্ট|best moments)/.test(text)) {
    const seconds = text.match(new RegExp(`${NUMBER_PATTERN}`));
    const target = seconds ? toNumber(seconds[0]) : null;
    return { op: "highlight", targetDuration: target && target >= 3 ? target : 15 };
  }
  return null;
}

function matchMusic(text: string): EditOp | null {
  if (!/(ব্যাকগ্রাউন্ড মিউজিক|ব্যাকগ্রাউন্ড সঙ্গীত|background music|\bbgm\b|বিজিএম|গান যোগ|add music|সঙ্গীত যোগ)/.test(text)) {
    return null;
  }
  const faded = /(ফেড|fade)/.test(text);
  return { op: "music", volume: 0.35, fadeIn: faded ? 1.5 : 0.8, fadeOut: faded ? 2 : 1.4 };
}

function matchAspect(text: string): EditOp | null {
  if (/(16\s*[:/]\s*9|ইউটিউব|youtube|ল্যান্ডস্কেপ|landscape|widescreen)/.test(text)) return { op: "aspect", aspect: "16:9" };
  if (/(9\s*[:/]\s*16|রিলস|রিল|\breels?\b|shorts|শর্টস|tiktok|টিকটক|পোর্ট্রেট|portrait|vertical|ভার্টিকাল)/.test(text)) {
    return { op: "aspect", aspect: "9:16" };
  }
  if (/(^|[^0-9])1\s*[:/]\s*1([^0-9]|$)|বর্গ|স্কয়ার|স্কয়ার|square/.test(text)) return { op: "aspect", aspect: "1:1" };
  if (/(মূল আকার|original aspect)/.test(text)) return { op: "aspect", aspect: "original" };
  return null;
}

function matchQuality(text: string): EditOp | null {
  if (/(হাই কোয়ালিটি|হাই কোয়ালিটি|high quality|best quality)/.test(text)) return { op: "quality", quality: "high" };
  if (/(ড্রাফট|draft|low quality)/.test(text)) return { op: "quality", quality: "draft" };
  if (/(স্ট্যান্ডার্ড|standard quality)/.test(text)) return { op: "quality", quality: "standard" };
  return null;
}

function matchFilter(text: string): EditOp | null {
  let name: FilterName | null = null;
  if (/(কালো-সাদা|কালো সাদা|black-and-white|black & white|grayscale|greyscale|mono)/.test(text)) name = "mono";
  else if (/(উষ্ণ|\bwarm\b)/.test(text)) name = "warm";
  else if (/(শীতল|\bcool\b)/.test(text)) name = "cool";
  else if (/(ভিভিড|\bvivid\b|উজ্জ্বল রং|উজ্জ্বল রঙ)/.test(text)) name = "vivid";
  else if (/(ফিল্টার সর|no filter|remove filter)/.test(text)) name = "none";
  return name ? { op: "filter", name } : null;
}

function matchColor(text: string): EditOp | null {
  if (/(কম উজ্জ্বল|darker|too bright)/.test(text)) return { op: "color", brightness: -0.08 };
  if (/(উজ্জ্বল কর|brighter|brighten)/.test(text)) return { op: "color", brightness: 0.08 };
  if (/(কনট্রাস্ট বাড়|কনট্রাস্ট বাড়|more contrast|higher contrast)/.test(text)) return { op: "color", contrast: 0.15 };
  if (/(কনট্রাস্ট কমা|less contrast)/.test(text)) return { op: "color", contrast: -0.12 };
  if (/(স্যাচুরেশন বাড়|স্যাচুরেশন বাড়|more saturat|more colour|more color)/.test(text)) return { op: "color", saturation: 0.2 };
  if (/(রং কমা|less saturat|desaturat)/.test(text)) return { op: "color", saturation: -0.25 };
  return null;
}

function matchRotate(text: string): EditOp | null {
  if (/(উল্টে|উল্টো|\bflip\b|upside down)/.test(text)) return { op: "rotate", degrees: 180 };
  if (!/(ঘোর|rotate|\bturn\b)/.test(text)) return null;
  const match = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*(?:ডিগ্রি|degree|deg)`));
  const value = toNumber(match?.[1]);
  return { op: "rotate", degrees: value ?? 90 };
}

function matchSpeed(text: string): EditOp | null {
  if (/(আধা গতি|half speed|slow motion|স্লো মোশন)/.test(text)) return { op: "speed", rate: 0.5 };
  if (/(দ্বিগুণ|double speed|twice as fast)/.test(text)) return { op: "speed", rate: 2 };
  if (/(দেড় গুণ|দেড় গুণ)/.test(text)) return { op: "speed", rate: 1.5 };
  let match = text.match(new RegExp(`(?:স্পিড|speed|গতি)\\s*(?:করে\\s*)?(?:দাও\\s*)?(${NUMBER_PATTERN})\\s*x?`));
  if (match) {
    const rate = toNumber(match[1]);
    if (rate) return { op: "speed", rate };
  }
  match = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*x\\b`));
  if (match && /(স্পিড|speed|গতি|গুণ|fast|slow)/.test(text) || (match && /(?:স্পিড|speed|গতি)/.test(text) === false && match)) {
    if (match && /(স্পিড|speed|গতি|\dx\b)/.test(text)) {
      const rate = toNumber(match[1]);
      if (rate) return { op: "speed", rate };
    }
  }
  if (/(^|\s)(দ্রুত|faster|speed up)(\s|$)/.test(text)) return { op: "speed", rate: 1.5 };
  if (/(ধীরে|slower|slow down)/.test(text)) return { op: "speed", rate: 0.75 };
  return null;
}

function matchAudio(text: string): EditOp | null {
  if (/(আনমিউট|unmute|শব্দ চালু|সাউন্ড চালু)/.test(text)) return { op: "mute", muted: false };
  if (/(মিউট|\bmute\b|শব্দ বন্ধ|সাউন্ড বন্ধ|নীরব কর)/.test(text)) return { op: "mute", muted: true };
  const match = text.match(new RegExp(`(?:ভলিউম|volume|শব্দ)\\s*(${NUMBER_PATTERN})\\s*(%?)`));
  if (match) {
    const raw = toNumber(match[1]);
    if (raw === null) return null;
    const level = match[2] === "%" || raw > 2 ? raw / 100 : raw;
    return { op: "volume", level, mode: "set" };
  }
  if (/(শব্দ বাড়|শব্দ বাড়|louder|volume up|increase volume)/.test(text)) return { op: "volume", level: 1.4, mode: "mul" };
  if (/(শব্দ কমা|quieter|volume down|decrease volume)/.test(text)) return { op: "volume", level: 0.7, mode: "mul" };
  return null;
}

function cleanTitle(text: string): string {
  const quoted = text.match(/["“']([^"”']+)["”']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  return text
    .replace(/(?:একটা|একটি)?\s*(?:টাইটেল|শিরোনাম|টেক্সট|লেখা|title|text|overlay)/g, " ")
    .replace(/(?:যোগ করো|যোগ করুন|যোগ|বসাও|লিখো|add|put|insert|please|করো|করুন|দাও|দিন)/g, " ")
    .replace(/[:\-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchText(text: string): EditOp | null {
  if (!/(টাইটেল|শিরোনাম|টেক্সট|লেখা|\btitle\b|\btext\b|overlay)/.test(text)) return null;
  if (/(সাবটাইটেল|subtitle)/.test(text)) return null;
  const extracted = cleanTitle(text);
  const position: TextPosition = /(নিচে|bottom)/.test(text) ? "bottom" : /(উপরে|top)/.test(text) ? "top" : "center";
  const fallback = commandLanguage(text) === "bn" ? "শিরোনাম" : "Title";
  return { op: "text", text: extracted || fallback, position, size: "lg" };
}

const SECOND = "(?:\\s*(?:সেকেন্ড|সেকেণ্ড|seconds?|secs?|sec|s))?";

function matchCut(text: string): EditOp | null {
  let match = text.match(new RegExp(`(${NUMBER_PATTERN})\\s*(?:থেকে|from)\\s*(${NUMBER_PATTERN})${SECOND}\\s*(?:পর্যন্ত)?\\s*(?:রাখো|রাখ|keep)`));
  if (match) return { op: "keep", start: toNumber(match[1]) ?? 0, end: toNumber(match[2]) ?? 0 };
  match = text.match(new RegExp(`keep\\s+(?:from\\s+)?(${NUMBER_PATTERN})\\s*(?:to|-)\\s*(${NUMBER_PATTERN})`));
  if (match) return { op: "keep", start: toNumber(match[1]) ?? 0, end: toNumber(match[2]) ?? 0 };
  if (/(রাখো|রাখ|keep|trim to)/.test(text)) {
    match = text.match(new RegExp(`(?:প্রথম|first|to)?\\s*(${NUMBER_PATTERN})${SECOND}`));
    if (match && /(রাখ|keep|trim)/.test(text)) {
      const end = toNumber(match[1]);
      if (end) return { op: "keep", start: 0, end };
    }
  }
  if (/(প্রথম|first)/.test(text) && /(কেটে|কাট|বাদ|সরাও|সরি|cut|remove|trim|drop)/.test(text)) {
    match = text.match(new RegExp(`(?:প্রথম|first)\\s+(${NUMBER_PATTERN})`));
    const seconds = toNumber(match?.[1]);
    if (seconds) return { op: "cutHead", seconds };
  }
  match = text.match(new RegExp(`(?:cut|remove|drop)\\s+(?:the\\s+)?first\\s+(${NUMBER_PATTERN})`));
  if (match) {
    const seconds = toNumber(match[1]);
    if (seconds) return { op: "cutHead", seconds };
  }
  if (/(শেষ|last)/.test(text) && /(কেটে|কাট|বাদ|সরাও|সরি|cut|remove|trim|drop)/.test(text)) {
    match = text.match(new RegExp(`(?:শেষ|last)\\s+(${NUMBER_PATTERN})`));
    const seconds = toNumber(match?.[1]);
    if (seconds) return { op: "cutTail", seconds };
  }
  match = text.match(new RegExp(`(?:cut|remove|drop)\\s+(?:the\\s+)?last\\s+(${NUMBER_PATTERN})`));
  if (match) {
    const seconds = toNumber(match[1]);
    if (seconds) return { op: "cutTail", seconds };
  }
  match = text.match(
    new RegExp(`(${NUMBER_PATTERN})\\s*(?:থেকে|from|to|-)\\s*(${NUMBER_PATTERN})${SECOND}\\s*(?:কেটে|কাট|বাদ|সরাও|cut|remove)`),
  );
  if (match) return { op: "cut", start: toNumber(match[1]) ?? 0, end: toNumber(match[2]) ?? 0 };
  return null;
}

function matchSplit(text: string): EditOp | null {
  if (!/(ভাগ|স্প্লিট|\bsplit\b)/.test(text)) return null;
  const match = text.match(new RegExp(`(${NUMBER_PATTERN})`));
  const at = toNumber(match?.[1]);
  if (at === null) return null;
  return { op: "split", at };
}

function matchDelete(text: string): EditOp | null {
  if (!/(মুছ|ডিলিট|\bdelete\b|\bremove clip\b)/.test(text)) return null;
  const match = text.match(/(?:ক্লিপ|clip)\s*(\d+)/);
  if (!match) return null;
  return { op: "deleteClipIndex", index: Number(match[1]) - 1 };
}

function matchReverse(text: string): EditOp | null {
  if (/(উল্টো ক্রম|ক্রম উল্ট|reverse clips|reverse order)/.test(text)) return { op: "reverseClips" };
  return null;
}

const MATCHERS = [
  matchSilence,
  matchCaptions,
  matchHighlight,
  matchMusic,
  matchAspect,
  matchQuality,
  matchFilter,
  matchColor,
  matchRotate,
  matchSpeed,
  matchAudio,
  matchText,
  matchCut,
  matchSplit,
  matchDelete,
  matchReverse,
];

export function matchClause(clause: string): EditOp | null {
  for (const match of MATCHERS) {
    const op = match(clause);
    if (op) return op;
  }
  return null;
}

export function planFromRules(command: string): CommandPlan {
  const language = commandLanguage(command);
  const clauses = splitClauses(normalizeCommand(command));
  const ops: EditOp[] = [];
  for (const clause of clauses) {
    const op = matchClause(clause);
    if (op) {
      ops.push(op);
      continue;
    }
    const prev = ops[ops.length - 1];
    if (prev && prev.op === "text") prev.text = `${prev.text} ${clause}`.trim();
  }
  return {
    summary: summarizeOps(ops, language),
    ops,
    source: "rules",
    language,
  };
}
