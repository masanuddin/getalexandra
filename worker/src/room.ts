/**
 * BoothRoom Durable Object — one instance per room, addressed by room code.
 *
 * A direct port of the old Socket.IO server's room logic: presence with
 * reconnect grace, WebRTC signaling relay, the synchronized-capture protocol
 * (shared fireAt timestamp on this object's clock), and still fan-out.
 *
 * Wire format (JSON over WebSocket):
 *   client → server  {ev, data?, ack?}
 *   server → client  {ev, data}  |  {ack, data}   (ack answers an emit callback)
 */

import type { Member, Role, RoomSnapshot, ShotPair, Step } from "../../src/lib/types";

/** how long a disconnected member's seat is held before the room gives up on them */
const RECONNECT_GRACE_MS = 90_000;
/** empty rooms are wiped after this long (storage alarm survives eviction) */
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const COUNTDOWN_SECONDS = 3;
/** network headroom before the countdown starts */
const CAPTURE_LEAD_MS = 700;

interface WireIn {
  ev: string;
  data?: unknown;
  ack?: number;
}

interface SessionInfo {
  clientId: string;
  role: Role;
}

/** small, persisted part of the room (stills stay in memory only) */
interface Meta {
  created: boolean;
  code: string;
  ownerClientId: string | null;
  step: Step;
  frameId: string;
  totalShots: number;
  members: Member[];
}

const freshMeta = (): Meta => ({
  created: false,
  code: "",
  ownerClientId: null,
  step: "lobby",
  frameId: "hearts",
  totalShots: 4,
  members: [],
});

export class BoothRoom {
  private state: DurableObjectState;
  private sessions = new Map<WebSocket, SessionInfo>();
  private meta: Meta = freshMeta();
  private shots: ShotPair[] = [];
  private captureInFlight = false;
  private graceTimers = new Map<string, number>();

  constructor(state: DurableObjectState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<Meta>("meta");
      if (saved) {
        this.meta = saved;
        // sockets never survive eviction/restart
        for (const m of this.meta.members) m.connected = false;
      }
    });
  }

  private persist() {
    void this.state.storage.put("meta", this.meta);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // called by the Worker when a client asks for a new room
    if (request.method === "POST" && url.pathname === "/create") {
      if (this.meta.created) return new Response("room code taken", { status: 409 });
      const body = await request.json<{ clientId?: string; code?: string }>();
      this.meta = freshMeta();
      this.meta.created = true;
      this.meta.code = body.code ?? "";
      this.meta.ownerClientId = body.clientId ?? null;
      this.persist();
      await this.state.storage.deleteAlarm();
      return Response.json({ ok: true });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("expected a websocket upgrade", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.acceptSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  /** wipe long-empty rooms; alarms survive DO eviction, unlike setTimeout */
  async alarm() {
    if (this.sessions.size === 0) {
      await this.state.storage.deleteAll();
      this.meta = freshMeta();
      this.shots = [];
    }
  }

  // -------------------------------------------------------------------------
  // socket plumbing
  // -------------------------------------------------------------------------

  private acceptSession(ws: WebSocket) {
    ws.accept();
    ws.addEventListener("message", (e) => {
      try {
        this.onMessage(ws, JSON.parse(String(e.data)) as WireIn);
      } catch {
        // malformed frame — ignore
      }
    });
    const bye = () => this.onClose(ws);
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
  }

  private send(ws: WebSocket, frame: unknown) {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // socket already gone
    }
  }

  private ackTo(ws: WebSocket, ack: number | undefined, data: unknown) {
    if (typeof ack === "number") this.send(ws, { ack, data });
  }

  private broadcast(ev: string, data: unknown, except?: WebSocket) {
    for (const ws of this.sessions.keys()) {
      if (ws !== except) this.send(ws, { ev, data });
    }
  }

  private snapshot(): RoomSnapshot {
    return {
      code: this.meta.code,
      step: this.meta.step,
      frameId: this.meta.frameId,
      totalShots: this.meta.totalShots,
      members: this.meta.members.map((m) => ({ ...m })),
      shotsDone: this.shots.filter((s) => s.a && s.b).length,
    };
  }

  private broadcastUpdate() {
    this.broadcast("room:update", this.snapshot());
  }

  private roleOf(ws: WebSocket): Role | null {
    return this.sessions.get(ws)?.role ?? null;
  }

  // -------------------------------------------------------------------------
  // message dispatch
  // -------------------------------------------------------------------------

  private onMessage(ws: WebSocket, frame: WireIn) {
    const { ev, data, ack } = frame;
    switch (ev) {
      case "time:ping":
        this.ackTo(ws, ack, Date.now());
        break;
      case "room:join":
        this.join(ws, data as { clientId?: string; name?: string }, ack);
        break;
      case "room:set-step":
        this.setStep(ws, data);
        break;
      case "room:set-frame":
        this.setFrame(ws, data);
        break;
      case "room:set-total-shots":
        this.setTotalShots(ws, data);
        break;
      case "signal":
        if (this.sessions.has(ws)) this.broadcast("signal", data, ws);
        break;
      case "capture:start":
        this.captureStart(ws);
        break;
      case "capture:shot":
        this.captureShot(ws, data as { index?: number; dataUrl?: string });
        break;
      case "capture:retake-last":
        this.retakeLast(ws);
        break;
      case "room:leave":
        this.leave(ws);
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // room lifecycle
  // -------------------------------------------------------------------------

  private join(ws: WebSocket, data: { clientId?: string; name?: string }, ack?: number) {
    const clientId = typeof data?.clientId === "string" ? data.clientId : "";
    const name = typeof data?.name === "string" ? data.name.trim().slice(0, 24) : "";

    if (!this.meta.created || !clientId) {
      this.ackTo(ws, ack, { ok: false, error: "That room doesn't exist (or has expired)." });
      return;
    }

    // a rejoin from the same identity replaces any lingering session
    for (const [oldWs, info] of this.sessions) {
      if (info.clientId === clientId) {
        this.sessions.delete(oldWs);
        try {
          oldWs.close(1000, "replaced by a newer connection");
        } catch {
          /* already closed */
        }
      }
    }

    const existing = this.meta.members.find((m) => m.clientId === clientId);
    let member: Member;

    if (existing) {
      member = existing;
      if (name) member.name = name;
    } else {
      if (this.meta.members.length >= 2) {
        this.ackTo(ws, ack, { ok: false, error: "This room is already full — photobooths seat two." });
        return;
      }
      const isOwner = this.meta.ownerClientId
        ? clientId === this.meta.ownerClientId
        : this.meta.members.length === 0;
      let role: Role = isOwner ? "a" : "b";
      if (this.meta.members.some((m) => m.role === role)) role = role === "a" ? "b" : "a";
      member = {
        clientId,
        role,
        name: name || (role === "a" ? "partner a" : "partner b"),
        connected: true,
      };
      this.meta.members.push(member);
    }

    member.connected = true;
    const timer = this.graceTimers.get(clientId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.graceTimers.delete(clientId);
    }
    void this.state.storage.deleteAlarm();

    this.sessions.set(ws, { clientId, role: member.role });
    this.persist();

    this.ackTo(ws, ack, {
      ok: true,
      room: this.snapshot(),
      role: member.role,
      shots: this.shots,
    });
    this.broadcast("room:peer-joined", this.snapshot(), ws);
  }

  private leave(ws: WebSocket) {
    const info = this.sessions.get(ws);
    if (!info) return;
    this.sessions.delete(ws);
    this.meta.members = this.meta.members.filter((m) => m.clientId !== info.clientId);
    this.persist();
    this.afterDeparture();
  }

  private onClose(ws: WebSocket) {
    const info = this.sessions.get(ws);
    if (!info) return;
    this.sessions.delete(ws);

    // the same identity may already be back on a newer socket
    const stillHere = [...this.sessions.values()].some((s) => s.clientId === info.clientId);
    if (stillHere) return;

    const member = this.meta.members.find((m) => m.clientId === info.clientId);
    if (member) {
      member.connected = false;
      this.persist();
      // hold the seat so a refresh / network blip can reclaim it
      const timer = setTimeout(() => {
        this.graceTimers.delete(info.clientId);
        const m = this.meta.members.find((x) => x.clientId === info.clientId);
        if (m && !m.connected) {
          this.meta.members = this.meta.members.filter((x) => x.clientId !== info.clientId);
          this.persist();
        }
      }, RECONNECT_GRACE_MS) as unknown as number;
      this.graceTimers.set(info.clientId, timer);
    }
    this.afterDeparture();
  }

  private afterDeparture() {
    if (this.sessions.size === 0) {
      void this.state.storage.setAlarm(Date.now() + EMPTY_ROOM_TTL_MS);
    } else {
      this.broadcast("room:peer-left", this.snapshot());
    }
  }

  // -------------------------------------------------------------------------
  // room settings
  // -------------------------------------------------------------------------

  private setStep(ws: WebSocket, data: unknown) {
    if (!this.sessions.has(ws)) return;
    const valid: Step[] = ["lobby", "frames", "session", "edit", "final"];
    if (!valid.includes(data as Step)) return;
    this.meta.step = data as Step;
    this.persist();
    this.broadcastUpdate();
  }

  private setFrame(ws: WebSocket, data: unknown) {
    if (!this.sessions.has(ws) || typeof data !== "string") return;
    this.meta.frameId = data.slice(0, 32);
    this.persist();
    this.broadcastUpdate();
  }

  private setTotalShots(ws: WebSocket, data: unknown) {
    if (!this.sessions.has(ws)) return;
    const n = Math.round(Number(data));
    if (n >= 2 && n <= 6) {
      this.meta.totalShots = n;
      this.persist();
      this.broadcastUpdate();
    }
  }

  // -------------------------------------------------------------------------
  // synchronized capture
  // -------------------------------------------------------------------------

  private captureStart(ws: WebSocket) {
    if (this.roleOf(ws) !== "a") return; // owner-triggered only
    if (this.captureInFlight) return;
    const done = this.shots.filter((s) => s.a && s.b).length;
    if (done >= this.meta.totalShots) return;

    this.captureInFlight = true;
    const index = this.shots.length === done ? done : this.shots.length - 1;
    if (!this.shots[index]) this.shots[index] = {};

    const fireAt = Date.now() + CAPTURE_LEAD_MS + COUNTDOWN_SECONDS * 1000;
    this.broadcast("capture", { index, fireAt, countdown: COUNTDOWN_SECONDS });

    // safety valve: unlock the shutter if stills never arrive
    setTimeout(() => {
      this.captureInFlight = false;
    }, CAPTURE_LEAD_MS + COUNTDOWN_SECONDS * 1000 + 15_000);
  }

  private captureShot(ws: WebSocket, data: { index?: number; dataUrl?: string }) {
    const role = this.roleOf(ws);
    if (!role) return;
    const { index, dataUrl } = data ?? {};
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return;
    if (!Number.isInteger(index) || index! < 0 || index! >= this.meta.totalShots) return;

    if (!this.shots[index!]) this.shots[index!] = {};
    this.shots[index!][role] = dataUrl;

    const pair = this.shots[index!];
    const pairComplete = Boolean(pair.a && pair.b);
    if (pairComplete) this.captureInFlight = false;
    const shotsDone = this.shots.filter((s) => s.a && s.b).length;

    this.broadcast("capture:stored", { index, role, dataUrl, pairComplete, shotsDone });

    if (pairComplete && shotsDone >= this.meta.totalShots) {
      this.meta.step = "edit";
      this.persist();
      this.broadcastUpdate();
    }
  }

  private retakeLast(ws: WebSocket) {
    if (this.roleOf(ws) !== "a") return;
    if (this.shots.length > 0) {
      this.shots.pop();
      if (this.meta.step === "edit") this.meta.step = "session";
    }
    this.captureInFlight = false;
    const shotsDone = this.shots.filter((s) => s.a && s.b).length;
    this.broadcast("capture:retaken", shotsDone);
    this.persist();
    this.broadcastUpdate();
  }
}
