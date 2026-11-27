import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/@ffmpeg/core");
const dest = path.resolve("public/ffmpeg");
mkdirSync(dest, { recursive: true });
copyFileSync(path.join(root, "dist/esm/ffmpeg-core.js"), path.join(dest, "ffmpeg-core.js"));
copyFileSync(path.join(root, "dist/esm/ffmpeg-core.wasm"), path.join(dest, "ffmpeg-core.wasm"));
console.log("ffmpeg core copied to public/ffmpeg");
