// Theme palettes. Night is the original deep-space look; day is a soft
// morning-light diorama — same geometry, different atmosphere.

export type Theme = "night" | "day";

export interface Palette {
  bg: string;
  fogDensity: number;
  stars: boolean;
  ambient: number;
  keyIntensity: number;
  keyColor: string;
  fillColor: string;
  deck: string;
  deckNotReady: string;
  rim: string;
  rimHot: string;
  rimNotReady: string;
  underglow: string;
  text: string;
  subtext: string;
  bloom: number;
  padOpacity: number;
}

export const PALETTES: Record<Theme, Palette> = {
  night: {
    bg: "#070b14",
    fogDensity: 0.0085,
    stars: true,
    ambient: 0.35,
    keyIntensity: 1.1,
    keyColor: "#cfe0ff",
    fillColor: "#7f9cff",
    deck: "#0e1626",
    deckNotReady: "#2a1420",
    rim: "#3d6fa8",
    rimHot: "#9fd8ff",
    rimNotReady: "#a8434f",
    underglow: "#2f5f9e",
    text: "#dbe7ff",
    subtext: "#7e93b8",
    bloom: 0.9,
    padOpacity: 0.13,
  },
  day: {
    bg: "#dce6f2",
    fogDensity: 0.006,
    stars: false,
    ambient: 0.85,
    keyIntensity: 1.6,
    keyColor: "#fff4e0",
    fillColor: "#bcd2ff",
    deck: "#e9eef7",
    deckNotReady: "#f3d9dd",
    rim: "#5b83b8",
    rimHot: "#2e6fd8",
    rimNotReady: "#c0475a",
    underglow: "#9fb8dc",
    text: "#1d2b45",
    subtext: "#54688a",
    bloom: 0.25,
    padOpacity: 0.3,
  },
};

/** cool→hot color for temperature displays (°C, roughly 25..85). */
export function tempColor(c: number | null | undefined, fallback = "#39e6ff"): string {
  if (c == null) return fallback;
  const t = Math.min(1, Math.max(0, (c - 30) / 50));
  const h = 190 - t * 190; // cyan → red
  return `hsl(${h.toFixed(0)}, 90%, ${55 + t * 5}%)`;
}
