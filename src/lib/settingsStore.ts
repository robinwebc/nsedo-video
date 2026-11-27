import { defaultAiSettings, type AiSettings } from "../core/agent";

const KEY = "nsedo.settings.v1";

function envSettings(): Partial<AiSettings> {
  return {
    aiBaseUrl: import.meta.env.VITE_AI_BASE_URL || undefined,
    aiModel: import.meta.env.VITE_AI_MODEL || undefined,
    aiApiKey: import.meta.env.VITE_AI_API_KEY || undefined,
    whisperBaseUrl: import.meta.env.VITE_WHISPER_BASE_URL || undefined,
    whisperModel: import.meta.env.VITE_WHISPER_MODEL || undefined,
    whisperApiKey: import.meta.env.VITE_WHISPER_API_KEY || undefined,
  };
}

export function loadSettings(): AiSettings {
  let stored: Partial<AiSettings> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as Partial<AiSettings>;
  } catch {
    stored = {};
  }
  const env = envSettings();
  return {
    aiBaseUrl: stored.aiBaseUrl || env.aiBaseUrl || defaultAiSettings.aiBaseUrl,
    aiApiKey: stored.aiApiKey || env.aiApiKey || "",
    aiModel: stored.aiModel || env.aiModel || defaultAiSettings.aiModel,
    whisperBaseUrl: stored.whisperBaseUrl || env.whisperBaseUrl || defaultAiSettings.whisperBaseUrl,
    whisperApiKey: stored.whisperApiKey || env.whisperApiKey || "",
    whisperModel: stored.whisperModel || env.whisperModel || defaultAiSettings.whisperModel,
  };
}

export function saveSettings(settings: AiSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
