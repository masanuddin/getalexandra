"use client";

import { useEffect, useRef } from "react";

interface VideoTileProps {
  stream: MediaStream | null;
  /** mirror for the local selfie preview */
  mirror?: boolean;
  /** local tiles must be muted to avoid feedback */
  muted?: boolean;
  name: string;
  accent: "pink" | "blue";
  placeholder?: string;
}

export function VideoTile({
  stream,
  mirror = false,
  muted = false,
  name,
  accent,
  placeholder = "waiting…",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  const color = accent === "pink" ? "var(--pink)" : "var(--blue)";

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink/90 shadow-soft">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${mirror ? "mirror" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="animate-pulse2 text-xs font-medium text-white/60">
            {placeholder}
          </span>
        </div>
      )}
      <span
        className="absolute bottom-2.5 left-2.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-soft"
        style={{ background: color }}
      >
        {name}
      </span>
    </div>
  );
}
