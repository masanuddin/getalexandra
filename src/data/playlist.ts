export type SongConfig = {
  /** shared base filename in /public/music, no extension (spaces are fine) */
  file: string;
  title: string;
  artist: string;
  /**
   * only needed when the cover doesn't live at /music/covers/<file>.jpg —
   * e.g. a .png or a remote URL. Write it unencoded (raw spaces are fine).
   */
  cover?: string;
};

export type Song = {
  title: string;
  artist: string;
  src: string;
  cover: string;
};

/** the song every fresh page load starts on, by `file` basename */
export const DEFAULT_TRACK = "Sempurnanya Aku";

const SONGS: SongConfig[] = [
  { file: "Sempurnanya Aku", title: "Sempurnanya Aku", artist: "NPD" },
  { file: "Iris", title: "Iris", artist: "Goo Goo Dolls" },
  { file: "PandanganPertama", title: "Pandangan Pertama", artist: "RAN" },
  { file: "TehHijau", title: "Teh Hijau", artist: "Tulus" },
  { file: "ShapeofMyHeart", title: "Shape of My Heart", artist: "Backstreet Boys" },
  { file: "SoundofRain", title: "Sound of Rain", artist: "LANY" },
];

// derive the full URLs from the shared basename; encodeURI exactly once so
// filenames with spaces fetch correctly (overrides are written unencoded)
const buildTrack = ({ file, title, artist, cover }: SongConfig): Song => ({
  title,
  artist,
  src: encodeURI(`/music/${file}.mp3`),
  cover: encodeURI(cover ?? `/music/covers/${file}.jpg`),
});

export const PLAYLIST: Song[] = SONGS.map(buildTrack);

/** initial track index, pinned to DEFAULT_TRACK regardless of array order */
export const DEFAULT_TRACK_INDEX = Math.max(
  0,
  SONGS.findIndex((s) => s.file === DEFAULT_TRACK),
);
