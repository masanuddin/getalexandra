import type { Metadata, Viewport } from "next";
import { Inter, Quicksand } from "next/font/google";
import "./globals.css";
import { MusicPlayerProvider } from "@/components/music/MusicPlayerProvider";
import { MusicPlayerPanel } from "@/components/music/MusicPlayerPanel";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-round" });

export const metadata: Metadata = {
  title: "getalexandraclarissa — fun dates for long distance relationships",
  description:
    "An online photobooth for long-distance couples: join the same room, take synchronized photos together, decorate your strip, and keep the memory.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FDFBF7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${quicksand.variable} font-sans`}>
        <MusicPlayerProvider>
          {children}
          <MusicPlayerPanel />
        </MusicPlayerProvider>
      </body>
    </html>
  );
}
