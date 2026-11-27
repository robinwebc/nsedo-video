export function readVideoMeta(file: Blob): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const meta = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    video.src = url;
  });
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, type = "text/plain"): void {
  downloadBytes(new TextEncoder().encode(text), filename, type);
}

export function fileTitle(name: string): string {
  const bare = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return bare.slice(0, 48) || "নতুন প্রজেক্ট";
}
