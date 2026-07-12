"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dataUrlToBlob, downloadDataUrl, exportStrip } from "@/lib/compositor";
import { frameIdOf, useBooth } from "@/store/booth";

export function Final() {
  const { shots, room, stickers, strokes, finalPng, setFinalPng } = useBooth();
  const frameId = frameIdOf(room);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const completeShots = useMemo(() => shots.filter((s) => s.a && s.b), [shots]);

  // each partner exports their own decorated copy at full resolution
  useEffect(() => {
    let cancelled = false;
    exportStrip(completeShots, frameId, stickers, strokes)
      .then((png) => {
        if (!cancelled) setFinalPng(png);
      })
      .catch((err) => console.error("final export failed", err));
    return () => {
      cancelled = true;
    };
  }, [completeShots, frameId, stickers, strokes, setFinalPng]);

  const filename = `getalexandraclarissa-${new Date().toISOString().slice(0, 10)}.png`;

  const download = () => {
    if (finalPng) downloadDataUrl(finalPng, filename);
  };

  const shareInstagram = async () => {
    if (!finalPng) return;
    setShareNote(null);
    try {
      const blob = await dataUrlToBlob(finalPng);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "our photobooth strip ♡",
        });
        return;
      }
      // fallback: download + nudge
      downloadDataUrl(finalPng, filename);
      setShareNote("Saved the strip — open Instagram and post it from your gallery 💗");
    } catch (err) {
      if ((err as DOMException).name !== "AbortError") {
        downloadDataUrl(finalPng, filename);
        setShareNote("Saved the strip — open Instagram and post it from your gallery 💗");
      }
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-7 py-8">
      <div className="text-center">
        <p className="label-caps">all done ♡</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          it&apos;s a <span className="text-pinky">keeper</span>
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          you both get your own copy — decorations and all.
        </p>
      </div>

      {finalPng ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={finalPng}
          alt="your finished photo strip"
          className="w-[17rem] animate-pop rounded-xl shadow-lift sm:w-[19rem]"
        />
      ) : (
        <div className="flex h-[28rem] w-[17rem] animate-pulse2 items-center justify-center rounded-xl bg-ink/5 text-sm text-muted">
          developing your strip…
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={download} disabled={!finalPng} className="btn-primary">
          ⬇ Download
        </button>
        <button onClick={shareInstagram} disabled={!finalPng} className="btn-instagram">
          Share to Instagram
        </button>
        <button onClick={copyLink} className="btn-ghost">
          {copied ? "copied ✓" : "🔗 copy link"}
        </button>
      </div>

      {shareNote && (
        <p className="max-w-sm text-center text-xs font-medium text-ink/60">{shareNote}</p>
      )}

      <Link href="/room" className="text-sm font-semibold text-ink/50 underline-offset-4 hover:text-ink hover:underline">
        take another set →
      </Link>
    </div>
  );
}
