import Link from "next/link";
import { CursorChip } from "@/components/CursorChip";
import { Nav } from "@/components/Nav";
import { StripPreview } from "@/components/StripPreview";

const CAROUSEL = [
  { frameId: "hearts", emojis: ["🥰", "😚", "🤞", "💕", "😙", "🫶", "😊", "💌"] },
  { frameId: "gingham", emojis: ["😂", "🤪", "😜", "🎀", "😝", "🐰", "😆", "🌷"] },
  { frameId: "dots", emojis: ["😎", "🕶️", "✌️", "🍋", "😏", "⭐", "🤙", "🍒"] },
  { frameId: "cherry", emojis: ["😽", "💋", "🌹", "💘", "🥹", "💐", "😻", "🍓"] },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh overflow-x-clip">
      <Nav />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-10 md:grid-cols-[1.2fr_0.8fr] md:gap-6 md:pt-16">
        {/* left: hero copy */}
        <div className="relative">
          <CursorChip who="me" className="absolute -top-6 right-[12%] hidden animate-floaty md:block" />
          <CursorChip who="you" className="absolute bottom-[18%] left-[55%] hidden animate-floaty2 md:block" />

          <p className="label-caps">made for two · 인생네컷 &amp; more</p>

          <h1 className="mt-5 max-w-xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Fun Dates for <span className="text-pinky">Long</span>{" "}
            <span className="text-bluey">Distance</span> Relationships
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-ink/60">
            One little corner of the internet that&apos;s just for the two of
            you. Hop into the same photobooth from opposite sides of the world,
            count down together, and walk away with a strip you both keep.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link href="/room" className="btn-primary text-base">
              Open the photobooth <span aria-hidden>→</span>
            </Link>
            <span className="cursor-default text-sm font-semibold text-ink/50 hover:text-ink">
              Browse activities
            </span>
            <span className="cursor-default text-sm font-semibold text-ink/50 hover:text-ink">
              Create a date <span aria-hidden>→</span>
            </span>
          </div>

          <div className="mt-14 flex flex-wrap gap-3">
            {[
              ["🎞️", "synced 4-cut strips"],
              ["🎥", "live video while you pose"],
              ["🎀", "stickers & doodles"],
            ].map(([icon, label]) => (
              <span
                key={label}
                className="card flex items-center gap-2 px-4 py-2 text-xs font-semibold text-ink/70"
              >
                <span aria-hidden>{icon}</span> {label}
              </span>
            ))}
          </div>
        </div>

        {/* right: auto-scrolling strip carousel */}
        <div className="relative mx-auto h-[26rem] w-full max-w-[24rem] overflow-hidden md:h-[34rem] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
          <div className="flex justify-center gap-5">
            <div className="animate-stripscroll space-y-5">
              {[...CAROUSEL, ...CAROUSEL].map((s, i) => (
                <StripPreview key={i} frameId={s.frameId} emojis={s.emojis} width="10rem" />
              ))}
            </div>
            <div className="hidden animate-stripscroll space-y-5 [animation-delay:-11s] sm:block">
              {[...CAROUSEL.slice(2), ...CAROUSEL.slice(0, 2), ...CAROUSEL.slice(2), ...CAROUSEL.slice(0, 2)].map(
                (s, i) => (
                  <StripPreview key={i} frameId={s.frameId} emojis={s.emojis} width="10rem" />
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-10 text-xs text-muted">
        <span>♡ made for the two of you</span>
        <span>getalexandra · {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
