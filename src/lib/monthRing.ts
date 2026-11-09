import { eachDay, endOfMonth, startOfMonth, type DayKey } from "./dates";
import type { LedgerEntry } from "./finance";
import type { Minor } from "./money";

/** How one day of the month went, for the ring of days around the sphere. */
export type DayMark = "free" | "ok" | "over" | "today" | "future";

export interface MonthDot {
  day: DayKey;
  mark: DayMark;
  spent: Minor;
}

/**
 * Every day of this month, judged against the daily norm: no spending at all,
 * within the norm, over it; today and the days ahead are marked as such.
 * Without a norm (nothing to compare to) past days only tell spent from free.
 */
export function monthDots(entries: LedgerEntry[], today: DayKey, norm: Minor): MonthDot[] {
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const spent = new Map<DayKey, Minor>();
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < from || e.day > to) continue;
    spent.set(e.day, (spent.get(e.day) ?? 0) + e.base);
  }
  return eachDay(from, to).map((day) => {
    const s = spent.get(day) ?? 0;
    if (day > today) return { day, mark: "future", spent: s };
    if (day === today) return { day, mark: "today", spent: s };
    if (s === 0) return { day, mark: "free", spent: s };
    return { day, mark: norm > 0 && s > norm ? "over" : "ok", spent: s };
  });
}
