"use client";

/**
 * Thin Socket.IO-style adapter over a native WebSocket, talking to the
 * Cloudflare Worker (one Durable Object per room). Keeps the emit/on/ack
 * call shape the hooks were written against.
 *
 * Wire format:
 *   out  {ev, data?, ack?}          — ack is a sequence id when a callback was passed
 *   in   {ev, data} | {ack, data}   — ack frames resolve the pending callback
 */

import type { ClientToServerEvents, ServerToClientEvents } from "./types";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

type LifecycleEvents = {
  connect: () => void;
  disconnect: () => void;
};
type IncomingEvents = ServerToClientEvents & LifecycleEvents;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => void;

export class BoothSocket {
  connected = false;

  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<AnyHandler>>();
  private acks = new Map<number, AnyHandler>();
  private ackSeq = 0;
  private sendQueue: string[] = [];
  private closedForGood = false;
  private retries = 0;

  constructor(private wsUrl: string) {
    this.open();
  }

  private open() {
    if (this.closedForGood) return;
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.retries = 0;
      for (const frame of this.sendQueue.splice(0)) ws.send(frame);
      this.dispatch("connect");
    };

    ws.onmessage = (e) => {
      let frame: { ev?: string; ack?: number; data?: unknown };
      try {
        frame = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (typeof frame.ack === "number") {
        const cb = this.acks.get(frame.ack);
        this.acks.delete(frame.ack);
        cb?.(frame.data);
        return;
      }
      if (typeof frame.ev === "string") this.dispatch(frame.ev, frame.data);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // superseded by a newer connection
      this.connected = false;
      this.acks.clear();
      this.dispatch("disconnect");
      if (!this.closedForGood) {
        const delay = Math.min(4000, 500 * 2 ** this.retries++);
        setTimeout(() => this.open(), delay);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    };
  }

  private dispatch(ev: string, data?: unknown) {
    this.handlers.get(ev)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`handler for "${ev}" threw`, err);
      }
    });
  }

  emit<K extends keyof ClientToServerEvents>(
    ev: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    const last = args[args.length - 1];
    const hasCb = typeof last === "function";
    const cb = hasCb ? (last as AnyHandler) : undefined;
    const data = hasCb ? (args.length > 1 ? args[0] : undefined) : args[0];

    const frame: { ev: string; data?: unknown; ack?: number } = { ev, data };
    if (cb) {
      frame.ack = ++this.ackSeq;
      this.acks.set(frame.ack, cb);
    }
    const payload = JSON.stringify(frame);
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.sendQueue.push(payload);
    }
  }

  on<K extends keyof IncomingEvents>(ev: K, fn: IncomingEvents[K]): void {
    let set = this.handlers.get(ev);
    if (!set) {
      set = new Set();
      this.handlers.set(ev, set);
    }
    set.add(fn as AnyHandler);
  }

  off<K extends keyof IncomingEvents>(ev: K, fn?: IncomingEvents[K]): void {
    if (!fn) {
      this.handlers.delete(ev);
      return;
    }
    this.handlers.get(ev)?.delete(fn as AnyHandler);
  }

  close() {
    this.closedForGood = true;
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
  }
}

// ---------------------------------------------------------------------------
// connection management — one live socket, bound to the current room
// ---------------------------------------------------------------------------

let current: { code: string; socket: BoothSocket } | null = null;

/** open (or reuse) the socket for a room; a different code replaces the old one */
export function connectRoom(code: string): BoothSocket {
  if (current?.code === code) return current.socket;
  current?.socket.close();
  const wsUrl =
    BASE_URL.replace(/^http/, "ws") + `/rooms/${encodeURIComponent(code)}/ws`;
  const socket = new BoothSocket(wsUrl);
  socket.on("connect", () => void syncClock());
  current = { code, socket };
  return socket;
}

/** the socket opened by connectRoom; only valid inside a booth page */
export function getSocket(): BoothSocket {
  if (!current) throw new Error("connectRoom() must be called before getSocket()");
  return current.socket;
}

/** ask the Worker to allocate a room; the caller then joins it over WS */
export async function createRoomApi(
  clientId: string,
): Promise<{ ok: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { ok: false, error: `The room server responded with ${res.status}.` };
    }
    return (await res.json()) as { ok: boolean; code?: string; error?: string };
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the room server — check that it's running.",
    };
  }
}

// ---------------------------------------------------------------------------
// server-clock sync (unchanged semantics: fireAt is on the server's clock)
// ---------------------------------------------------------------------------

/** offset such that serverNow ≈ Date.now() + clockOffset */
let clockOffset = 0;

/**
 * Estimate the offset between this device's clock and the room server's,
 * so both partners fire the shutter at the same instant. Takes the sample
 * with the lowest round-trip time out of a few pings.
 */
export async function syncClock(): Promise<void> {
  if (!current) return;
  const s = current.socket;
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
