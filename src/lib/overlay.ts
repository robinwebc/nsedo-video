import type { TextPosition, TextSize } from "../core/types";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.slice(0, 6);
}

export async function renderOverlayPng(options: {
  width: number;
  height: number;
  text: string;
  position: TextPosition;
  size: TextSize;
}): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const fontPx =
    options.size === "lg"
      ? Math.round(options.width * 0.052)
      : options.size === "sm"
        ? Math.round(options.width * 0.03)
        : Math.round(options.width * 0.04);
  try {
    await document.fonts.load(`600 ${fontPx}px "Noto Sans Bengali"`);
  } catch {
    /* draw with the fallback face */
  }
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.font = `600 ${fontPx}px "Noto Sans Bengali", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = options.width * 0.84;
  const lines = wrap(ctx, options.text, maxWidth);
  const lineHeight = fontPx * 1.34;
  const blockHeight = lines.length * lineHeight;
  const textWidth = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line).width), fontPx));
  const padX = fontPx * 0.72;
  const padY = fontPx * 0.42;
  const boxWidth = textWidth + padX * 2;
  const boxHeight = blockHeight + padY * 2;
  const boxX = (options.width - boxWidth) / 2;
  const top =
    options.position === "top"
      ? options.height * 0.1
      : options.position === "bottom"
        ? options.height - options.height * 0.1 - boxHeight
        : (options.height - boxHeight) / 2;
  ctx.fillStyle = "rgba(20, 32, 43, 0.8)";
  ctx.beginPath();
  ctx.roundRect(boxX, top, boxWidth, boxHeight, Math.min(14, fontPx * 0.35));
  ctx.fill();
  ctx.fillStyle = "#F7F8FA";
  lines.forEach((line, index) => {
    ctx.fillText(line, options.width / 2, top + padY + lineHeight * index + lineHeight / 2, maxWidth);
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("png"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}
