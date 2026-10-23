import { addMonths, diffDays, endOfMonth, MONTHS_GEN, MONTHS_NOM, parseDay, startOfMonth, type DayKey } from "./dates";
import { habits } from "./analytics";
import { pctChange, periodStats, type LedgerEntry } from "./finance";
import type { Minor } from "./money";
import type { Category, ID } from "../store/types";

export interface StoryCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: Minor;
  share: number;
}

export interface MonthSummary {
  /** First day of the month */
  month: DayKey;
  /** «октябрь», «октября» (+ year when it isn't the current one) */
  nameNom: string;
  nameGen: string;
  prevNameGen: string;
  /** «в сентябре» */
  prevNamePrep: string;
  income: Minor;
  expense: Minor;
  net: Minor;
  /** Share of income left after expenses, null without income */
  savingsRate: number | null;
  /** Expense change against the previous month, null without data */
  expenseChange: number | null;
  purchases: number;
  avgPerDay: Minor;
  days: number;
  top: StoryCategory[];
  biggest: { title: string; amount: Minor; day: DayKey; icon: string; color: string } | null;
  noSpendDays: number;
  peakWeekday: number | null;
  weekday: Minor[];
}

const OTHER = { name: "Без категории", icon: "CircleDashed", color: "#7C7C84" };

/** Everything the monthly story tells, computed from base-currency ledger entries. */
export function monthSummary(entries: LedgerEntry[], categories: Map<ID, Category>, anyDay: DayKey, today: DayKey): MonthSummary {
  const from = startOfMonth(anyDay);
  const to = endOfMonth(anyDay);
  const end = today < to ? today : to;
  const prevFrom = addMonths(from, -1, 1);
  const range = { period: "month" as const, offset: 0, from, to, label: "", days: diffDays(to, from) + 1 };
  const prevRange = { ...range, from: prevFrom, to: endOfMonth(prevFrom) };
  const cur = periodStats(entries, range, today);
  const prev = periodStats(entries, prevRange, today);
  const h = habits(entries, from, end);

  const top: StoryCategory[] = [...cur.expenseByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amount]) => {
      const c = categories.get(id);
      return { id, name: c?.name ?? OTHER.name, icon: c?.icon ?? OTHER.icon, color: c?.color ?? OTHER.color, amount, share: cur.expense ? amount / cur.expense : 0 };
    });

  let biggest: MonthSummary["biggest"] = null;
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < from || e.day > to) continue;
    if (!biggest || e.base > biggest.amount) {
      const c = e.tx.categoryId ? categories.get(e.tx.categoryId) : undefined;
      biggest = { title: e.tx.note || c?.name || "Расход", amount: e.base, day: e.day, icon: c?.icon ?? OTHER.icon, color: c?.color ?? OTHER.color };
    }
  }

  const d = parseDay(from);
  const year = d.getFullYear() !== parseDay(today).getFullYear() ? ` ${d.getFullYear()}` : "";
  const days = Math.max(1, diffDays(end, from) + 1);
  return {
    month: from,
    nameNom: MONTHS_NOM[d.getMonth()] + year,
    nameGen: MONTHS_GEN[d.getMonth()] + year,
    prevNameGen: MONTHS_GEN[parseDay(prevFrom).getMonth()],
    // genitive → prepositional: сентября → сентябре, мая → мае, марта → марте
    prevNamePrep: MONTHS_GEN[parseDay(prevFrom).getMonth()].replace(/[яа]$/, "е"),
    income: cur.income,
    expense: cur.expense,
    net: cur.net,
    savingsRate: cur.income > 0 ? cur.net / cur.income : null,
    expenseChange: pctChange(cur.expense, prev.expense),
    purchases: h.expenseCount,
    avgPerDay: Math.round(cur.expense / days / 100) * 100,
    days,
    top,
    biggest,
    noSpendDays: h.noSpendDays,
    peakWeekday: h.peakWeekday,
    weekday: h.weekday
  };
}

/** A month is worth a story once it has a handful of expenses. */
export function hasStory(s: MonthSummary): boolean {
  return s.purchases >= 5;
}

export const monthKey = (day: DayKey) => day.slice(0, 7);
