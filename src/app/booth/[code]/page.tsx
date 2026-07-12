"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Logo } from "@/components/Nav";
import { Editor } from "@/components/booth/Editor";
import { Final } from "@/components/booth/Final";
import { FramePicker } from "@/components/booth/FramePicker";
import { Lobby } from "@/components/booth/Lobby";
import { Session } from "@/components/booth/Session";
import { usePeerVideo } from "@/hooks/usePeerVideo";
import { useRoom } from "@/hooks/useRoom";
import { useSyncedCapture } from "@/hooks/useSyncedCapture";
import { useBooth } from "@/store/booth";

const STEP_LABEL: Record<string, string> = {
  lobby: "the room",
  frames: "pick a theme",
  session: "strike a pose",
  edit: "decorate",
  final: "all done ♡",
};

export default function BoothPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const { room, myRole, joinError } = useBooth();
  const roomActions = useRoom(code);

  const step = room?.step ?? "lobby";
  const amOwner = myRole === "a";
  const peer = room?.members.find((m) => m.role !== myRole);
  const peerHere = Boolean(peer?.connected);

  // the camera runs from the lobby through the live session, then is
  // released so the light goes off while decorating
  const cameraActive = step === "lobby" || step === "frames" || step === "session";
  const { localStream, remoteStream, micOn, toggleMic } = usePeerVideo(
    cameraActive,
    myRole === "b",
    peerHere,
  );
  const capture = useSyncedCapture(localStream);

  if (joinError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <Logo />
        <p className="max-w-sm text-sm leading-relaxed text-ink/60">{joinError}</p>
        <Link href="/room" className="btn-primary">
          Back to rooms →
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="label-caps hidden sm:inline">{STEP_LABEL[step]}</span>
          <span className="card px-3 py-1.5 font-round text-sm font-bold tracking-[0.2em]">
            {code}
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-10">
        {!room ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="animate-pulse2 text-sm font-medium text-muted">
              slipping into the room…
            </p>
          </div>
        ) : step === "lobby" ? (
          <Lobby
            code={code}
            amOwner={amOwner}
            peerHere={peerHere}
            localStream={localStream}
            onNext={() => roomActions.setStep("frames")}
          />
        ) : step === "frames" ? (
          <FramePicker
            amOwner={amOwner}
            onSelect={roomActions.setFrame}
            onNext={() => roomActions.setStep("session")}
            onTotalShots={roomActions.setTotalShots}
          />
        ) : step === "session" ? (
          <Session
            amOwner={amOwner}
            peerHere={peerHere}
            localStream={localStream}
            remoteStream={remoteStream}
            micOn={micOn}
            onToggleMic={toggleMic}
            onCapture={capture.requestCapture}
            onRetake={capture.requestRetake}
          />
        ) : step === "edit" ? (
          <Editor onNext={() => roomActions.setStep("final")} onRetake={capture.requestRetake} amOwner={amOwner} />
        ) : (
          <Final />
        )}
      </div>
    </main>
  );
}
