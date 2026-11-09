import { addDays, startOfMonth, type DayKey } from "./dates";
import type { LedgerEntry } from "./finance";
import type { Minor } from "./money";
import { doneStreak } from "./tasks";
import type { Note, Task, Transaction } from "../store/types";

export type AchievementId = "first" | "hundred" | "normWeek" | "tasksStreak" | "plusMonth" | "halfGoal" | "goalDone" | "journal";

export interface Achievement {
  id: AchievementId;
  done: boolean;
  /** 0…1 on the way there */
  progress: number;
}

export interface Progress {
  /** Days in a row, ending yesterday, within the daily norm (or without spending) */
  normStreak: number;
  /** Days in a row with a completed task */
  tasksStreak: number;
  /** Months of the last twelve that ended with more coming in than going out */
  plusMonths: number;
  achievements: Achievement[];
}

/**
 * The personal side of the profile: streaks and achievements, from what is
 * already recorded. `norm` is today's daily allowance; `goalShares` — each
 * goal's progress, 0…1.
 */
export function personalProgress(input: { entries: LedgerEntry[]; transactions: Transaction[]; tasks: Task[]; notes: Note[]; goalShares: number[]; norm: Minor; today: DayKey }): Progress {
  const { entries, transactions, tasks, notes, goalShares, norm, today } = input;

  const spent = new Map<DayKey, Minor>();
  const net = new Map<DayKey, Minor>();
  for (const e of entries) {
    if (e.tx.kind === "expense") spent.set(e.day, (spent.get(e.day) ?? 0) + e.base);
    if (e.tx.kind === "expense" || e.tx.kind === "income") {
      const m = startOfMonth(e.day);
      net.set(m, (net.get(m) ?? 0) + (e.tx.kind === "income" ? e.base : -e.base));
    }
  }

  let normStreak = 0;
  if (norm > 0 && entries.length) {
    const first = entries.reduce((a, e) => (e.day < a ? e.day : a), today);
    for (let d = addDays(today, -1); d >= first && (spent.get(d) ?? 0) <= norm; d = addDays(d, -1)) normStreak++;
  }

  const thisMonth = startOfMonth(today);
  const months = [...net.entries()].filter(([m]) => m < thisMonth).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12);
  const plusMonths = months.filter(([, v]) => v > 0).length;
  const lastMonthPlus = months.length > 0 && months[0][1] > 0;

  const tasksStreak = doneStreak(tasks, today);
  const journal = notes.filter((n) => n.journal).length;
  const bestGoal = Math.max(0, ...goalShares);
  const n = transactions.length;

  const a = (id: AchievementId, progress: number): Achievement => ({ id, done: progress >= 1, progress: Math.max(0, Math.min(1, progress)) });
  return {
    normStreak,
    tasksStreak,
    plusMonths,
    achievements: [
      a("first", n > 0 ? 1 : 0),
      a("hundred", n / 100),
      a("normWeek", normStreak / 7),
      a("tasksStreak", tasksStreak / 5),
      a("plusMonth", lastMonthPlus ? 1 : 0),
      a("halfGoal", bestGoal / 0.5),
      a("goalDone", bestGoal),
      a("journal", journal / 7)
    ]
  };
}
