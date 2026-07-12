import type { CSSProperties } from "react";
import { frameTileUrl, getFrame } from "@/lib/frames";

interface StripPreviewProps {
  frameId: string;
  rows?: number;
  /** css width, e.g. "9rem" */
  width?: string;
  /** optional cell contents (image data URLs, row-major a,b,a,b…) */
  images?: (string | undefined)[];
  /** decorative emoji per cell when no images (defaults provided) */
  emojis?: string[];
  className?: string;
}

const DEFAULT_EMOJIS = ["🥰", "😚", "🤞", "💞", "😂", "🫶", "😜", "📸"];

/**
 * A miniature vertical photo strip rendered in DOM — same pattern tile the
 * canvas compositor uses, so the preview matches the export.
 */
export function StripPreview({
  frameId,
  rows = 4,
  width = "9rem",
  images,
  emojis = DEFAULT_EMOJIS,
  className = "",
}: StripPreviewProps) {
  const frame = getFrame(frameId);
  const outer: CSSProperties = {
    width,
    backgroundColor: frame.bg,
    backgroundImage: frameTileUrl(frame),
    backgroundSize: `${frame.tileSize / 3}px`,
  };
  const cells = Array.from({ length: rows * 2 });

  return (
    <div
      className={`rounded-xl p-2.5 shadow-lift ${className}`}
      style={outer}
    >
      <div className="grid grid-cols-2 gap-1.5">
        {cells.map((_, i) => {
          const src = images?.[i];
          return (
            <div
              key={i}
              className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-white"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm opacity-80">{emojis[i % emojis.length]}</span>
              )}
            </div>
          );
        })}
      </div>
      <p
        className="pt-2 text-center text-[7px] font-semibold tracking-wide"
        style={{ color: frame.stampColor }}
      >
        ♡ getalexa
      </p>
    </div>
  );
}
