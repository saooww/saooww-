import type { Frequency, Recurring, Transaction } from "../store/types";
import type { Minor } from "./money";
import { addDays, addMonths, diffDays, parseDay, plural, type DayKey } from "./dates";
import { tr } from "../i18n/i18n";

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
    return { day: tr("Каждый день"), week: tr("Каждую неделю"), month: tr("Каждый месяц"), year: tr("Каждый год") }[freq];
  }
  const forms: Record<Frequency, [string, string, string]> = {
    day: ["день", "дня", "дней"],
    week: ["неделю", "недели", "недель"],
    month: ["месяц", "месяца", "месяцев"],
    year: ["год", "года", "лет"]
  };
  return tr("Каждые {0} {1}", interval, plural(interval, forms[freq]));
}

export function freqShort(freq: Frequency, interval = 1): string {
  if (interval <= 1) return { day: tr("в день"), week: tr("в неделю"), month: tr("в месяц"), year: tr("в год") }[freq];
  return freqLabel(freq, interval).toLowerCase();
}

export function anchorOf(day: DayKey): number {
  return parseDay(day).getDate();
}

export interface SubscriptionStats {
  /** Date of the last recorded payment, if any */
  lastPaid: DayKey | null;
  /** Date of the next one */
  next: DayKey;
  /** Days until the next payment (0 = today, negative = overdue) */
  daysLeft: number;
  /** Days between the previous and the next payment */
  cycleDays: number;
  /** How far through the current cycle we are, 0..1 */
  progress: number;
  /** Everything paid so far, in minor units of the payment's own currency */
  totalPaid: Minor;
  payments: number;
  /** Date of the first recorded payment */
  since: DayKey | null;
}

/**
 * What a subscription has cost so far and where the current cycle stands.
 * The cycle runs from the previous due date (the last payment, or one period before the next) to the next.
 */
export function subscriptionStats(r: Pick<Recurring, "id" | "nextDate" | "freq" | "interval" | "anchorDay" | "amount">, txs: Array<Pick<Transaction, "recurringId" | "date" | "amount" | "kind">>, today: DayKey): SubscriptionStats {
  const paid = txs.filter((t) => t.recurringId === r.id && (t.kind === "expense" || t.kind === "income" || t.kind === "transfer")).sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastPaid = paid.length ? paid[paid.length - 1].date.slice(0, 10) : null;
  const next = r.nextDate;
  // one period back from the next date, if no payment was ever recorded
  const prevByRule = (() => {
    const step = r.freq === "day" ? 1 : r.freq === "week" ? 7 : r.freq === "month" ? 30 : 365;
    return addDays(next, -step * Math.max(1, r.interval));
  })();
  const start = lastPaid && lastPaid < next ? lastPaid : prevByRule;
  const cycleDays = Math.max(1, diffDays(next, start));
  const daysLeft = diffDays(next, today);
  const progress = Math.max(0, Math.min(1, (cycleDays - daysLeft) / cycleDays));
  return { lastPaid, next, daysLeft, cycleDays, progress, totalPaid: paid.reduce((s, t) => s + t.amount, 0), payments: paid.length, since: paid.length ? paid[0].date.slice(0, 10) : null };
}
