import { addDays, dayOf, eachDay, MONTHS_GEN, parseDay, startOfWeek, weekdayIndex, type DayKey } from "./dates";
import type { LedgerEntry } from "./finance";
import type { Minor } from "./money";
import type { Category, ID, Note, Task } from "../store/types";

export interface WeekCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: Minor;
  share: number;
}

/** Money and tasks of one Monday–Sunday week, side by side. */
export interface WeekSummary {
  from: DayKey;
  to: DayKey;
  /** «2 – 8 ноября» */
  label: string;
  income: Minor;
  expense: Minor;
  net: Minor;
  /** Spending against the week before, null when that week had none */
  expenseChange: number | null;
  top: WeekCategory[];
  biggest: { title: string; amount: Minor; day: DayKey; icon: string; color: string } | null;
  /** Days of the week (up to today) without a single expense */
  noSpendDays: number;
  daysCounted: number;
  tasksDone: number;
  /** Main things of the day: picked and done */
  focusTotal: number;
  focusDone: number;
  /** Weekday with most tasks done (0 = Monday), null without any */
  bestDay: { weekday: number; done: number } | null;
  /** Diary entries written this week */
  journalDays: number;
  /** Open tasks already set for the next week */
  nextWeekTasks: number;
  /** Anything happened at all */
  empty: boolean;
}

const OTHER = { name: "Без категории", icon: "CircleDashed", color: "#7C7C84" };

export function weekLabel(from: DayKey, to: DayKey): string {
  const a = parseDay(from);
  const b = parseDay(to);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}

/**
 * The week worth reviewing today: on Sunday the week now ending, on Monday
 * the one just finished. Other days — none.
 */
export function weekToReview(today: DayKey): DayKey | null {
  const wd = weekdayIndex(today);
  if (wd === 6) return startOfWeek(today);
  if (wd === 0) return addDays(startOfWeek(today), -7);
  return null;
}

export function weekSummary(entries: LedgerEntry[], tasks: Task[], notes: Note[], categories: Map<ID, Category>, weekStart: DayKey, today: DayKey): WeekSummary {
  const from = startOfWeek(weekStart);
  const to = addDays(from, 6);
  const prevFrom = addDays(from, -7);
  const prevTo = addDays(from, -1);

  let income = 0;
  let expense = 0;
  let prevExpense = 0;
  const byCat = new Map<string, Minor>();
  const spendDays = new Set<DayKey>();
  let biggest: WeekSummary["biggest"] = null;
  for (const e of entries) {
    if (e.day >= prevFrom && e.day <= prevTo && e.tx.kind === "expense") prevExpense += e.base;
    if (e.day < from || e.day > to) continue;
    if (e.tx.kind === "income") income += e.base;
    else if (e.tx.kind === "expense") {
      expense += e.base;
      spendDays.add(e.day);
      const k = e.tx.categoryId ?? "";
      byCat.set(k, (byCat.get(k) ?? 0) + e.base);
      if (!biggest || e.base > biggest.amount) {
        const c = e.tx.categoryId ? categories.get(e.tx.categoryId) : undefined;
        biggest = { title: e.tx.note || c?.name || "Расход", amount: e.base, day: e.day, icon: c?.icon ?? OTHER.icon, color: c?.color ?? OTHER.color };
      }
    }
  }

  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, amount]) => {
      const c = id ? categories.get(id) : undefined;
      return { id, name: c?.name ?? OTHER.name, icon: c?.icon ?? OTHER.icon, color: c?.color ?? OTHER.color, amount, share: expense ? amount / expense : 0 };
    });

  const counted = eachDay(from, today < to ? today : to).filter((d) => d >= from);
  const noSpendDays = counted.filter((d) => !spendDays.has(d)).length;

  const doneByDay = [0, 0, 0, 0, 0, 0, 0];
  let tasksDone = 0;
  let focusTotal = 0;
  let focusDone = 0;
  let nextWeekTasks = 0;
  const nextFrom = addDays(to, 1);
  const nextTo = addDays(to, 7);
  for (const t of tasks) {
    if (t.done && t.doneAt) {
      const d = dayOf(t.doneAt);
      if (d >= from && d <= to) {
        tasksDone++;
        doneByDay[weekdayIndex(d)]++;
      }
    }
    if (t.focus && t.focus >= from && t.focus <= to) {
      focusTotal++;
      if (t.done) focusDone++;
    }
    if (!t.done && t.due && t.due >= nextFrom && t.due <= nextTo) nextWeekTasks++;
  }
  const best = Math.max(...doneByDay);
  const journalDays = notes.filter((n) => n.journal && n.journal >= from && n.journal <= to).length;

  return {
    from,
    to,
    label: weekLabel(from, to),
    income,
    expense,
    net: income - expense,
    expenseChange: prevExpense > 0 ? (expense - prevExpense) / prevExpense : null,
    top,
    biggest,
    noSpendDays,
    daysCounted: counted.length,
    tasksDone,
    focusTotal,
    focusDone,
    bestDay: best > 0 ? { weekday: doneByDay.indexOf(best), done: best } : null,
    journalDays,
    nextWeekTasks,
    empty: income === 0 && expense === 0 && tasksDone === 0
  };
}
