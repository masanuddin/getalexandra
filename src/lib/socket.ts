"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type BoothSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

let socket: BoothSocket | null = null;

/** offset such that serverNow ≈ Date.now() + clockOffset */
let clockOffset = 0;

export function getSocket(): BoothSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socket.on("connect", () => void syncClock());
  }
  return socket;
}

/**
 * Estimate the offset between this device's clock and the server's,
 * so both partners can fire the shutter at the same server-time instant.
 * Takes the sample with the lowest round-trip time out of a few pings.
 */
export async function syncClock(): Promise<void> {
  const s = getSocket();
  const samples: { offset: number; rtt: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now();
    const serverTime = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("time ping timeout")), 2000);
      s.emit("time:ping", t0, (t) => {
        clearTimeout(timer);
        resolve(t);
      });
    }).catch(() => null);
    if (serverTime === null) continue;
    const t1 = Date.now();
    samples.push({ offset: serverTime - (t0 + t1) / 2, rtt: t1 - t0 });
  }
  if (samples.length > 0) {
    samples.sort((x, y) => x.rtt - y.rtt);
    clockOffset = samples[0].offset;
  }
}

/** current time on the server's clock, best estimate */
export function serverNow(): number {
  return Date.now() + clockOffset;
}

/** stable per-browser identity so a refresh reclaims the same seat */
export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "booth:clientId";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
