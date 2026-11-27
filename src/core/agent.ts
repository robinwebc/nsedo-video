import { summarizeOps } from "./describe";
import { planFromRules, type CommandPlan } from "./parser";
import { timelineDuration } from "./time";
import type { Aspect, EditOp, FilterName, Lang, Project, Quality, TextPosition, TextSize } from "./types";

export interface AiSettings {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  whisperBaseUrl: string;
  whisperApiKey: string;
  whisperModel: string;
}

export const defaultAiSettings: AiSettings = {
  aiBaseUrl: "https://api.openai.com/v1",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  whisperBaseUrl: "https://api.openai.com/v1",
  whisperApiKey: "",
  whisperModel: "whisper-1",
};

export function endpointAllowed(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}

const ASPECTS = new Set<Aspect>(["original", "16:9", "9:16", "1:1"]);
const FILTERS = new Set<FilterName>(["none", "warm", "cool", "mono", "vivid"]);
const QUALITIES = new Set<Quality>(["draft", "standard", "high"]);
const POSITIONS = new Set<TextPosition>(["top", "center", "bottom"]);
const SIZES = new Set<TextSize>(["sm", "md", "lg"]);

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function sanitizeOps(input: unknown): EditOp[] {
  const root = asRecord(input);
  const list = Array.isArray(input) ? input : root?.ops ?? root?.operations ?? root?.edits;
  if (!Array.isArray(list)) return [];
  const ops: EditOp[] = [];
  for (const item of list) {
    const record = asRecord(item);
    if (!record) continue;
    const kind = String(record.op ?? record.type ?? "");
    const op = sanitizeOp(kind, record);
    if (op) ops.push(op);
  }
  return ops;
}

function sanitizeOp(kind: string, record: Record<string, unknown>): EditOp | null {
  switch (kind) {
    case "cut": {
      const start = num(record.start);
      const end = num(record.end);
      if (start === null || end === null) return null;
      return { op: "cut", start, end };
    }
    case "cutHead": {
      const seconds = num(record.seconds);
      return seconds === null ? null : { op: "cutHead", seconds };
    }
    case "cutTail": {
      const seconds = num(record.seconds);
      return seconds === null ? null : { op: "cutTail", seconds };
    }
    case "keep": {
      const start = num(record.start);
      const end = num(record.end);
      if (start === null || end === null) return null;
      return { op: "keep", start, end };
    }
    case "split": {
      const at = num(record.at);
      return at === null ? null : { op: "split", at };
    }
    case "deleteClip":
      return typeof record.clipId === "string" ? { op: "deleteClip", clipId: record.clipId } : null;
    case "deleteClipIndex": {
      const index = num(record.index);
      return index === null ? null : { op: "deleteClipIndex", index };
    }
    case "reorder":
      return Array.isArray(record.clipIds) ? { op: "reorder", clipIds: record.clipIds.map(String) } : null;
    case "reverseClips":
      return { op: "reverseClips" };
    case "speed": {
      const rate = num(record.rate);
      if (rate === null) return null;
      return { op: "speed", rate, clipId: typeof record.clipId === "string" ? record.clipId : undefined };
    }
    case "volume": {
      const level = num(record.level);
      if (level === null) return null;
      const mode = record.mode === "mul" ? "mul" : "set";
      return { op: "volume", level, mode, clipId: typeof record.clipId === "string" ? record.clipId : undefined };
    }
    case "mute":
      return {
        op: "mute",
        muted: record.muted !== false,
        clipId: typeof record.clipId === "string" ? record.clipId : undefined,
      };
    case "aspect":
      return typeof record.aspect === "string" && ASPECTS.has(record.aspect as Aspect)
        ? { op: "aspect", aspect: record.aspect as Aspect }
        : null;
    case "rotate": {
      const degrees = num(record.degrees);
      return degrees === null
        ? null
        : { op: "rotate", degrees, clipId: typeof record.clipId === "string" ? record.clipId : undefined };
    }
    case "filter":
      return typeof record.name === "string" && FILTERS.has(record.name as FilterName)
        ? { op: "filter", name: record.name as FilterName }
        : null;
    case "color":
      return {
        op: "color",
        brightness: num(record.brightness) ?? undefined,
        contrast: num(record.contrast) ?? undefined,
        saturation: num(record.saturation) ?? undefined,
      };
    case "text":
      return {
        op: "text",
        text: String(record.text ?? "").slice(0, 180),
        start: num(record.start) ?? undefined,
        end: num(record.end) ?? undefined,
        position: typeof record.position === "string" && POSITIONS.has(record.position as TextPosition)
          ? (record.position as TextPosition)
          : undefined,
        size: typeof record.size === "string" && SIZES.has(record.size as TextSize) ? (record.size as TextSize) : undefined,
      };
    case "music":
      return {
        op: "music",
        volume: num(record.volume) ?? undefined,
        fadeIn: num(record.fadeIn) ?? undefined,
        fadeOut: num(record.fadeOut) ?? undefined,
      };
    case "removeSilence":
      return {
        op: "removeSilence",
        thresholdDb: num(record.thresholdDb) ?? undefined,
        minDuration: num(record.minDuration) ?? undefined,
      };
    case "highlight":
      return { op: "highlight", targetDuration: num(record.targetDuration) ?? undefined };
    case "captions":
      return {
        op: "captions",
        language: record.language === "en" || record.language === "bn" ? record.language : undefined,
        burnIn: typeof record.burnIn === "boolean" ? record.burnIn : undefined,
      };
    case "quality":
      return typeof record.quality === "string" && QUALITIES.has(record.quality as Quality)
        ? { op: "quality", quality: record.quality as Quality }
        : null;
    default:
      return null;
  }
}

export function projectBrief(project: Project): string {
  const clips = project.clips
    .map((clip, index) => `${index + 1}. ${clip.id} ${clip.name} in=${clip.inPoint} out=${clip.outPoint} speed=${clip.speed}`)
    .join("\n");
  return `duration=${timelineDuration(project.clips).toFixed(2)}s aspect=${project.aspect} filter=${project.filter}\n${clips}`;
}

const SYSTEM_PROMPT = `You convert one video-editing command into JSON edit operations for nSedo Video.
Reply with JSON only: {"summary":"short","ops":[...]}
Times are seconds on the composed timeline.
Allowed ops:
{"op":"cutHead","seconds":number}
{"op":"cutTail","seconds":number}
{"op":"cut","start":number,"end":number}
{"op":"keep","start":number,"end":number}
{"op":"split","at":number}
{"op":"deleteClipIndex","index":number}
{"op":"reverseClips"}
{"op":"speed","rate":number}
{"op":"volume","level":number,"mode":"set"|"mul"}
{"op":"mute","muted":boolean}
{"op":"aspect","aspect":"original"|"16:9"|"9:16"|"1:1"}
{"op":"rotate","degrees":number}
{"op":"filter","name":"none"|"warm"|"cool"|"mono"|"vivid"}
{"op":"color","brightness":number,"contrast":number,"saturation":number}
{"op":"text","text":string,"position":"top"|"center"|"bottom"}
{"op":"music","volume":number,"fadeIn":number,"fadeOut":number}
{"op":"removeSilence","thresholdDb":number,"minDuration":number}
{"op":"highlight","targetDuration":number}
{"op":"captions","language":"bn"|"en","burnIn":boolean}
{"op":"quality","quality":"draft"|"standard"|"high"}
Write summary in the same language as the command. Use at most 6 ops. Do not invent files.`;

export interface PlanOutcome extends CommandPlan {
  fallbackReason?: "endpoint" | "empty" | "error";
}

async function planWithModel(
  command: string,
  project: Project,
  settings: AiSettings,
  fetchImpl: typeof fetch,
): Promise<CommandPlan> {
  const base = settings.aiBaseUrl.replace(/\/$/, "");
  const response = await fetchImpl(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel || "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Project:\n${projectBrief(project)}\n\nCommand:\n${command}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`model ${response.status}`);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  const ops = sanitizeOps(parsed);
  const record = asRecord(parsed);
  const language: Lang = /[\u0980-\u09FF]/.test(command) ? "bn" : "en";
  const summary = typeof record?.summary === "string" && record.summary.trim() ? record.summary.trim() : summarizeOps(ops, language);
  return { summary, ops, source: "model", language };
}

export async function planCommand(
  command: string,
  project: Project,
  settings: AiSettings,
  fetchImpl: typeof fetch = fetch,
): Promise<PlanOutcome> {
  const rules = planFromRules(command);
  if (!settings.aiApiKey.trim()) return rules;
  if (!endpointAllowed(settings.aiBaseUrl)) return { ...rules, fallbackReason: "endpoint" };
  try {
    const modelPlan = await planWithModel(command, project, settings, fetchImpl);
    if (modelPlan.ops.length === 0) return { ...rules, fallbackReason: "empty" };
    return modelPlan;
  } catch {
    return { ...rules, fallbackReason: "error" };
  }
}
