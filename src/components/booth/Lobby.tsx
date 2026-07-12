"use client";

import { useState } from "react";
import { VideoTile } from "./VideoTile";
import { useBooth } from "@/store/booth";

interface LobbyProps {
  code: string;
  amOwner: boolean;
  peerHere: boolean;
  localStream: MediaStream | null;
  onNext: () => void;
}

export function Lobby({ code, amOwner, peerHere, localStream, onNext }: LobbyProps) {
  const { cameraError, room, myRole } = useBooth();
  const [copied, setCopied] = useState(false);

  const me = room?.members.find((m) => m.role === myRole);
  const peer = room?.members.find((m) => m.role !== myRole);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/room?code=${code}`
      : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(
        `come take photos with me 📸💗 ${inviteLink}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link:", inviteLink);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7 py-8">
      <div className="text-center">
        <p className="label-caps">room {code}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {peerHere ? (
            <>
              connected <span className="text-pinky">💗</span>
            </>
          ) : (
            "waiting for your other half…"
          )}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {peerHere
            ? `${peer?.name ?? "your partner"} is here. Get cute, then head to themes.`
            : "send them the invite — the booth needs both of you."}
        </p>
      </div>

      {/* camera preview — permission is requested here, before the session */}
      <div className="w-full max-w-sm">
        {cameraError ? (
          <div className="card border border-cherry/30 p-5 text-center text-sm leading-relaxed text-cherry">
            {cameraError}
          </div>
        ) : (
          <VideoTile
            stream={localStream}
            mirror
            muted
            name={me?.name || "me"}
            accent={amOwner ? "pink" : "blue"}
            placeholder="asking for your camera…"
          />
        )}
      </div>

      {!peerHere && (
        <div className="card flex w-full max-w-sm items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps">invite link</p>
            <p className="truncate text-sm font-medium text-ink/70">{inviteLink}</p>
          </div>
          <button onClick={copyInvite} className="btn-ghost shrink-0 px-4 py-2 text-xs">
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <PresenceDot label={me?.name || "me"} on accent={amOwner ? "pink" : "blue"} />
        <PresenceDot
          label={peer?.name || "your person"}
          on={peerHere}
          accent={amOwner ? "blue" : "pink"}
        />
      </div>

      {amOwner ? (
        <button onClick={onNext} disabled={!peerHere || !localStream} className="btn-primary">
          pick your frame <span aria-hidden>▷</span>
        </button>
      ) : (
        peerHere && (
          <p className="animate-pulse2 text-sm font-medium text-muted">
            waiting for {peer?.name ?? "your partner"} to start…
          </p>
        )
      )}
    </div>
  );
}

function PresenceDot({
  label,
  on,
  accent,
}: {
  label: string;
  on: boolean;
  accent: "pink" | "blue";
}) {
  const color = accent === "pink" ? "var(--pink)" : "var(--blue)";
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-ink/70">
      <span
        className={`h-2.5 w-2.5 rounded-full ${on ? "" : "opacity-25"}`}
        style={{ background: color }}
      />
      {label} {on ? "" : "· not here yet"}
    </span>
  );
}
