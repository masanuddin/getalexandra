/**
 * Shared types between the Next.js client and the Cloudflare Worker
 * (worker/src). Keep this file free of browser/React imports.
 */

export type Role = "a" | "b"; // a = owner (pink, left column) · b = partner (blue, right column)

export type Step = "lobby" | "frames" | "session" | "edit" | "final";

export interface Member {
  clientId: string;
  role: Role;
  name: string;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  step: Step;
  frameId: string;
  totalShots: number;
  members: Member[];
  /** indexes of completed shot pairs */
  shotsDone: number;
}

/** One captured pair. Data URLs of full-res JPEG stills. */
export interface ShotPair {
  a?: string;
  b?: string;
}

// ---------------------------------------------------------------------------
// Realtime event maps (JSON frames over WebSocket; room creation is HTTP)
// ---------------------------------------------------------------------------

export interface JoinRoomPayload {
  code: string;
  clientId: string;
  name: string;
}

export interface RoomResult {
  ok: boolean;
  error?: string;
  room?: RoomSnapshot;
  role?: Role;
  /** shots already captured (for reconnects) */
  shots?: ShotPair[];
}

// Structural mirrors of the DOM's RTCSessionDescriptionInit /
// RTCIceCandidateInit, so this file stays importable from the worker
// (which compiles without the DOM lib).
export interface SessionDescriptionJSON {
  type: "offer" | "pranswer" | "answer" | "rollback";
  sdp?: string;
}

export interface IceCandidateJSON {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

/** WebRTC signaling payload relayed verbatim between the two peers. */
export interface SignalPayload {
  description?: SessionDescriptionJSON;
  candidate?: IceCandidateJSON | null;
}

export interface CaptureEvent {
  /** which shot this is (0-based) */
  index: number;
  /** server-clock timestamp at which the shutter should fire */
  fireAt: number;
  /** seconds of countdown to render (3 → 2 → 1) */
  countdown: number;
}

export interface ShotUploadPayload {
  index: number;
  dataUrl: string;
}

export interface ShotStoredEvent {
  index: number;
  role: Role;
  dataUrl: string;
  /** true when both partners' stills for this index have arrived */
  pairComplete: boolean;
  shotsDone: number;
}

export interface ClientToServerEvents {
  "time:ping": (clientTime: number, cb: (serverTime: number) => void) => void;
  "room:join": (p: JoinRoomPayload, cb: (r: RoomResult) => void) => void;
  "room:leave": () => void;
  "room:set-step": (step: Step) => void;
  "room:set-frame": (frameId: string) => void;
  "room:set-total-shots": (total: number) => void;
  signal: (p: SignalPayload) => void;
  "capture:start": () => void;
  "capture:shot": (p: ShotUploadPayload) => void;
  "capture:retake-last": () => void;
}

export interface ServerToClientEvents {
  "room:update": (room: RoomSnapshot) => void;
  "room:peer-joined": (room: RoomSnapshot) => void;
  "room:peer-left": (room: RoomSnapshot) => void;
  "room:closed": (reason: string) => void;
  signal: (p: SignalPayload) => void;
  capture: (e: CaptureEvent) => void;
  "capture:stored": (e: ShotStoredEvent) => void;
  "capture:retaken": (shotsDone: number) => void;
}

// ---------------------------------------------------------------------------
// Editor types (client-only data shapes, shared with the compositor)
// ---------------------------------------------------------------------------

export interface PlacedSticker {
  id: string;
  stickerId: string;
  /** center position, normalized 0..1 relative to strip width/height */
  x: number;
  y: number;
  /** width as a fraction of strip width */
  scale: number;
  /** degrees */
  rotation: number;
}

export interface Stroke {
  color: string;
  /** width as fraction of strip width */
  width: number;
  /** normalized 0..1 points */
  points: { x: number; y: number }[];
}
