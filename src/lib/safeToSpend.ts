import { diffDays, endOfMonth, startOfMonth, type DayKey } from "./dates";
import { scheduledBetween } from "./analytics";
import { rateOf, totalWallets, type LedgerEntry } from "./finance";
import type { Minor } from "./money";
import type { AppData, ID } from "../store/types";

export interface SafeToSpend {
  /** What can still be spent today (negative — over the limit) */
  today: Minor;
  /** Today's allowance before today's spending */
  allowance: Minor;
  spentToday: Minor;
  /** Days left in the month, today included */
  daysLeft: number;
  /** Known payments and plans until the end of the month (incl. today) */
  obligations: Minor;
  /** Which limit is tighter: money in everyday wallets or the monthly budget */
  basis: "cash" | "budget";
}

/**
 * «Можно потратить сегодня»: money available for everyday spending until the
 * end of the month, spread evenly over the days left.
 *
 * cash   — everyday wallets (savings and investments excluded) plus expected
 *          income, minus known payments, plans and debts due this month;
 * budget — the overall monthly budget minus what was spent before today and
 *          what is already scheduled.
 * The tighter of the two wins. Today's spending is added back to get the
 * start-of-day pool, so spending X today lowers the figure by exactly X.
 * Transfers between your own wallets don't change it.
 */
export function safeToSpend(data: AppData, balances: Record<ID, Minor>, entries: LedgerEntry[], today: DayKey): SafeToSpend | null {
  const everyday = totalWallets(data.wallets).filter((w) => w.kind !== "savings" && w.kind !== "investment");
  if (!everyday.length) return null;
  const everydayIds = new Set(everyday.map((w) => w.id));

  let available = 0;
  for (const w of everyday) {
    const r = rateOf(w.currency, data.settings);
    if (r === null) continue;
    available += Math.round((balances[w.id] ?? 0) * r);
  }

  const mFrom = startOfMonth(today);
  const mTo = endOfMonth(today);
  const daysLeft = diffDays(mTo, today) + 1;

  let spentToday = 0;
  let spentTodayEveryday = 0;
  let spentBeforeToday = 0;
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < mFrom || e.day > today) continue;
    if (e.day === today) {
      spentToday += e.base;
      if (e.tx.walletId && everydayIds.has(e.tx.walletId)) spentTodayEveryday += e.base;
    } else spentBeforeToday += e.base;
  }

  // Plans due today that haven't happened yet still count; regular payments
  // due today were already posted when the app opened.
  const sch = scheduledBetween(data, today, mTo);
  const pool = available + spentTodayEveryday + sch.income - sch.expense;
  const cashAllowance = Math.floor(pool / daysLeft);

  let allowance = cashAllowance;
  let basis: SafeToSpend["basis"] = "cash";
  const overall = data.budgets.find((b) => b.categoryId === null);
  if (overall) {
    const scheduledSpend = scheduledBetween(data, today, mTo, false).expense;
    const budgetAllowance = Math.floor((overall.limit - spentBeforeToday - scheduledSpend) / daysLeft);
    if (budgetAllowance < cashAllowance) {
      allowance = budgetAllowance;
      basis = "budget";
    }
  }
  allowance = Math.floor(allowance / 100) * 100;
  const spent = basis === "budget" ? spentToday : spentTodayEveryday;
  return { today: allowance - spent, allowance, spentToday: spent, daysLeft, obligations: sch.expense, basis };
}

