import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Member,
  Role,
  RoomSnapshot,
  ShotPair,
  Step,
} from "../src/lib/types";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/** how long a disconnected member's seat is held before the room gives up on them */
const RECONNECT_GRACE_MS = 90_000;
/** empty rooms are reaped after this long */
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
/** lead time between the capture broadcast and the shutter, per countdown second */
const COUNTDOWN_SECONDS = 3;
/** extra network headroom before the countdown starts */
const CAPTURE_LEAD_MS = 700;

interface ServerMember extends Member {
  socketId: string | null;
  graceTimer?: NodeJS.Timeout;
}

interface Room {
  code: string;
  step: Step;
  frameId: string;
  totalShots: number;
  members: Map<string, ServerMember>; // keyed by clientId
  shots: ShotPair[];
  captureInFlight: boolean;
  emptySince: number | null;
}

const rooms = new Map<string, Room>();

// no ambiguous chars (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  let code = "";
  do {
    code = Array.from(
      { length: 6 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
}

function snapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    step: room.step,
    frameId: room.frameId,
    totalShots: room.totalShots,
    members: [...room.members.values()].map(({ clientId, role, name, connected }) => ({
      clientId,
      role,
      name,
      connected,
    })),
    shotsDone: room.shots.filter((s) => s.a && s.b).length,
  };
}

type BoothSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketCtx {
  roomCode?: string;
  clientId?: string;
  role?: Role;
}
const ctxOf = new Map<string, SocketCtx>();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("getalexa photobooth socket server\n");
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: [WEB_ORIGIN, "http://localhost:3000"], methods: ["GET", "POST"] },
  // high-res stills travel over the socket as data URLs
  maxHttpBufferSize: 25e6,
});

function roomOf(socket: BoothSocket): Room | undefined {
  const ctx = ctxOf.get(socket.id);
  return ctx?.roomCode ? rooms.get(ctx.roomCode) : undefined;
}

function emitToRoom(room: Room, fn: (s: BoothSocket) => void) {
  for (const m of room.members.values()) {
    if (!m.socketId) continue;
    const s = io.sockets.sockets.get(m.socketId);
    if (s) fn(s as BoothSocket);
  }
}

function broadcastUpdate(room: Room) {
  emitToRoom(room, (s) => s.emit("room:update", snapshot(room)));
}

function seatMember(room: Room, socket: BoothSocket, member: ServerMember) {
  if (member.graceTimer) {
    clearTimeout(member.graceTimer);
    member.graceTimer = undefined;
  }
  member.socketId = socket.id;
  member.connected = true;
  room.emptySince = null;
  ctxOf.set(socket.id, { roomCode: room.code, clientId: member.clientId, role: member.role });
  socket.join(room.code);
}

io.on("connection", (socket: BoothSocket) => {
  ctxOf.set(socket.id, {});

  socket.on("time:ping", (_clientTime, cb) => {
    if (typeof cb === "function") cb(Date.now());
  });

  socket.on("room:create", ({ clientId, name }, cb) => {
    if (typeof cb !== "function") return;
    const code = generateCode();
    const member: ServerMember = {
      clientId,
      role: "a",
      name: name?.trim().slice(0, 24) || "partner a",
      connected: true,
      socketId: socket.id,
    };
    const room: Room = {
      code,
      step: "lobby",
      frameId: "hearts",
      totalShots: 4,
      members: new Map([[clientId, member]]),
      shots: [],
      captureInFlight: false,
      emptySince: null,
    };
    rooms.set(code, room);
    seatMember(room, socket, member);
    cb({ ok: true, room: snapshot(room), role: "a", shots: room.shots });
  });

  socket.on("room:join", ({ code, clientId, name }, cb) => {
    if (typeof cb !== "function") return;
    const room = rooms.get(code?.trim().toUpperCase());
    if (!room) {
      cb({ ok: false, error: "That room doesn't exist (or has expired)." });
      return;
    }

    // reconnect: this client already has a seat
    const existing = room.members.get(clientId);
    if (existing) {
      seatMember(room, socket, existing);
      if (name?.trim()) existing.name = name.trim().slice(0, 24);
      cb({ ok: true, room: snapshot(room), role: existing.role, shots: room.shots });
      socket.to(room.code).emit("room:peer-joined", snapshot(room));
      return;
    }

    if (room.members.size >= 2) {
      cb({ ok: false, error: "This room is already full — photobooths seat two." });
      return;
    }

    const member: ServerMember = {
      clientId,
      role: "b",
      name: name?.trim().slice(0, 24) || "partner b",
      connected: true,
      socketId: socket.id,
    };
    room.members.set(clientId, member);
    seatMember(room, socket, member);
    cb({ ok: true, room: snapshot(room), role: "b", shots: room.shots });
    socket.to(room.code).emit("room:peer-joined", snapshot(room));
  });

  socket.on("room:set-step", (step) => {
    const room = roomOf(socket);
    if (!room) return;
    const valid: Step[] = ["lobby", "frames", "session", "edit", "final"];
    if (!valid.includes(step)) return;
    room.step = step;
    broadcastUpdate(room);
  });

  socket.on("room:set-frame", (frameId) => {
    const room = roomOf(socket);
    if (!room || typeof frameId !== "string") return;
    room.frameId = frameId.slice(0, 32);
    broadcastUpdate(room);
  });

  socket.on("room:set-total-shots", (total) => {
    const room = roomOf(socket);
    if (!room) return;
    const n = Math.round(Number(total));
    if (n >= 2 && n <= 6) {
      room.totalShots = n;
      broadcastUpdate(room);
    }
  });

  // WebRTC signaling relay — just forward to the other seat
  socket.on("signal", (payload) => {
    const room = roomOf(socket);
    if (!room) return;
    socket.to(room.code).emit("signal", payload);
  });

  socket.on("capture:start", () => {
    const room = roomOf(socket);
    const ctx = ctxOf.get(socket.id);
    if (!room || ctx?.role !== "a") return; // owner-triggered only
    if (room.captureInFlight) return;
    const done = room.shots.filter((s) => s.a && s.b).length;
    if (done >= room.totalShots) return;

    room.captureInFlight = true;
    const index = room.shots.length === done ? done : room.shots.length - 1;
    if (!room.shots[index]) room.shots[index] = {};

    const fireAt = Date.now() + CAPTURE_LEAD_MS + COUNTDOWN_SECONDS * 1000;
    emitToRoom(room, (s) =>
      s.emit("capture", { index, fireAt, countdown: COUNTDOWN_SECONDS }),
    );

    // safety valve: if stills never arrive (e.g. a client died mid-shot),
    // unlock the shutter so the owner can retry
    setTimeout(() => {
      room.captureInFlight = false;
    }, CAPTURE_LEAD_MS + COUNTDOWN_SECONDS * 1000 + 15_000);
  });

  socket.on("capture:shot", ({ index, dataUrl }) => {
    const room = roomOf(socket);
    const ctx = ctxOf.get(socket.id);
    if (!room || !ctx?.role) return;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return;
    if (!Number.isInteger(index) || index < 0 || index >= room.totalShots) return;

    if (!room.shots[index]) room.shots[index] = {};
    room.shots[index][ctx.role] = dataUrl;

    const pair = room.shots[index];
    const pairComplete = Boolean(pair.a && pair.b);
    if (pairComplete) room.captureInFlight = false;
    const shotsDone = room.shots.filter((s) => s.a && s.b).length;

    emitToRoom(room, (s) =>
      s.emit("capture:stored", { index, role: ctx.role!, dataUrl, pairComplete, shotsDone }),
    );

    if (pairComplete && shotsDone >= room.totalShots) {
      room.step = "edit";
      broadcastUpdate(room);
    }
  });

  socket.on("capture:retake-last", () => {
    const room = roomOf(socket);
    const ctx = ctxOf.get(socket.id);
    if (!room || ctx?.role !== "a") return;
    // drop the most recent shot (a complete pair or a dangling partial)
    if (room.shots.length > 0) {
      room.shots.pop();
      if (room.step === "edit") room.step = "session";
    }
    room.captureInFlight = false;
    const shotsDone = room.shots.filter((s) => s.a && s.b).length;
    emitToRoom(room, (s) => s.emit("capture:retaken", shotsDone));
    broadcastUpdate(room);
  });

  socket.on("room:leave", () => detach(socket, true));
  socket.on("disconnect", () => detach(socket, false));
});

function detach(socket: BoothSocket, explicit: boolean) {
  const ctx = ctxOf.get(socket.id);
  ctxOf.delete(socket.id);
  if (!ctx?.roomCode || !ctx.clientId) return;
  const room = rooms.get(ctx.roomCode);
  if (!room) return;
  const member = room.members.get(ctx.clientId);
  if (!member || member.socketId !== socket.id) return;

  member.socketId = null;
  member.connected = false;

  if (explicit) {
    room.members.delete(ctx.clientId);
  } else {
    // hold their seat for a while so a page refresh / network blip can rejoin
    member.graceTimer = setTimeout(() => {
      if (!member.connected) room.members.delete(ctx.clientId!);
      if ([...room.members.values()].every((m) => !m.connected)) {
        room.emptySince = Date.now();
      }
    }, RECONNECT_GRACE_MS);
  }

  const stillSeated = [...room.members.values()].some((m) => m.connected);
  if (!stillSeated) {
    room.emptySince = Date.now();
  } else {
    io.to(room.code).emit("room:peer-left", snapshot(room));
  }
}

// reap long-empty rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}, 60_000);

httpServer.listen(PORT, () => {
  console.log(`[socket] photobooth signaling server on :${PORT} (web origin: ${WEB_ORIGIN})`);
});
