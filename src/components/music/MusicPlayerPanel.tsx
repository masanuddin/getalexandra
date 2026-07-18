"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  FADE_DURATION_MS,
  useMusicPlayer,
} from "@/components/music/MusicPlayerProvider";

// vertical position of the desktop panel, in vh from the top of the viewport
const PANEL_TOP_VH = 20;

function Controls({
  isPlaying,
  toggle,
  next,
  prev,
  className,
}: {
  isPlaying: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 md:gap-2 ${className ?? ""}`}>
      <button
        type="button"
        aria-label="previous track"
        onClick={prev}
        className="rounded-xl p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink md:p-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M3 2h2v12H3zM13 2v12L5.5 8z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={isPlaying ? "pause" : "play"}
        onClick={toggle}
        className="rounded-xl bg-ink p-2 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 md:p-2.5"
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M4 2l10 6-10 6z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        aria-label="next track"
        onClick={next}
        className="rounded-xl p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink md:p-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M11 2h2v12h-2zM3 2l7.5 6L3 14z" />
        </svg>
      </button>
    </div>
  );
}

// osu!-style "now playing" popup; audio lives in MusicPlayerProvider, this is
// just the visible panel. It accompanies the user from the landing page
// through room create/join, fades out on actual room entry, and stays gone
// for the rest of the session (isDismissed).
export function MusicPlayerPanel() {
  const {
    song,
    trackIndex,
    isPlaying,
    progress,
    isFadingOut,
    isDismissed,
    toggle,
    next,
    prev,
    seek,
  } = useMusicPlayer();
  const [coverBroken, setCoverBroken] = useState(false);

  useEffect(() => setCoverBroken(false), [trackIndex]);

  if (isDismissed) return null;

  return (
    <aside
      aria-label="now playing"
      style={
        {
          "--panel-top": `${PANEL_TOP_VH}vh`,
          "--fade-ms": `${FADE_DURATION_MS}ms`,
        } as CSSProperties
      }
      className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 max-w-full animate-playerin rounded-2xl border border-ink/5 bg-card/80 p-2.5 shadow-soft backdrop-blur-md transition-opacity duration-[var(--fade-ms)] ease-out motion-reduce:animate-none md:inset-x-auto md:bottom-auto md:left-6 md:top-[var(--panel-top)] md:w-64 md:p-3 ${
        isFadingOut ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-3">
        {coverBroken ? (
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blush/50 text-xl text-pinky md:h-16 md:w-16 md:rounded-xl md:text-2xl"
          >
            ♪
          </div>
        ) : (
          // plain <img>: covers may be remote URLs not in next/image's allowlist
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={song.cover}
            alt={`${song.title} cover art`}
            onError={() => setCoverBroken(true)}
            className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-soft md:h-16 md:w-16 md:rounded-xl"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="label-caps hidden text-[9px] md:block">now playing</p>
          {/* keyed by track so the "announce" animation replays on change */}
          <div key={trackIndex} className="animate-trackin motion-reduce:animate-none">
            <p className="truncate text-sm font-bold">{song.title}</p>
            <p className="truncate text-xs text-muted">{song.artist}</p>
          </div>
        </div>

        {/* mobile: controls sit inline so the bottom bar stays one row tall */}
        <Controls
          isPlaying={isPlaying}
          toggle={toggle}
          next={next}
          prev={prev}
          className="md:hidden"
        />
      </div>

      <button
        type="button"
        aria-label="seek"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width);
        }}
        className="mt-2 block h-3 w-full cursor-pointer py-1 md:mt-3"
      >
        <span className="block h-1 w-full overflow-hidden rounded-full bg-ink/10">
          <span
            className="block h-full rounded-full bg-pinky"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </button>

      <Controls
        isPlaying={isPlaying}
        toggle={toggle}
        next={next}
        prev={prev}
        className="mt-1 hidden justify-center md:flex"
      />
    </aside>
  );
}
