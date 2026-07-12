/**
 * Frame (pattern theme) definitions for the photo strip.
 * Each frame has an SVG tile that is used BOTH as a CSS background for DOM
 * previews and as a canvas pattern for the final composited strip — so the
 * preview always matches the export.
 */

export interface FrameDef {
  id: string;
  label: string;
  /** flat background color behind the tile */
  bg: string;
  /** color of the date stamp / watermark text on this frame */
  stampColor: string;
  /** SVG markup of one repeatable tile */
  tile: string;
  /** tile size in px at 1080-wide strip scale */
  tileSize: number;
}

const heartPath =
  "M12 21c-.6 0-4.4-2.7-6.8-5.3C3 13.2 2 11.4 2 9.3 2 6.4 4.2 4 7 4c1.9 0 3.6 1 4.6 2.6l.4.7.4-.7C13.4 5 15.1 4 17 4c2.8 0 5 2.4 5 5.3 0 2.1-1 3.9-3.2 6.4C16.4 18.3 12.6 21 12 21z";

function svgTile(size: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;
}

export const FRAMES: FrameDef[] = [
  {
    id: "hearts",
    label: "hearts",
    bg: "#F6C6CF",
    stampColor: "#B04A61",
    tileSize: 72,
    tile: svgTile(
      72,
      `<g fill="#FF8BA0" opacity="0.9">
        <path transform="translate(6,6) scale(0.9)" d="${heartPath}"/>
        <path transform="translate(42,38) scale(0.65)" d="${heartPath}"/>
      </g>
      <g fill="#ffffff" opacity="0.8">
        <path transform="translate(44,8) scale(0.45)" d="${heartPath}"/>
        <path transform="translate(10,46) scale(0.4)" d="${heartPath}"/>
      </g>`,
    ),
  },
  {
    id: "cherry",
    label: "cherry",
    bg: "#FDF6EE",
    stampColor: "#C13842",
    tileSize: 80,
    tile: svgTile(
      80,
      `<g transform="translate(10,12)">
        <path d="M14 2 C10 8 6 10 4 16 M14 2 C16 9 20 11 22 16" stroke="#4E7A46" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <circle cx="4" cy="20" r="6" fill="#E5484D"/>
        <circle cx="22" cy="20" r="6" fill="#E5484D"/>
        <circle cx="2.2" cy="18" r="1.7" fill="#ffffff" opacity="0.75"/>
        <circle cx="20.2" cy="18" r="1.7" fill="#ffffff" opacity="0.75"/>
        <path d="M14 2 C12 0 10 0 8 1" stroke="#4E7A46" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      </g>
      <g transform="translate(48,48) scale(0.7)">
        <path d="M14 2 C10 8 6 10 4 16 M14 2 C16 9 20 11 22 16" stroke="#4E7A46" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <circle cx="4" cy="20" r="6" fill="#E5484D"/>
        <circle cx="22" cy="20" r="6" fill="#E5484D"/>
      </g>`,
    ),
  },
  {
    id: "gingham",
    label: "gingham",
    bg: "#EDF3EA",
    stampColor: "#54704C",
    tileSize: 48,
    tile: svgTile(
      48,
      `<rect x="0" y="0" width="24" height="24" fill="#A8C3A0" opacity="0.85"/>
       <rect x="24" y="24" width="24" height="24" fill="#A8C3A0" opacity="0.85"/>
       <rect x="24" y="0" width="24" height="24" fill="#A8C3A0" opacity="0.35"/>
       <rect x="0" y="24" width="24" height="24" fill="#A8C3A0" opacity="0.35"/>`,
    ),
  },
  {
    id: "dots",
    label: "dots",
    bg: "#F7D774",
    stampColor: "#8A6D1B",
    tileSize: 44,
    tile: svgTile(
      44,
      `<circle cx="11" cy="11" r="5.5" fill="#ffffff" opacity="0.95"/>
       <circle cx="33" cy="33" r="5.5" fill="#ffffff" opacity="0.95"/>`,
    ),
  },
  {
    id: "lemon",
    label: "lemon",
    bg: "#FFFBEA",
    stampColor: "#9C8A21",
    tileSize: 84,
    tile: svgTile(
      84,
      `<g transform="translate(10,14) rotate(-18 16 12)">
        <ellipse cx="16" cy="12" rx="15" ry="10.5" fill="#F7D774"/>
        <ellipse cx="16" cy="12" rx="15" ry="10.5" fill="none" stroke="#E8C24A" stroke-width="1.6"/>
        <circle cx="31.5" cy="12" r="2.4" fill="#F7D774" stroke="#E8C24A" stroke-width="1.4"/>
        <path d="M6 4 C10 7 12 7 15 5" stroke="#7FA36B" stroke-width="2.4" fill="none" stroke-linecap="round"/>
       </g>
       <g transform="translate(48,52) rotate(14 13 10) scale(0.8)">
        <ellipse cx="16" cy="12" rx="15" ry="10.5" fill="#F7D774"/>
        <ellipse cx="16" cy="12" rx="15" ry="10.5" fill="none" stroke="#E8C24A" stroke-width="1.6"/>
       </g>`,
    ),
  },
];

export const DEFAULT_FRAME_ID = FRAMES[0].id;

export function getFrame(id: string): FrameDef {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

/** data URI for CSS background-image use */
export function frameTileUrl(frame: FrameDef): string {
  return `url("data:image/svg+xml,${encodeURIComponent(frame.tile)}")`;
}

/** load the tile as an HTMLImageElement for canvas patterns */
export function loadFrameTile(frame: FrameDef): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load frame tile: ${frame.id}`));
    img.src = `data:image/svg+xml,${encodeURIComponent(frame.tile)}`;
  });
}
