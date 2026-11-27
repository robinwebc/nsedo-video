import { Capacitor, registerPlugin } from "@capacitor/core";

export interface RunResult {
  code: number;
  log: string;
}

export interface FfmpegEngine {
  kind: "wasm" | "native";
  put(name: string, data: Uint8Array): Promise<string>;
  path(name: string): Promise<string>;
  read(name: string): Promise<Uint8Array>;
  remove(name: string): Promise<void>;
  run(args: string[], onProgress?: (ratio: number) => void): Promise<RunResult>;
  encoders(): Promise<string>;
  saveVideo(name: string, displayName: string): Promise<string | null>;
}

interface NativeFfmpeg {
  put(options: { name: string; data: string; append: boolean }): Promise<{ path: string }>;
  path(options: { name: string }): Promise<{ path: string }>;
  read(options: { name: string; offset: number; length: number }): Promise<{ data: string; size: number }>;
  remove(options: { name: string }): Promise<void>;
  run(options: { args: string[] }): Promise<{ code: number; log: string }>;
  encoders(): Promise<{ log: string }>;
  saveVideo(options: { name: string; displayName: string }): Promise<{ uri: string }>;
}

const Native = registerPlugin<NativeFfmpeg>("NsedoFfmpeg");

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleaned || cleaned.includes("..")) throw new Error("bad filename");
  return cleaned;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function nativeEngine(): FfmpegEngine {
  return {
    kind: "native",
    async put(name, data) {
      const safe = safeName(name);
      const chunk = 256 * 1024;
      let path = "";
      if (data.length === 0) {
        const created = await Native.put({ name: safe, data: "", append: false });
        return created.path;
      }
      for (let offset = 0; offset < data.length; offset += chunk) {
        const created = await Native.put({
          name: safe,
          data: bytesToBase64(data.subarray(offset, offset + chunk)),
          append: offset > 0,
        });
        path = created.path;
      }
      return path;
    },
    async path(name) {
      const result = await Native.path({ name: safeName(name) });
      return result.path;
    },
    async read(name) {
      const safe = safeName(name);
      const probe = await Native.read({ name: safe, offset: 0, length: 0 });
      const size = probe.size ?? 0;
      const out = new Uint8Array(size);
      const chunk = 256 * 1024;
      for (let offset = 0; offset < size; offset += chunk) {
        const part = await Native.read({ name: safe, offset, length: Math.min(chunk, size - offset) });
        out.set(base64ToBytes(part.data), offset);
      }
      return out;
    },
    async remove(name) {
      await Native.remove({ name: safeName(name) });
    },
    async run(args) {
      const result = await Native.run({ args });
      return { code: result.code, log: result.log ?? "" };
    },
    async encoders() {
      const result = await Native.encoders();
      return result.log ?? "";
    },
    async saveVideo(name, displayName) {
      const result = await Native.saveVideo({ name: safeName(name), displayName });
      return result.uri;
    },
  };
}

type FfmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

let wasmPromise: Promise<FfmpegInstance> | null = null;

async function loadWasm(): Promise<FfmpegInstance> {
  if (typeof SharedArrayBuffer === "undefined") {
    throw new Error("This browser cannot run the on-device encoder (SharedArrayBuffer is unavailable).");
  }
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      const base = `${import.meta.env.BASE_URL}ffmpeg`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  try {
    return await wasmPromise;
  } catch (error) {
    wasmPromise = null;
    throw error;
  }
}

function wasmEngine(): FfmpegEngine {
  const files = new Map<string, string>();
  return {
    kind: "wasm",
    async put(name, data) {
      const safe = safeName(name);
      const ffmpeg = await loadWasm();
      await ffmpeg.writeFile(safe, data);
      files.set(safe, safe);
      return safe;
    },
    async path(name) {
      return safeName(name);
    },
    async read(name) {
      const ffmpeg = await loadWasm();
      const data = await ffmpeg.readFile(safeName(name));
      if (typeof data === "string") return new TextEncoder().encode(data);
      return data;
    },
    async remove(name) {
      const safe = safeName(name);
      const ffmpeg = await loadWasm();
      try {
        await ffmpeg.deleteFile(safe);
      } catch {
        /* already gone */
      }
      files.delete(safe);
    },
    async run(args, onProgress) {
      const ffmpeg = await loadWasm();
      const lines: string[] = [];
      const onLog = ({ message }: { message: string }) => {
        lines.push(message);
      };
      const onRatio = ({ progress }: { progress: number }) => {
        if (onProgress && Number.isFinite(progress)) onProgress(Math.max(0, Math.min(1, progress)));
      };
      ffmpeg.on("log", onLog);
      ffmpeg.on("progress", onRatio);
      try {
        const code = await ffmpeg.exec(args);
        return { code, log: lines.join("\n") };
      } finally {
        ffmpeg.off("log", onLog);
        ffmpeg.off("progress", onRatio);
      }
    },
    async encoders() {
      const result = await this.run(["-encoders"]);
      return result.log;
    },
    async saveVideo() {
      return null;
    },
  };
}

export function getEngine(): FfmpegEngine {
  return Capacitor.isNativePlatform() ? nativeEngine() : wasmEngine();
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
