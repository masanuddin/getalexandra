"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { computeLayout, drawStrokes, renderBaseStrip } from "@/lib/compositor";
import { getSticker, STICKERS, stickerDataUrl } from "@/lib/stickers";
import type { PlacedSticker, Stroke } from "@/lib/types";
import { frameIdOf, useBooth } from "@/store/booth";

const PEN_COLORS = ["#1A1A1A", "#FF8BA0", "#5B9BFF", "#FFFFFF", "#F7D774"];

type Tool = "stickers" | "draw";

interface EditorProps {
  amOwner: boolean;
  onNext: () => void;
  onRetake: () => void;
}

export function Editor({ amOwner, onNext, onRetake }: EditorProps) {
  const {
    shots,
    room,
    stickers,
    strokes,
    selectedStickerId,
    addSticker,
    updateSticker,
    removeSticker,
    selectSticker,
    addStroke,
    undoStroke,
    clearStrokes,
  } = useBooth();

  const frameId = frameIdOf(room);
  const completeShots = useMemo(
    () => shots.filter((s) => s.a && s.b),
    [shots],
  );
  const layout = useMemo(
    () => computeLayout(Math.max(completeShots.length, 1)),
    [completeShots.length],
  );
  const aspect = layout.height / layout.width;

  const [tool, setTool] = useState<Tool>("stickers");
  const [penColor, setPenColor] = useState(PEN_COLORS[1]);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveStrokeRef = useRef<Stroke | null>(null);

  // render the base strip (photos + frame + date) once per input change
  useEffect(() => {
    let cancelled = false;
    renderBaseStrip(completeShots, frameId)
      .then((canvas) => {
        if (!cancelled) setBaseUrl(canvas.toDataURL("image/jpeg", 0.9));
      })
      .catch((err) => console.error("base strip render failed", err));
    return () => {
      cancelled = true;
    };
  }, [completeShots, frameId]);

  // (re)paint committed strokes on the overlay canvas
  const repaintStrokes = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = liveStrokeRef.current
      ? [...strokes, liveStrokeRef.current]
      : strokes;
    drawStrokes(ctx, all, canvas.width, canvas.height);
  }, [strokes]);

  // keep the draw canvas sized to the displayed stage (device-pixel aware)
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = drawCanvasRef.current;
    if (!stage || !canvas) return;
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      repaintStrokes();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [repaintStrokes]);

  useEffect(repaintStrokes, [repaintStrokes]);

  // ---- pointer helpers -----------------------------------------------------

  const toNorm = (e: { clientX: number; clientY: number }) => {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  // ---- drawing -------------------------------------------------------------

  const onDrawPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool !== "draw") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    liveStrokeRef.current = {
      color: penColor,
      width: 0.012,
      points: [toNorm(e)],
    };
    repaintStrokes();
  };

  const onDrawPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!liveStrokeRef.current) return;
    liveStrokeRef.current.points.push(toNorm(e));
    repaintStrokes();
  };

  const onDrawPointerUp = () => {
    if (!liveStrokeRef.current) return;
    addStroke(liveStrokeRef.current);
    liveStrokeRef.current = null;
  };

  // ---- stickers --------------------------------------------------------------

  const dragRef = useRef<{
    id: string;
    mode: "move" | "transform";
    startX: number;
    startY: number;
    origin: PlacedSticker;
    /** for transform: initial pointer angle/distance from sticker center */
    startAngle?: number;
    startDist?: number;
  } | null>(null);

  const placeSticker = (stickerId: string) => {
    addSticker({
      id: crypto.randomUUID(),
      stickerId,
      x: 0.5,
      y: 0.42 + (stickers.length % 5) * 0.03,
      scale: 0.2,
      rotation: -8 + (stickers.length % 3) * 8,
    });
    setTool("stickers");
  };

  const onStickerPointerDown = (
    e: ReactPointerEvent<HTMLElement>,
    placed: PlacedSticker,
    mode: "move" | "transform",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    selectSticker(placed.id);
    const pos = toNorm(e);
    const entry: NonNullable<typeof dragRef.current> = {
      id: placed.id,
      mode,
      startX: pos.x,
      startY: pos.y,
      origin: { ...placed },
    };
    if (mode === "transform") {
      const dx = pos.x - placed.x;
      const dy = (pos.y - placed.y) * aspect; // y normalized against height — rescale so angles are true
      entry.startAngle = Math.atan2(dy, dx);
      entry.startDist = Math.hypot(dx, dy);
    }
    dragRef.current = entry;
  };

  const onStickerPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = toNorm(e);
    if (drag.mode === "move") {
      updateSticker(drag.id, {
        x: Math.min(1, Math.max(0, drag.origin.x + (pos.x - drag.startX))),
        y: Math.min(1, Math.max(0, drag.origin.y + (pos.y - drag.startY))),
      });
    } else {
      const dx = pos.x - drag.origin.x;
      const dy = (pos.y - drag.origin.y) * aspect;
      const angle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      const scale = Math.min(
        0.9,
        Math.max(0.06, drag.origin.scale * (dist / (drag.startDist || 0.001))),
      );
      const rotation =
        drag.origin.rotation + ((angle - (drag.startAngle ?? 0)) * 180) / Math.PI;
      updateSticker(drag.id, { scale, rotation });
    }
  };

  const onStickerPointerUp = () => {
    dragRef.current = null;
  };

  // ---- render ----------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
      {/* strip stage */}
      <div className="flex flex-col items-center gap-4">
        <p className="label-caps">your strip</p>
        <div
          ref={stageRef}
          className="touch-none-important relative w-[19rem] select-none overflow-hidden rounded-xl shadow-lift sm:w-[21rem]"
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
          onPointerDown={() => selectSticker(null)}
        >
          {baseUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={baseUrl} alt="photo strip" className="absolute inset-0 h-full w-full" draggable={false} />
          ) : (
            <div className="absolute inset-0 animate-pulse2 bg-ink/5" />
          )}

          {/* freehand layer */}
          <canvas
            ref={drawCanvasRef}
            className={`absolute inset-0 h-full w-full ${
              tool === "draw" ? "cursor-crosshair" : "pointer-events-none"
            }`}
            onPointerDown={onDrawPointerDown}
            onPointerMove={onDrawPointerMove}
            onPointerUp={onDrawPointerUp}
            onPointerCancel={onDrawPointerUp}
          />

          {/* stickers layer */}
          {stickers.map((placed) => {
            const def = getSticker(placed.stickerId);
            const selectedNow = placed.id === selectedStickerId;
            return (
              <div
                key={placed.id}
                className="absolute"
                style={{
                  left: `${placed.x * 100}%`,
                  top: `${placed.y * 100}%`,
                  width: `${placed.scale * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${placed.rotation}deg)`,
                  pointerEvents: tool === "draw" ? "none" : "auto",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stickerDataUrl(def)}
                  alt={def.label}
                  draggable={false}
                  className={`w-full cursor-grab active:cursor-grabbing ${
                    selectedNow ? "rounded-lg outline outline-2 outline-dashed outline-bluey/70" : ""
                  }`}
                  style={{ aspectRatio: `1 / ${def.aspect}` }}
                  onPointerDown={(e) => onStickerPointerDown(e, placed, "move")}
                  onPointerMove={onStickerPointerMove}
                  onPointerUp={onStickerPointerUp}
                  onPointerCancel={onStickerPointerUp}
                />
                {selectedNow && (
                  <>
                    <button
                      className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white shadow-soft"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        removeSticker(placed.id);
                      }}
                      aria-label="delete sticker"
                    >
                      ✕
                    </button>
                    <span
                      className="absolute -bottom-3 -right-3 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-full bg-bluey text-[10px] text-white shadow-soft"
                      onPointerDown={(e) => onStickerPointerDown(e, placed, "transform")}
                      onPointerMove={onStickerPointerMove}
                      onPointerUp={onStickerPointerUp}
                      onPointerCancel={onStickerPointerUp}
                      aria-label="resize and rotate"
                    >
                      ⤡
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* tools */}
      <div className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex gap-2">
          {(["stickers", "draw"] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTool(t);
                if (t === "draw") selectSticker(null);
              }}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                tool === t ? "bg-ink text-white shadow-soft" : "bg-card shadow-soft hover:bg-ink/5"
              }`}
            >
              {t === "stickers" ? "🎀 Stickers" : "✏️ Draw"}
            </button>
          ))}
        </div>

        {tool === "stickers" ? (
          <div className="card grid grid-cols-4 gap-2 p-4">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => placeSticker(s.id)}
                className="flex aspect-square items-center justify-center rounded-xl bg-cream p-2 transition hover:-translate-y-0.5 hover:shadow-soft"
                aria-label={`add ${s.label} sticker`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stickerDataUrl(s)} alt={s.label} className="max-h-full max-w-full" />
              </button>
            ))}
            <p className="col-span-4 pt-1 text-center text-[11px] text-muted">
              tap to add · drag to move · corner handle resizes &amp; spins
            </p>
          </div>
        ) : (
          <div className="card flex flex-col gap-4 p-4">
            <div className="flex items-center justify-center gap-3">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`h-8 w-8 rounded-full border border-ink/10 transition ${
                    penColor === c ? "scale-110 ring-2 ring-ink ring-offset-2" : ""
                  }`}
                  style={{ background: c }}
                  aria-label={`pen color ${c}`}
                />
              ))}
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={undoStroke} className="btn-ghost px-4 py-2 text-xs">
                ↩ undo
              </button>
              <button onClick={clearStrokes} className="btn-ghost px-4 py-2 text-xs">
                🧽 clear
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 lg:justify-start">
          {amOwner ? (
            <>
              <button onClick={onRetake} className="btn-ghost px-4 text-xs">
                ↺ retake last shot
              </button>
              <button onClick={onNext} className="btn-primary">
                next <span aria-hidden>▷</span>
              </button>
            </>
          ) : (
            <p className="animate-pulse2 text-center text-sm font-medium text-muted">
              decorate away — your partner finishes it up
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
