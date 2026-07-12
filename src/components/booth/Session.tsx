"use client";

import { VideoTile } from "./VideoTile";
import { useBooth } from "@/store/booth";

interface SessionProps {
  amOwner: boolean;
  peerHere: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  onToggleMic: () => void;
  onCapture: () => void;
  onRetake: () => void;
}

export function Session({
  amOwner,
  peerHere,
  localStream,
  remoteStream,
  micOn,
  onToggleMic,
  onCapture,
  onRetake,
}: SessionProps) {
  const { room, myRole, shots, countdown, flash, cameraError } = useBooth();

  const totalShots = room?.totalShots ?? 4;
  const shotsDone = shots.filter((s) => s.a && s.b).length;
  const allDone = shotsDone >= totalShots;
  const capturing = countdown !== null;

  const memberA = room?.members.find((m) => m.role === "a");
  const memberB = room?.members.find((m) => m.role === "b");

  // strip layout order: partner A always left, B always right
  const tiles = [
    {
      role: "a" as const,
      name: memberA?.name || "partner a",
      accent: "pink" as const,
      stream: myRole === "a" ? localStream : remoteStream,
      mirror: myRole === "a",
      muted: myRole === "a",
    },
    {
      role: "b" as const,
      name: memberB?.name || "partner b",
      accent: "blue" as const,
      stream: myRole === "b" ? localStream : remoteStream,
      mirror: myRole === "b",
      muted: myRole === "b",
    },
  ];

  return (
    <div className="relative flex flex-1 flex-col items-center gap-6 py-6">
      {/* shot counter */}
      <div className="flex items-center gap-3">
        <span className="label-caps">shots</span>
        <span className="card px-4 py-1.5 font-round text-lg font-bold">
          {shotsDone} / {totalShots}
        </span>
      </div>

      {/* live tiles */}
      <div className="relative grid w-full max-w-3xl grid-cols-2 gap-3 sm:gap-5">
        {tiles.map((t) => (
          <VideoTile
            key={t.role}
            stream={t.stream}
            mirror={t.mirror}
            muted={t.muted}
            name={t.name}
            accent={t.accent}
            placeholder={t.stream ? "" : "connecting video…"}
          />
        ))}

        {/* synced countdown overlay */}
        {capturing && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span
              key={countdown}
              className="animate-pop font-round text-8xl font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
            >
              {countdown}
            </span>
          </div>
        )}

        {/* shutter flash */}
        {flash && (
          <div className="pointer-events-none absolute inset-0 z-20 animate-flash rounded-2xl bg-white" />
        )}

        {/* partner disconnected overlay */}
        {!peerHere && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl bg-ink/70 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">
              your partner dropped out 💔
            </p>
            <p className="animate-pulse2 text-xs text-white/70">
              holding the booth while they reconnect…
            </p>
          </div>
        )}
      </div>

      {cameraError && (
        <p className="max-w-md text-center text-sm text-cherry">{cameraError}</p>
      )}

      {/* controls */}
      <div className="flex items-center gap-3">
        <button onClick={onToggleMic} className="btn-ghost px-4" aria-label="toggle microphone">
          {micOn ? "🎙️ on" : "🔇 muted"}
        </button>

        {amOwner ? (
          <>
            <button
              onClick={onCapture}
              disabled={capturing || allDone || !peerHere}
              className="btn-primary px-8 text-base"
            >
              {capturing ? "hold that pose…" : `📸 take shot ${Math.min(shotsDone + 1, totalShots)}`}
            </button>
            <button
              onClick={onRetake}
              disabled={capturing || shots.length === 0}
              className="btn-ghost px-4 text-xs"
            >
              ↺ retake last
            </button>
          </>
        ) : (
          <span className="card px-4 py-3 text-xs font-medium text-muted">
            {capturing ? "smile!" : "your partner has the shutter 📸"}
          </span>
        )}
      </div>

      {/* thumbnails of captured pairs */}
      {shots.length > 0 && (
        <div className="flex w-full max-w-3xl gap-3 overflow-x-auto pb-1">
          {shots.map((pair, i) => (
            <div key={i} className="flex shrink-0 gap-1 rounded-xl bg-card p-1.5 shadow-soft">
              {(["a", "b"] as const).map((role) =>
                pair[role] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={role}
                    src={pair[role]}
                    alt={`shot ${i + 1} ${role}`}
                    className="h-14 w-[4.7rem] rounded-lg object-cover"
                  />
                ) : (
                  <div
                    key={role}
                    className="flex h-14 w-[4.7rem] animate-pulse2 items-center justify-center rounded-lg bg-ink/5 text-[10px] text-muted"
                  >
                    …
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      )}

      {allDone && (
        <p className="animate-pop text-sm font-semibold text-ink/70">
          that&apos;s all {totalShots} — heading to decorating ✨
        </p>
      )}
    </div>
  );
}
