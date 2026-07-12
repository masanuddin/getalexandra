"use client";

import { useCallback, useEffect, useRef } from "react";
import { captureStill } from "@/lib/compositor";
import { getSocket, serverNow } from "@/lib/socket";
import { useBooth } from "@/store/booth";

/**
 * Synchronized capture. The owner presses the shutter → the server broadcasts
 * a `capture` event carrying a shared fire timestamp (server clock). Both
 * clients render the same 3→2→1 countdown against their synced clock and grab
 * a FULL-RESOLUTION still from their own local getUserMedia stream — never
 * from the compressed WebRTC feed.
 */
export function useSyncedCapture(localStream: MediaStream | null) {
  const { setCountdown, triggerFlash, storeShot, dropLastShot } = useBooth();

  // Hidden video element bound to the local stream, used purely as a capture
  // source so capture never depends on which UI element is on screen.
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!localStream) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = localStream;
    video.play().catch(() => {
      /* will start on user gesture at worst; stream is already live */
    });
    captureVideoRef.current = video;
    return () => {
      video.srcObject = null;
      captureVideoRef.current = null;
    };
  }, [localStream]);

  useEffect(() => {
    const socket = getSocket();

    const clearTimers = () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };

    const onCapture = ({ index, fireAt, countdown }: {
      index: number;
      fireAt: number;
      countdown: number;
    }) => {
      clearTimers();
      const delayTo = (serverTime: number) =>
        Math.max(0, serverTime - serverNow());

      // schedule 3 → 2 → 1 against the shared server-clock fire time
      for (let n = countdown; n >= 1; n--) {
        const at = fireAt - n * 1000;
        timersRef.current.push(
          window.setTimeout(() => setCountdown(n), delayTo(at)),
        );
      }

      timersRef.current.push(
        window.setTimeout(() => {
          setCountdown(null);
          triggerFlash();
          try {
            const video = captureVideoRef.current;
            if (!video) throw new Error("no capture source");
            const dataUrl = captureStill(video);
            socket.emit("capture:shot", { index, dataUrl });
          } catch (err) {
            console.error("capture failed", err);
          }
        }, delayTo(fireAt)),
      );
    };

    const onStored = ({ index, role, dataUrl }: {
      index: number;
      role: "a" | "b";
      dataUrl: string;
    }) => {
      storeShot(index, role, dataUrl);
    };

    const onRetaken = () => {
      dropLastShot();
    };

    socket.on("capture", onCapture);
    socket.on("capture:stored", onStored);
    socket.on("capture:retaken", onRetaken);
    return () => {
      clearTimers();
      socket.off("capture", onCapture);
      socket.off("capture:stored", onStored);
      socket.off("capture:retaken", onRetaken);
    };
  }, [setCountdown, triggerFlash, storeShot, dropLastShot]);

  /** owner-only: ask the server to start a synced countdown */
  const requestCapture = useCallback(() => {
    getSocket().emit("capture:start");
  }, []);

  /** owner-only: drop the last shot pair on both clients */
  const requestRetake = useCallback(() => {
    getSocket().emit("capture:retake-last");
  }, []);

  return { requestCapture, requestRetake };
}
