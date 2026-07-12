interface CursorChipProps {
  who: "me" | "you";
  className?: string;
}

/** Floating live-cursor chip — pink "Me" / blue "You" multiplayer signal. */
export function CursorChip({ who, className = "" }: CursorChipProps) {
  const isMe = who === "me";
  const color = isMe ? "var(--pink)" : "var(--blue)";
  return (
    <div className={`pointer-events-none select-none ${className}`} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-sm">
        <path
          d="M5 3 L19 12 L12.5 13.5 L9.5 20 Z"
          fill={color}
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ml-4 -mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold text-white shadow-soft"
        style={{ background: color }}
      >
        {isMe ? "Me" : "You"}
      </span>
    </div>
  );
}
