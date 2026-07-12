"use client";

import { create } from "zustand";
import { DEFAULT_FRAME_ID } from "@/lib/frames";
import type {
  PlacedSticker,
  Role,
  RoomSnapshot,
  ShotPair,
  Step,
  Stroke,
} from "@/lib/types";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "peer-disconnected"
  | "error";

interface BoothState {
  // room
  room: RoomSnapshot | null;
  myRole: Role | null;
  myName: string;
  joinError: string | null;

  // camera / rtc
  cameraError: string | null;
  rtcState: ConnectionState;

  // capture
  shots: ShotPair[];
  countdown: number | null; // 3, 2, 1 while counting; null otherwise
  flash: boolean;

  // edit
  stickers: PlacedSticker[];
  strokes: Stroke[];
  selectedStickerId: string | null;
  finalPng: string | null;

  // actions
  setRoom: (room: RoomSnapshot | null) => void;
  setMyRole: (role: Role | null) => void;
  setMyName: (name: string) => void;
  setJoinError: (err: string | null) => void;
  setCameraError: (err: string | null) => void;
  setRtcState: (s: ConnectionState) => void;
  setShots: (shots: ShotPair[]) => void;
  storeShot: (index: number, role: Role, dataUrl: string) => void;
  dropLastShot: () => void;
  setCountdown: (n: number | null) => void;
  triggerFlash: () => void;
  addSticker: (s: PlacedSticker) => void;
  updateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
  removeSticker: (id: string) => void;
  selectSticker: (id: string | null) => void;
  addStroke: (s: Stroke) => void;
  undoStroke: () => void;
  clearStrokes: () => void;
  setFinalPng: (png: string | null) => void;
  resetSession: () => void;
}

export const useBooth = create<BoothState>((set) => ({
  room: null,
  myRole: null,
  myName: "",
  joinError: null,
  cameraError: null,
  rtcState: "idle",
  shots: [],
  countdown: null,
  flash: false,
  stickers: [],
  strokes: [],
  selectedStickerId: null,
  finalPng: null,

  setRoom: (room) => set({ room }),
  setMyRole: (myRole) => set({ myRole }),
  setMyName: (myName) => set({ myName }),
  setJoinError: (joinError) => set({ joinError }),
  setCameraError: (cameraError) => set({ cameraError }),
  setRtcState: (rtcState) => set({ rtcState }),
  setShots: (shots) => set({ shots }),

  storeShot: (index, role, dataUrl) =>
    set((state) => {
      const shots = [...state.shots];
      while (shots.length <= index) shots.push({});
      shots[index] = { ...shots[index], [role]: dataUrl };
      return { shots };
    }),

  dropLastShot: () =>
    set((state) => ({ shots: state.shots.slice(0, -1) })),

  setCountdown: (countdown) => set({ countdown }),

  triggerFlash: () => {
    set({ flash: true });
    setTimeout(() => set({ flash: false }), 550);
  },

  addSticker: (s) =>
    set((state) => ({ stickers: [...state.stickers, s], selectedStickerId: s.id })),
  updateSticker: (id, patch) =>
    set((state) => ({
      stickers: state.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  removeSticker: (id) =>
    set((state) => ({
      stickers: state.stickers.filter((s) => s.id !== id),
      selectedStickerId:
        state.selectedStickerId === id ? null : state.selectedStickerId,
    })),
  selectSticker: (selectedStickerId) => set({ selectedStickerId }),

  addStroke: (s) => set((state) => ({ strokes: [...state.strokes, s] })),
  undoStroke: () => set((state) => ({ strokes: state.strokes.slice(0, -1) })),
  clearStrokes: () => set({ strokes: [] }),

  setFinalPng: (finalPng) => set({ finalPng }),

  resetSession: () =>
    set({
      shots: [],
      countdown: null,
      flash: false,
      stickers: [],
      strokes: [],
      selectedStickerId: null,
      finalPng: null,
    }),
}));

export function frameIdOf(room: RoomSnapshot | null): string {
  return room?.frameId ?? DEFAULT_FRAME_ID;
}

export function stepOf(room: RoomSnapshot | null): Step {
  return room?.step ?? "lobby";
}
