import type { Frequency, Recurring } from "../store/types";
import type { Minor } from "./money";
import { addDays, addMonths, parseDay, plural, type DayKey } from "./dates";

export function nextAfter(date: DayKey, freq: Frequency, interval: number, anchorDay?: number): DayKey {
  const n = Math.max(1, interval);
  switch (freq) {
    case "day":
      return addDays(date, n);
    case "week":
      return addDays(date, 7 * n);
    case "month":
      return addMonths(date, n, anchorDay);
    case "year":
      return addMonths(date, 12 * n, anchorDay);
  }
}

/** All occurrences of a series between two days (inclusive), starting from its next date. */
export function occurrencesInRange(r: Pick<Recurring, "nextDate" | "freq" | "interval" | "anchorDay">, from: DayKey, to: DayKey, limit = 400): DayKey[] {
  const out: DayKey[] = [];
  let d = r.nextDate;
  let guard = 0;
  while (d <= to && guard++ < limit) {
    if (d >= from) out.push(d);
    d = nextAfter(d, r.freq, r.interval, r.anchorDay);
  }
  return out;
}

/** Normalised monthly cost of a series. */
export function monthlyEquivalent(r: Pick<Recurring, "amount" | "freq" | "interval">): Minor {
  const n = Math.max(1, r.interval);
  switch (r.freq) {
    case "day":
      return Math.round((r.amount * 30.44) / n);
    case "week":
      return Math.round((r.amount * 52) / 12 / n);
    case "month":
      return Math.round(r.amount / n);
    case "year":
      return Math.round(r.amount / 12 / n);
  }
}

export function freqLabel(freq: Frequency, interval = 1): string {
  if (interval <= 1) {
    return { day: "Каждый день", week: "Каждую неделю", month: "Каждый месяц", year: "Каждый год" }[freq];
  }
  const forms: Record<Frequency, [string, string, string]> = {
    day: ["день", "дня", "дней"],
    week: ["неделю", "недели", "недель"],
    month: ["месяц", "месяца", "месяцев"],
    year: ["год", "года", "лет"]
  };
  return `Каждые ${interval} ${plural(interval, forms[freq])}`;
}

export function freqShort(freq: Frequency, interval = 1): string {
  if (interval <= 1) return { day: "в день", week: "в неделю", month: "в месяц", year: "в год" }[freq];
  return freqLabel(freq, interval).toLowerCase();
}

export function anchorOf(day: DayKey): number {
  return parseDay(day).getDate();
}
