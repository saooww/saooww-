import { addDays, addMonths, dayOf, monthTitle, type DayKey } from "./dates";
import { balanceSeries, type GoalInfo } from "./finance";
import { formatMoney, type Minor } from "./money";
import type { AppData, Goal, ID, Transaction } from "../store/types";
import { tr } from "../i18n/i18n";

/** How much the goal grew per month over the last 90 days (can be ≤ 0). */
export function goalPace(goal: Goal, data: AppData, balances: Record<ID, Minor>, today: DayKey): Minor {
  const from = addDays(today, -90);
  if (goal.walletId) {
    const s = balanceSeries(data, balances, new Set([goal.walletId]), from, today);
    return s.length > 1 ? (s[s.length - 1].value - s[0].value) / 3 : 0;
  }
  const net = data.transactions
    .filter((t: Transaction) => t.goalId === goal.id && dayOf(t.date) >= from)
    .reduce((acc, t) => acc + (t.flow === "out" ? t.amount : -t.amount), 0);
  return net / 3;
}

export type GoalStatus =
  | { kind: "done" }
  | { kind: "onTrack"; eta: DayKey | null }
  | { kind: "late"; eta: DayKey | null; needMonthly: Minor | null }
  | { kind: "stalled" }
  | { kind: "open"; eta: DayKey | null };

/**
 * Where the goal stands: reached, on track for its deadline, behind it,
 * not moving, or — without a deadline — just when it will be reached.
 */
export function goalStatus(goal: Goal, info: GoalInfo, pace: Minor, today: DayKey): GoalStatus {
  if (info.done) return { kind: "done" };
  const eta = pace > 0 ? addMonths(today, Math.ceil(info.remaining / pace)) : null;
  if (!goal.deadline) return eta ? { kind: "open", eta } : { kind: "stalled" };
  if (!eta) return info.saved > 0 ? { kind: "late", eta: null, needMonthly: info.monthly } : { kind: "stalled" };
  return eta <= goal.deadline ? { kind: "onTrack", eta } : { kind: "late", eta, needMonthly: info.monthly };
}

/** One short line for the status, with a tone. */
export function goalStatusText(s: GoalStatus, currency: string): { text: string; tone: "positive" | "warning" | "muted" } {
  switch (s.kind) {
    case "done":
      return { text: tr("Цель достигнута"), tone: "positive" };
    case "onTrack":
      return { text: s.eta ? tr("В графике · к {0}", monthTitle(s.eta, "always")) : tr("В графике"), tone: "positive" };
    case "late":
      return {
        text: s.needMonthly ? tr("Отстаёт · нужно {0}/мес", formatMoney(s.needMonthly, { currency })) : s.eta ? tr("Отстаёт · при текущем темпе к {0}", monthTitle(s.eta, "always")) : tr("Отстаёт от срока"),
        tone: "warning"
      };
    case "open":
      return { text: s.eta ? tr("При текущем темпе — {0}", monthTitle(s.eta, "always")) : tr("Без срока"), tone: "muted" };
    case "stalled":
      return { text: tr("Пополнений не было 3 месяца"), tone: "muted" };
  }
}
