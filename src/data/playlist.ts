export type Song = {
  title: string;
  artist: string;
  src: string; // path under /public, e.g. "/music/SempurnanyaAku.mp3"
  cover: string; // local path under /public ("/music/covers/...") or a remote URL
};

export const PLAYLIST: Song[] = [
  {
    title: "Sempurnanya Aku",
    artist: "NPD",
    src: "/music/SempurnanyaAku.mp3",
    cover: "/music/covers/SempurnanyaAku.jpg",
  },
];
