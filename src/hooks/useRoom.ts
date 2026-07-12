"use client";

import { useCallback, useEffect, useRef } from "react";
import { getClientId, getSocket } from "@/lib/socket";
import type { RoomResult, Step } from "@/lib/types";
import { useBooth } from "@/store/booth";

/**
 * Owns the socket room lifecycle for a booth page: joins (or re-joins after a
 * reconnect), mirrors server room snapshots into the store, and exposes the
 * room mutations. WebRTC signaling and capture live in their own hooks on the
 * same socket.
 */
export function useRoom(code: string) {
  const { setRoom, setMyRole, setJoinError, setShots } = useBooth();
  const joinedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const applyResult = (r: RoomResult) => {
      if (!r.ok || !r.room) {
        setJoinError(r.error ?? "Could not join the room.");
        return;
      }
      joinedRef.current = true;
      setJoinError(null);
      setRoom(r.room);
      setMyRole(r.role ?? null);
      if (r.shots) setShots(r.shots.map((s) => ({ ...s })));
    };

    const join = () => {
      const name = window.localStorage.getItem("booth:name") ?? "";
      socket.emit(
        "room:join",
        { code, clientId: getClientId(), name },
        applyResult,
      );
    };

    if (socket.connected) join();
    socket.on("connect", join); // rejoin with the same clientId after any reconnect

    socket.on("room:update", setRoom);
    socket.on("room:peer-joined", setRoom);
    socket.on("room:peer-left", setRoom);
    socket.on("room:closed", () => {
      setRoom(null);
      setJoinError("The room was closed.");
    });

    return () => {
      socket.off("connect", join);
      socket.off("room:update", setRoom);
      socket.off("room:peer-joined", setRoom);
      socket.off("room:peer-left", setRoom);
      socket.off("room:closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const setStep = useCallback((step: Step) => {
    getSocket().emit("room:set-step", step);
  }, []);

  const setFrame = useCallback((frameId: string) => {
    getSocket().emit("room:set-frame", frameId);
  }, []);

  const setTotalShots = useCallback((n: number) => {
    getSocket().emit("room:set-total-shots", n);
  }, []);

  const leave = useCallback(() => {
    getSocket().emit("room:leave");
  }, []);

  return { setStep, setFrame, setTotalShots, leave };
}
