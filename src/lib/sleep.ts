import { addDays, type DayKey } from "./dates";
import type { SleepEntry } from "../store/types";

/** Wanted sleep when the user did not set one: 8 hours. */
export const DEFAULT_SLEEP_GOAL = 480;

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Minutes slept: from going to bed to waking, across midnight when needed. Never more than 24 h. */
export function sleepMinutes(bed: string, wake: string): number {
  const b = toMin(bed);
  const w = toMin(wake);
  const d = w - b;
  return d > 0 ? d : d + 1440;
}

/** «7 ч 20 мин» parts. */
export const hm = (min: number): { h: number; m: number } => ({ h: Math.floor(min / 60), m: Math.round(min % 60) });

/** Bed time on a clock that runs 18:00 → 18:00, so 23:30 and 00:30 are an hour apart. */
const bedAxis = (hhmm: string): number => {
  const m = toMin(hhmm);
  return m < 18 * 60 ? m + 1440 : m;
};

/** Mean bed time in "HH:mm" (late-night aware). */
export function meanBed(entries: SleepEntry[]): string | null {
  if (!entries.length) return null;
  return fromMin(entries.reduce((s, e) => s + bedAxis(e.bed), 0) / entries.length);
}

export interface SleepStats {
  nights: number;
  avgMin: number;
  avgQuality: number;
  avgBed: string | null;
  /** Standard deviation of bed time, minutes — the lower, the steadier */
  bedSpread: number;
  /** Minutes short of the goal, summed over the nights */
  debt: number;
  avgMood: number | null;
  avgEnergy: number | null;
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function entriesBetween(all: SleepEntry[], from: DayKey, to: DayKey): SleepEntry[] {
  return all.filter((e) => e.day >= from && e.day <= to).sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function sleepStats(entries: SleepEntry[], goal = DEFAULT_SLEEP_GOAL): SleepStats {
  const mins = entries.map((e) => sleepMinutes(e.bed, e.wake));
  const beds = entries.map((e) => bedAxis(e.bed));
  const meanB = avg(beds);
  const moods = entries.filter((e) => e.mood).map((e) => e.mood as number);
  const energies = entries.filter((e) => e.energy).map((e) => e.energy as number);
  return {
    nights: entries.length,
    avgMin: avg(mins),
    avgQuality: avg(entries.map((e) => e.quality)),
    avgBed: meanBed(entries),
    bedSpread: entries.length > 1 ? Math.sqrt(avg(beds.map((b) => (b - meanB) ** 2))) : 0,
    debt: mins.reduce((s, m) => s + Math.max(0, goal - m), 0),
    avgMood: moods.length ? avg(moods) : null,
    avgEnergy: energies.length ? avg(energies) : null
  };
}

/** 0–100: duration against the goal (65 %) and how rested you felt (35 %). More than the goal does not add. */
export function sleepScore(e: SleepEntry, goal = DEFAULT_SLEEP_GOAL): number {
  const dur = Math.min(1, sleepMinutes(e.bed, e.wake) / goal);
  return Math.round(dur * 65 + ((e.quality - 1) / 4) * 35);
}

/** Last `days` days ending at `end`, one slot per day (null where nothing was recorded). */
export function lastDays(all: SleepEntry[], end: DayKey, days: number): Array<{ day: DayKey; entry: SleepEntry | null }> {
  const by = new Map(all.map((e) => [e.day, e]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(end, i - (days - 1));
    return { day, entry: by.get(day) ?? null };
  });
}

/** Nights in a row up to `today` (or yesterday, if today is not recorded yet). */
export function sleepStreak(all: SleepEntry[], today: DayKey): number {
  const have = new Set(all.map((e) => e.day));
  let d = have.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (have.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface SleepInsight {
  kind: "mood" | "bed" | "debt";
  /** Numbers for the sentence */
  a?: number;
  b?: number;
}

/** What the nights say: one or two plain observations, only when the data backs them. */
export function sleepInsights(entries: SleepEntry[], goal = DEFAULT_SLEEP_GOAL): SleepInsight[] {
  const out: SleepInsight[] = [];
  const withMood = entries.filter((e) => e.mood);
  const good = withMood.filter((e) => sleepMinutes(e.bed, e.wake) >= goal - 30);
  const short = withMood.filter((e) => sleepMinutes(e.bed, e.wake) < goal - 90);
  if (good.length >= 4 && short.length >= 4) {
    const a = avg(good.map((e) => e.mood as number));
    const b = avg(short.map((e) => e.mood as number));
    if (a - b >= 0.4) out.push({ kind: "mood", a, b });
  }
  const st = sleepStats(entries, goal);
  if (st.nights >= 5 && st.bedSpread > 60) out.push({ kind: "bed", a: Math.round(st.bedSpread) });
  if (st.nights >= 5 && st.debt / st.nights > 45) out.push({ kind: "debt", a: Math.round(st.debt / st.nights) });
  return out;
}
