"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PLAYLIST, type Song } from "@/data/playlist";

// fade-out-on-room-enter tuning
const FADE_START_DELAY_MS = 0; // delay after room entry before the fade begins
export const FADE_DURATION_MS = 2000; // how long the fade takes (audio + popup)

type MusicPlayerContextValue = {
  song: Song;
  trackIndex: number;
  isPlaying: boolean;
  /** 0..1 fraction of the current track */
  progress: number;
  currentTime: number;
  duration: number;
  /** fade is running: panel should transition its opacity to 0 */
  isFadingOut: boolean;
  /** fade finished: panel stays unmounted for the rest of the session */
  isDismissed: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  /** seek to a 0..1 fraction of the track */
  seek: (fraction: number) => void;
  /** call on successful room entry; idempotent */
  fadeOutAndStop: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return ctx;
}

// Mounted at the root layout so the <audio> element survives navigation;
// only the visible panel (MusicPlayerPanel) decides when to show itself.
export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // once true, the player never plays or reappears again this session
  // (resets only on a full page refresh)
  const hasEnteredRoomRef = useRef(false);

  // Web Audio graph for the room-entry fade. Created lazily and only once:
  // createMediaElementSource throws if called twice on the same element, and
  // we don't want to reroute audio at all until the fade actually starts.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const song = PLAYLIST[trackIndex];

  // hybrid autoplay: try immediately; if the browser's autoplay policy blocks
  // it, start on the first real user gesture (mousemove doesn't unlock audio)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const gestures = ["click", "keydown", "touchstart", "pointerdown"] as const;
    const onFirstGesture = () => {
      removeListeners();
      if (!hasEnteredRoomRef.current) audio.play().catch(() => {});
    };
    const removeListeners = () =>
      gestures.forEach((e) => document.removeEventListener(e, onFirstGesture));
    audio.play().catch(() => {
      gestures.forEach((e) => document.addEventListener(e, onFirstGesture));
    });
    return removeListeners;
  }, []);

  // drive progress from rAF while playing — smooth, real-time bar movement
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setCurrentTime(audio.currentTime);
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // when the track changes (buttons or track end), keep playing the new src
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setCurrentTime(0);
    setDuration(0);
    if (!hasEnteredRoomRef.current) audioRef.current?.play().catch(() => {});
  }, [trackIndex]);

  const next = useCallback(
    () => setTrackIndex((i) => (i + 1) % PLAYLIST.length),
    [],
  );
  const prev = useCallback(
    () => setTrackIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length),
    [],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const t = Math.min(Math.max(fraction, 0), 1) * audio.duration;
    audio.currentTime = t;
    setCurrentTime(t); // reflect immediately, even while paused
  }, []);

  // Fade the music out via a GainNode rather than HTMLMediaElement.volume:
  // iOS Safari ignores .volume writes, which would turn the fade into an
  // abrupt cut on iPhone. The mp3s are same-origin (/public), so routing the
  // element through createMediaElementSource has no CORS issues.
  const fadeOutAndStop = useCallback(() => {
    if (hasEnteredRoomRef.current) return; // create + join + reconnects all call this
    hasEnteredRoomRef.current = true;

    window.setTimeout(() => {
      const audio = audioRef.current;
      setIsFadingOut(true);

      try {
        if (!audioCtxRef.current && audio) {
          const Ctx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const gain = ctx.createGain();
            ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
            audioCtxRef.current = ctx;
            gainRef.current = gain;
          }
        }
        const ctx = audioCtxRef.current;
        const gain = gainRef.current;
        if (ctx && gain) {
          ctx.resume().catch(() => {});
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + FADE_DURATION_MS / 1000);
        }
      } catch {
        // no Web Audio → the pause below still stops the music, just less softly
      }

      window.setTimeout(() => {
        audio?.pause();
        setIsDismissed(true);
      }, FADE_DURATION_MS);
    }, FADE_START_DELAY_MS);
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        song,
        trackIndex,
        isPlaying,
        progress: duration > 0 ? currentTime / duration : 0,
        currentTime,
        duration,
        isFadingOut,
        isDismissed,
        toggle,
        next,
        prev,
        seek,
        fadeOutAndStop,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        src={song.src}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={next}
      />
    </MusicPlayerContext.Provider>
  );
}
