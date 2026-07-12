/**
 * Hand-drawn-style sticker set. Plain SVG strings so they render identically
 * as DOM previews (via data URI) and on the export canvas (via Image).
 */

export interface StickerDef {
  id: string;
  label: string;
  svg: string;
  /** natural aspect ratio (h / w) so placement math stays correct */
  aspect: number;
}

const S = (w: number, h: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

export const STICKERS: StickerDef[] = [
  {
    id: "heart",
    label: "heart",
    aspect: 1,
    svg: S(
      64,
      64,
      `<path d="M32 54 C28 51 10 39 7 26 C5 16 12 9 20 9 C25 9 29 12 32 17 C35 12 39 9 44 9 C52 9 59 16 57 26 C54 39 36 51 32 54 Z"
        fill="#FF8BA0" stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M15 22 C15 18 18 15 21 15" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "bow",
    label: "bow",
    aspect: 0.72,
    svg: S(
      72,
      52,
      `<g stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round">
        <path d="M30 26 C22 12 10 8 7 14 C4 20 10 34 18 36 C24 38 28 32 30 26 Z" fill="#FF8BA0"/>
        <path d="M42 26 C50 12 62 8 65 14 C68 20 62 34 54 36 C48 38 44 32 42 26 Z" fill="#FF8BA0"/>
        <path d="M28 30 C24 38 22 44 24 47 M44 30 C48 38 50 44 48 47" fill="none" stroke-linecap="round"/>
        <rect x="29" y="20" width="14" height="13" rx="5" fill="#FFB7C5"/>
       </g>
       <path d="M13 17 C11 19 10 22 11 25" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "ribbon",
    label: "ribbon",
    aspect: 0.6,
    svg: S(
      80,
      48,
      `<g stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round">
        <path d="M34 24 C24 10 8 8 6 16 C4 24 16 36 26 34 C31 33 33 28 34 24 Z" fill="#5B9BFF"/>
        <path d="M46 24 C56 10 72 8 74 16 C76 24 64 36 54 34 C49 33 47 28 46 24 Z" fill="#5B9BFF"/>
        <circle cx="40" cy="24" r="7" fill="#9CC1FF"/>
       </g>
       <path d="M12 15 C10 17 9 19 10 22" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "bunny",
    label: "bunny",
    aspect: 1.15,
    svg: S(
      60,
      69,
      `<g stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round">
        <ellipse cx="21" cy="16" rx="7" ry="14" fill="#ffffff"/>
        <ellipse cx="39" cy="16" rx="7" ry="14" fill="#ffffff"/>
        <ellipse cx="21" cy="17" rx="3" ry="9" fill="#FFB7C5" stroke="none"/>
        <ellipse cx="39" cy="17" rx="3" ry="9" fill="#FFB7C5" stroke="none"/>
        <circle cx="30" cy="42" r="22" fill="#ffffff"/>
       </g>
       <circle cx="22" cy="40" r="2.6" fill="#1A1A1A"/>
       <circle cx="38" cy="40" r="2.6" fill="#1A1A1A"/>
       <path d="M27 48 C29 50 31 50 33 48" stroke="#1A1A1A" stroke-width="2.4" fill="none" stroke-linecap="round"/>
       <ellipse cx="30" cy="46" rx="2.4" ry="1.8" fill="#FF8BA0"/>
       <circle cx="15" cy="47" r="3.5" fill="#FFB7C5" opacity="0.9"/>
       <circle cx="45" cy="47" r="3.5" fill="#FFB7C5" opacity="0.9"/>`,
    ),
  },
  {
    id: "bear",
    label: "bear",
    aspect: 1.05,
    svg: S(
      62,
      65,
      `<g stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round">
        <circle cx="14" cy="14" r="9" fill="#D9A066"/>
        <circle cx="48" cy="14" r="9" fill="#D9A066"/>
        <circle cx="14" cy="14" r="4" fill="#F2C894" stroke="none"/>
        <circle cx="48" cy="14" r="4" fill="#F2C894" stroke="none"/>
        <circle cx="31" cy="38" r="23" fill="#D9A066"/>
        <ellipse cx="31" cy="46" rx="10" ry="8" fill="#F2C894" stroke="none"/>
       </g>
       <circle cx="23" cy="35" r="2.6" fill="#1A1A1A"/>
       <circle cx="39" cy="35" r="2.6" fill="#1A1A1A"/>
       <ellipse cx="31" cy="43" rx="3" ry="2.2" fill="#1A1A1A"/>
       <path d="M31 45 C31 48 29 49 27 49 M31 45 C31 48 33 49 35 49" stroke="#1A1A1A" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    id: "cherry",
    label: "cherry",
    aspect: 1.08,
    svg: S(
      60,
      65,
      `<path d="M32 6 C26 16 18 20 15 32 M32 6 C36 18 44 22 46 32" stroke="#4E7A46" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M32 6 C29 3 25 2 21 4" stroke="#4E7A46" stroke-width="3" fill="none" stroke-linecap="round"/>
       <g stroke="#1A1A1A" stroke-width="2.5">
        <circle cx="15" cy="43" r="11" fill="#E5484D"/>
        <circle cx="45" cy="43" r="11" fill="#E5484D"/>
       </g>
       <circle cx="11" cy="39" r="3" fill="#ffffff" opacity="0.85"/>
       <circle cx="41" cy="39" r="3" fill="#ffffff" opacity="0.85"/>`,
    ),
  },
  {
    id: "sparkle",
    label: "sparkle",
    aspect: 1,
    svg: S(
      56,
      56,
      `<path d="M28 4 C30 16 34 22 46 26 C34 30 30 36 28 48 C26 36 22 30 10 26 C22 22 26 16 28 4 Z"
        fill="#F7D774" stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round"/>
       <circle cx="45" cy="10" r="3" fill="#FF8BA0"/>
       <circle cx="10" cy="45" r="2.4" fill="#5B9BFF"/>`,
    ),
  },
  {
    id: "heart-blue",
    label: "blue heart",
    aspect: 1,
    svg: S(
      64,
      64,
      `<path d="M32 54 C28 51 10 39 7 26 C5 16 12 9 20 9 C25 9 29 12 32 17 C35 12 39 9 44 9 C52 9 59 16 57 26 C54 39 36 51 32 54 Z"
        fill="#5B9BFF" stroke="#1A1A1A" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M15 22 C15 18 18 15 21 15" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    ),
  },
];

export function getSticker(id: string): StickerDef {
  return STICKERS.find((s) => s.id === id) ?? STICKERS[0];
}

export function stickerDataUrl(sticker: StickerDef): string {
  return `data:image/svg+xml,${encodeURIComponent(sticker.svg)}`;
}

const stickerImageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadStickerImage(sticker: StickerDef): Promise<HTMLImageElement> {
  let cached = stickerImageCache.get(sticker.id);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load sticker: ${sticker.id}`));
      img.src = stickerDataUrl(sticker);
    });
    stickerImageCache.set(sticker.id, cached);
  }
  return cached;
}
