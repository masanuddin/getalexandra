"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { getClientId, getSocket } from "@/lib/socket";

const NAME_KEY = "booth:name";

function RoomInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [code, setCode] = useState(params.get("code")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY) ?? "");
  }, []);

  const saveName = () => {
    window.localStorage.setItem(NAME_KEY, name.trim());
  };

  const createRoom = () => {
    setBusy("create");
    setError(null);
    saveName();
    const socket = getSocket();
    socket.emit(
      "room:create",
      { clientId: getClientId(), name: name.trim() },
      (r) => {
        if (r.ok && r.room) {
          router.push(`/booth/${r.room.code}`);
        } else {
          setError(r.error ?? "Could not create a room. Is the server running?");
          setBusy(null);
        }
      },
    );
    // if the socket server is unreachable the callback never fires
    setTimeout(() => {
      setBusy((b) => {
        if (b === "create") {
          setError("Couldn't reach the room server — check that it's running.");
          return null;
        }
        return b;
      });
    }, 5000);
  };

  const joinRoom = () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError("Enter the room code your partner sent you.");
      return;
    }
    setBusy("join");
    setError(null);
    saveName();
    router.push(`/booth/${clean}`);
  };

  return (
    <main className="min-h-dvh">
      <Nav />
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 pt-8 md:pt-14">
        <p className="label-caps text-center">the photobooth</p>
        <h1 className="mt-3 text-center text-4xl font-bold tracking-tight">
          Meet <span className="text-pinky">your</span>{" "}
          <span className="text-bluey">person</span> in a room
        </h1>
        <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-ink/60">
          One of you opens a room and sends the invite. The other joins with
          the code. Then you pose, count down together, and snap.
        </p>

        <div className="card mx-auto mt-8 flex max-w-sm items-center gap-3 px-5 py-4">
          <span className="text-lg" aria-hidden>✏️</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="your name (optional)"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted"
          />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* create */}
          <div className="card flex flex-col p-7">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blush text-lg" aria-hidden>
              💌
            </span>
            <h2 className="mt-4 text-xl font-bold">Create a room</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/60">
              You&apos;ll get a short code and an invite link to send your
              other half. You wait inside until they arrive.
            </p>
            <button
              onClick={createRoom}
              disabled={busy !== null}
              className="btn-primary mt-6 w-full"
            >
              {busy === "create" ? "opening your room…" : "Create a room →"}
            </button>
          </div>

          {/* join */}
          <div className="card flex flex-col p-7">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-butter/60 text-lg" aria-hidden>
              🔑
            </span>
            <h2 className="mt-4 text-xl font-bold">Join a room</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Got a code from your partner? Type it in.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              maxLength={6}
              placeholder="ROOM CODE"
              className="mt-4 w-full rounded-xl border border-ink/10 bg-cream px-4 py-3 text-center font-round text-lg font-bold tracking-[0.35em] outline-none placeholder:text-sm placeholder:font-sans placeholder:font-medium placeholder:tracking-widest placeholder:text-muted focus:border-bluey"
            />
            <button
              onClick={joinRoom}
              disabled={busy !== null}
              className="btn-ghost mt-4 w-full"
            >
              {busy === "join" ? "joining…" : "Join your partner →"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-center text-sm font-medium text-cherry">{error}</p>
        )}
      </section>
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense>
      <RoomInner />
    </Suspense>
  );
}
