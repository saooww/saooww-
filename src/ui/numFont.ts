import type { Settings } from "../store/types";

export type NumberFont = Settings["numberFont"];

/**
 * Typefaces for amounts (see styles/index.css). `scale` keeps wide faces
 * inside the same box as the others.
 */
export const NUMBER_FONTS: Array<{ id: NumberFont; label: string; scale: number }> = [
  { id: "elegant", label: "Изящные", scale: 1 },
  { id: "strict", label: "Строгие", scale: 1 },
  { id: "wide", label: "Широкие", scale: 0.84 },
  { id: "system", label: "Системные", scale: 1 }
];

export function numberFontScale(id: NumberFont): number {
  return NUMBER_FONTS.find((f) => f.id === id)?.scale ?? 1;
}
