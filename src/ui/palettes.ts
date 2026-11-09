import { tr } from "../i18n/i18n";
/**
 * Themes: whole palettes — background, surfaces and an accent — on top of
 * the dark or light base. «Ardessa» is the original look and follows the
 * dark/light switch; the others carry their own mode. Applied as CSS custom
 * properties on <html> and <body>, so every component follows.
 */
export type PaletteId = "ardessa" | "mono" | "midnight" | "forest" | "plum" | "mocha" | "sakura" | "ocean" | "sand";

export interface Palette {
  id: PaletteId;
  name: string;
  /** Fixed mode; none — follows the dark/light setting */
  mode?: "dark" | "light";
  accent?: string;
  /** Background, surface, raised tile, sheet, segmented thumb */
  bg?: string;
  surface?: string;
  surface3?: string;
  tile?: string;
  sheet?: string;
  seg?: string;
}

export const PALETTES: Palette[] = [
  { id: "ardessa", name: "Ardessa" },
  { id: "mono", name: tr("Моно"), mode: "dark", accent: "#f4f2ef", bg: "#000000", surface: "#101010", surface3: "#1f1f1f", tile: "#1a1a1a", sheet: "#161616", seg: "#2a2a2a" },
  { id: "midnight", name: tr("Полночь"), mode: "dark", accent: "#5b8cff", bg: "#060a14", surface: "#0e1424", surface3: "#1b2338", tile: "#18213a", sheet: "#141c30", seg: "#26304a" },
  { id: "forest", name: tr("Лес"), mode: "dark", accent: "#e9b44c", bg: "#050b08", surface: "#0d1712", surface3: "#1a2a21", tile: "#16251d", sheet: "#122019", seg: "#22362b" },
  { id: "plum", name: tr("Слива"), mode: "dark", accent: "#e879b9", bg: "#0c060f", surface: "#170e1b", surface3: "#28192e", tile: "#221628", sheet: "#1c1221", seg: "#33223a" },
  { id: "mocha", name: tr("Мокко"), mode: "dark", accent: "#e07a4f", bg: "#0d0906", surface: "#19130e", surface3: "#2a2119", tile: "#241c15", sheet: "#1f1812", seg: "#352a20" },
  { id: "sakura", name: tr("Сакура"), mode: "light", accent: "#d9386f", bg: "#fbf0f2", surface: "#ffffff", surface3: "#f4e1e6", tile: "#f9ebee", sheet: "#ffffff", seg: "#ffffff" },
  { id: "ocean", name: tr("Океан"), mode: "light", accent: "#1769c4", bg: "#edf3f8", surface: "#ffffff", surface3: "#dbe6ef", tile: "#eef3f8", sheet: "#ffffff", seg: "#ffffff" },
  { id: "sand", name: tr("Песок"), mode: "light", accent: "#b5561f", bg: "#f4ede2", surface: "#fffcf6", surface3: "#e9dfcf", tile: "#f5eee3", sheet: "#fffcf6", seg: "#fffcf6" }
];

export const paletteOf = (id?: string): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Relative luminance of a #rrggbb colour, 0…1 */
function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Every accent token from one colour: lighter and darker steps, a soft tint, text on it. */
export function accentVars(hex: string, mode: "dark" | "light"): Record<string, string> {
  const light = luminance(hex) > 0.45;
  return {
    "--accent": hex,
    "--accent-hi": `color-mix(in srgb, ${hex} 82%, white)`,
    "--accent-lo": `color-mix(in srgb, ${hex} 80%, black)`,
    "--accent-press": `color-mix(in srgb, ${hex} 88%, black)`,
    "--accent-soft": `color-mix(in srgb, ${hex} ${mode === "dark" ? 16 : 11}%, transparent)`,
    // accent as text: lifted on dark, deepened on light so it stays readable
    "--accent-ink": mode === "dark" ? `color-mix(in srgb, ${hex} 85%, white)` : `color-mix(in srgb, ${hex} 78%, black)`,
    "--accent-glow": `color-mix(in srgb, ${hex} 40%, transparent)`,
    "--accent-on": light ? "#0b0a09" : "#ffffff"
  };
}

/** Surface tokens of a palette (empty for «Ardessa»: the stylesheet's own). */
export function paletteVars(p: Palette): Record<string, string> {
  if (!p.bg) return {};
  const dark = p.mode === "dark";
  return {
    "--bg": p.bg,
    "--surface": p.surface!,
    "--surface-2": p.surface!,
    "--surface-3": p.surface3!,
    "--surface-press": `color-mix(in srgb, ${p.surface3} 80%, ${dark ? "white" : "black"} 8%)`,
    "--tile-top": p.tile!,
    "--tile-bottom": p.tile!,
    "--sheet-bg": p.sheet!,
    "--sheet-panel": dark ? `color-mix(in srgb, ${p.sheet} 85%, white 6%)` : p.surface!,
    "--sheet-tile-top": dark ? `color-mix(in srgb, ${p.tile} 80%, white 8%)` : p.tile!,
    "--sheet-tile-bottom": dark ? `color-mix(in srgb, ${p.tile} 80%, white 8%)` : p.tile!,
    "--seg-thumb": p.seg!,
    "--header-bg": `color-mix(in srgb, ${p.bg} 86%, transparent)`,
    "--tabbar-bg": `color-mix(in srgb, ${dark ? p.surface3 : p.surface} 88%, transparent)`
  };
}

export const ALL_THEME_VARS = [
  ...Object.keys(accentVars("#000000", "dark")),
  ...Object.keys(paletteVars({ id: "mono", name: "", mode: "dark", bg: "#000", surface: "#000", surface3: "#000", tile: "#000", sheet: "#000", seg: "#000" }))
];
