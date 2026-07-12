import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="font-round text-2xl font-bold lowercase tracking-tight">
      getalexa<span className="text-pinky">.</span>
    </Link>
  );
}

export function Nav() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
      <Logo />
      <nav className="flex items-center gap-6 text-sm font-medium text-ink/70">
        <span className="hidden cursor-default sm:inline hover:text-ink">Activities</span>
        <span className="hidden cursor-default sm:inline hover:text-ink">Shop</span>
        <Link
          href="/room"
          className="rounded-2xl bg-ink px-4 py-2 text-white transition hover:-translate-y-0.5"
        >
          photobooth
        </Link>
      </nav>
    </header>
  );
}
