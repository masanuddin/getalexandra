"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTurnServers, getSocket } from "@/lib/socket";
import type { SignalPayload } from "@/lib/types";
import { useBooth } from "@/store/booth";

/**
 * ICE configuration. STUN covers friendly networks; TURN credentials are
 * generated per-session by the worker (Cloudflare Calls) and cover strict
 * NATs / mobile data. The NEXT_PUBLIC_TURN_* env vars remain as an optional
 * static override (e.g. self-hosted coturn).
 */
async function buildIceServers(): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }
  servers.push(...(await fetchTurnServers()));
  return servers;
}

/**
 * Local camera + peer-to-peer video, using the "perfect negotiation" pattern.
 * The WebRTC feed is ONLY the live posing preview — stills are captured from
 * the local getUserMedia stream at full resolution (see useSyncedCapture).
 *
 * @param active   start the camera / connection when true
 * @param polite   exactly one side must be polite; we use role "b"
 * @param peerHere whether the partner is currently in the room
 */
export function usePeerVideo(active: boolean, polite: boolean, peerHere: boolean) {
  const { setCameraError, setRtcState } = useBooth();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);

  // --- local camera -------------------------------------------------------
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCameraError(null);
      } catch (err) {
        const e = err as DOMException;
        if (e.name === "NotAllowedError") {
          setCameraError(
            "Camera access was denied. Allow camera & microphone in your browser settings, then reload.",
          );
        } else if (e.name === "NotFoundError") {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(`Could not start the camera: ${e.message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    };
  }, [active, setCameraError]);

  // --- peer connection ----------------------------------------------------
  useEffect(() => {
    if (!active || !localStream || !peerHere) return;

    const socket = getSocket();
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;
    let makingOffer = false;
    let ignoreOffer = false;
    // signals that arrive while we're still fetching TURN credentials
    const backlog: SignalPayload[] = [];

    const handleSignal = async ({ description, candidate }: SignalPayload) => {
      if (!pc) {
        backlog.push({ description, candidate });
        return;
      }
      try {
        if (description) {
          const offerCollision =
            description.type === "offer" &&
            (makingOffer || pc.signalingState !== "stable");
          ignoreOffer = !polite && offerCollision;
          if (ignoreOffer) return;

          await pc.setRemoteDescription(description);
          if (description.type === "offer") {
            await pc.setLocalDescription();
            socket.emit("signal", { description: pc.localDescription!.toJSON() });
          }
        } else if (candidate !== undefined) {
          try {
            await pc.addIceCandidate(candidate ?? undefined);
          } catch (err) {
            if (!ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error("signal handling failed", err);
      }
    };

    // register before the async setup so no signal is ever dropped
    socket.on("signal", handleSignal);
    setRtcState("connecting");

    (async () => {
      const iceServers = await buildIceServers();
      if (cancelled) return;

      pc = new RTCPeerConnection({ iceServers });

      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }

      pc.ontrack = (ev) => {
        setRemoteStream(ev.streams[0] ?? new MediaStream([ev.track]));
      };

      pc.onicecandidate = (ev) => {
        socket.emit("signal", { candidate: ev.candidate?.toJSON() ?? null });
      };

      pc.onnegotiationneeded = async () => {
        if (!pc) return;
        try {
          makingOffer = true;
          await pc.setLocalDescription();
          socket.emit("signal", { description: pc.localDescription!.toJSON() });
        } catch (err) {
          console.error("negotiation failed", err);
        } finally {
          makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pc) return;
        switch (pc.connectionState) {
          case "connected":
            setRtcState("connected");
            break;
          case "disconnected":
            setRtcState("peer-disconnected");
            break;
          case "failed":
            setRtcState("peer-disconnected");
            pc.restartIce();
            break;
          default:
            break;
        }
      };

      // replay anything that arrived while TURN credentials were loading
      for (const queued of backlog.splice(0)) {
        await handleSignal(queued);
      }
    })();

    return () => {
      cancelled = true;
      socket.off("signal", handleSignal);
      pc?.close();
      pc = null;
      setRemoteStream(null);
      setRtcState("idle");
    };
  }, [active, localStream, peerHere, polite, setRtcState]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  return { localStream, remoteStream, micOn, toggleMic };
}
