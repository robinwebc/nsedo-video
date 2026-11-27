/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_MODEL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_WHISPER_BASE_URL?: string;
  readonly VITE_WHISPER_MODEL?: string;
  readonly VITE_WHISPER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  coi?: {
    shouldRegister?: () => boolean;
    shouldDeregister?: () => boolean;
    coepCredentialless?: () => boolean;
    quiet?: boolean;
  };
}
