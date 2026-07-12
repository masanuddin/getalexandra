/**
 * Canvas compositing for the photo strip.
 *
 * The strip is always laid out in "strip units" derived from STRIP_WIDTH so
 * the on-screen editor preview and the exported PNG share exact geometry —
 * stickers and strokes are stored in normalized (0..1) strip coordinates.
 */

import { getFrame, loadFrameTile } from "./frames";
import { getSticker, loadStickerImage } from "./stickers";
import type { PlacedSticker, ShotPair, Stroke } from "./types";

export const STRIP_WIDTH = 1080;
const BORDER = 64;
const GUTTER = 22;
const CELL_RADIUS = 26;
const CELL_ASPECT = 3 / 4; // h / w — each still is a 4:3 landscape crop
const FOOTER = 150;

export interface StripLayout {
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  rows: number;
  cells: { x: number; y: number; w: number; h: number; role: "a" | "b"; row: number }[];
  footerY: number;
}

export function computeLayout(rows: number): StripLayout {
  const cellW = (STRIP_WIDTH - BORDER * 2 - GUTTER) / 2;
  const cellH = Math.round(cellW * CELL_ASPECT);
  const height = BORDER + rows * cellH + (rows - 1) * GUTTER + FOOTER;
  const cells: StripLayout["cells"] = [];
  for (let r = 0; r < rows; r++) {
    const y = BORDER + r * (cellH + GUTTER);
    cells.push({ x: BORDER, y, w: cellW, h: cellH, role: "a", row: r });
    cells.push({ x: BORDER + cellW + GUTTER, y, w: cellW, h: cellH, role: "b", row: r });
  }
  return {
    width: STRIP_WIDTH,
    height,
    cellW,
    cellH,
    rows,
    cells,
    footerY: BORDER + rows * cellH + (rows - 1) * GUTTER,
  };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to decode still"));
    img.src = src;
  });
}

/** draw an image center-cropped ("cover") into a rounded cell */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, CELL_RADIUS);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function formatDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/**
 * Render the base strip: pattern frame, both partners' stills per row,
 * date stamp and watermark. Returns the canvas for further layering.
 */
export async function renderBaseStrip(
  shots: ShotPair[],
  frameId: string,
  canvas?: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const rows = Math.max(shots.length, 1);
  const layout = computeLayout(rows);
  const frame = getFrame(frameId);

  const cnv = canvas ?? document.createElement("canvas");
  cnv.width = layout.width;
  cnv.height = layout.height;
  const ctx = cnv.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // frame background: flat color + repeating pattern tile
  ctx.fillStyle = frame.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  try {
    const tile = await loadFrameTile(frame);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, layout.width, layout.height);
    }
  } catch {
    // flat color is an acceptable fallback
  }

  // cells
  const stillCache = new Map<string, HTMLImageElement>();
  for (const cell of layout.cells) {
    const dataUrl = shots[cell.row]?.[cell.role];

    // white mat behind each cell so the pattern doesn't bleed through gaps
    ctx.save();
    roundedRectPath(ctx, cell.x - 6, cell.y - 6, cell.w + 12, cell.h + 12, CELL_RADIUS + 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    if (dataUrl) {
      let img = stillCache.get(dataUrl);
      if (!img) {
        img = await loadImage(dataUrl);
        stillCache.set(dataUrl, img);
      }
      drawCover(ctx, img, cell.x, cell.y, cell.w, cell.h);
    } else {
      ctx.save();
      roundedRectPath(ctx, cell.x, cell.y, cell.w, cell.h, CELL_RADIUS);
      ctx.fillStyle = "#F1EDE6";
      ctx.fill();
      ctx.restore();
    }
  }

  // footer: date stamp + watermark
  const centerX = layout.width / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = frame.stampColor;
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  ctx.fillText(formatDate(), centerX, layout.footerY + 62);
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.globalAlpha = 0.75;
  ctx.fillText("♡ getalexandra photobooth", centerX, layout.footerY + 102);
  ctx.globalAlpha = 1;

  return cnv;
}

/** draw freehand strokes (normalized coords) onto a strip-sized context */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * width;
    ctx.beginPath();
    const [first, ...rest] = stroke.points;
    ctx.moveTo(first.x * width, first.y * height);
    if (rest.length === 0) {
      ctx.lineTo(first.x * width + 0.01, first.y * height);
    }
    for (const p of rest) ctx.lineTo(p.x * width, p.y * height);
    ctx.stroke();
  }
  ctx.restore();
}

/** draw placed stickers (normalized transforms) onto a strip-sized context */
export async function drawStickers(
  ctx: CanvasRenderingContext2D,
  stickers: PlacedSticker[],
  width: number,
) {
  for (const placed of stickers) {
    const def = getSticker(placed.stickerId);
    const img = await loadStickerImage(def);
    const w = placed.scale * width;
    const h = w * def.aspect;
    ctx.save();
    ctx.translate(placed.x * width, placed.y * ctx.canvas.height);
    ctx.rotate((placed.rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

/** full export: base strip + drawing + stickers → PNG data URL */
export async function exportStrip(
  shots: ShotPair[],
  frameId: string,
  stickers: PlacedSticker[],
  strokes: Stroke[],
): Promise<string> {
  const canvas = await renderBaseStrip(shots, frameId);
  const ctx = canvas.getContext("2d")!;
  drawStrokes(ctx, strokes, canvas.width, canvas.height);
  await drawStickers(ctx, stickers, canvas.width);
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// High-res still capture from the local camera
// ---------------------------------------------------------------------------

/**
 * Cloudflare caps a single WebSocket message at 1 MiB, so a still (sent as a
 * base64 data URL inside a JSON frame) must stay comfortably under that.
 */
const MAX_STILL_CHARS = 900_000;

/**
 * Grab a full-resolution still from a playing <video> backed by the LOCAL
 * getUserMedia stream (never the compressed WebRTC feed). The frame is
 * center-cropped to the strip's cell aspect and mirrored to match the
 * selfie preview the user was posing against. If the encoded still would
 * exceed the realtime message limit, quality then resolution are stepped
 * down until it fits (still far above WebRTC-frame quality).
 */
export function captureStill(video: HTMLVideoElement, quality = 0.92): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("camera stream not ready");

  // crop the source to 4:3 (cell aspect), centered
  const targetAspect = 1 / CELL_ASPECT; // w / h
  let sw = vw;
  let sh = vh;
  if (vw / vh > targetAspect) {
    sw = Math.round(vh * targetAspect);
  } else {
    sh = Math.round(vw / targetAspect);
  }
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  let canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(sw, 0);
  ctx.scale(-1, 1); // mirror to match the preview
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > MAX_STILL_CHARS && q > 0.6) {
    q -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  while (dataUrl.length > MAX_STILL_CHARS && canvas.width > 640) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.round(canvas.width * 0.8);
    smaller.height = Math.round(canvas.height * 0.8);
    smaller.getContext("2d")!.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
