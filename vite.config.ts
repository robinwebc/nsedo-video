import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig(({ mode }) => {
  const capacitor = process.env.CAPACITOR === "1";
  return {
    base: capacitor || mode !== "production" ? "/" : "/nsedo-video/",
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      headers: isolation,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      headers: isolation,
    },
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  };
});
