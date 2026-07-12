"use client";

import { useRef } from "react";
import { StripPreview } from "@/components/StripPreview";
import { FRAMES } from "@/lib/frames";
import { useBooth } from "@/store/booth";

interface FramePickerProps {
  amOwner: boolean;
  onSelect: (frameId: string) => void;
  onNext: () => void;
  onTotalShots: (n: number) => void;
}

export function FramePicker({ amOwner, onSelect, onNext, onTotalShots }: FramePickerProps) {
  const { room } = useBooth();
  const selected = room?.frameId ?? FRAMES[0].id;
  const totalShots = room?.totalShots ?? 4;
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
      <div className="text-center">
        <p className="label-caps">patterns · themes</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          dress up your <span className="text-pinky">strip</span>
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          you both see the same pick — last tap wins 😌
        </p>
      </div>

      <div className="flex w-full max-w-3xl items-center gap-2">
        <button
          onClick={() => scrollBy(-1)}
          className="btn-ghost hidden px-3 py-2 text-xs sm:inline-flex"
          aria-label="previous pack"
        >
          ◁ packs
        </button>

        <div
          ref={scrollerRef}
          className="flex flex-1 snap-x snap-mandatory gap-5 overflow-x-auto px-2 py-4 [scrollbar-width:none]"
        >
          {FRAMES.map((frame) => (
            <button
              key={frame.id}
              onClick={() => onSelect(frame.id)}
              className={`group snap-center rounded-2xl p-2 transition ${
                selected === frame.id
                  ? "bg-ink/5 ring-2 ring-ink"
                  : "hover:bg-ink/5"
              }`}
            >
              <StripPreview frameId={frame.id} width="8.5rem" rows={3} />
              <p className="mt-2 text-center text-sm font-semibold lowercase">
                {frame.label}
                {selected === frame.id && <span className="text-pinky"> ♥</span>}
              </p>
            </button>
          ))}
        </div>

        <button
          onClick={() => scrollBy(1)}
          className="btn-ghost hidden px-3 py-2 text-xs sm:inline-flex"
          aria-label="next pack"
        >
          ▷
        </button>
      </div>

      {/* pagination dots */}
      <div className="flex gap-1.5">
        {FRAMES.map((f) => (
          <span
            key={f.id}
            className={`h-1.5 rounded-full transition-all ${
              selected === f.id ? "w-5 bg-ink" : "w-1.5 bg-ink/20"
            }`}
          />
        ))}
      </div>

      {amOwner ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink/70">
            <span className="label-caps">shots</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => onTotalShots(n)}
                className={`h-8 w-8 rounded-full text-sm font-bold transition ${
                  totalShots === n
                    ? "bg-ink text-white"
                    : "bg-card shadow-soft hover:bg-ink/5"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button onClick={onNext} className="btn-primary">
            next <span aria-hidden>▷</span>
          </button>
        </div>
      ) : (
        <p className="animate-pulse2 text-sm font-medium text-muted">
          your partner hits next when you&apos;re both ready…
        </p>
      )}
    </div>
  );
}
