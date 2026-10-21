import type { AppData, Debt, Goal, ID, Settings, Transaction, Wallet } from "../store/types";
import type { Minor } from "./money";
import {
  addDays,
  addMonths,
  dayOf,
  diffDays,
  endOfMonth,
  MONTHS_SHORT,
  monthTitle,
  parseDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  type DayKey
} from "./dates";

/* ------------------------------------------------------------------ */
/*  Balances                                                           */
/* ------------------------------------------------------------------ */

/** Signed effect of one record on wallet balances. */
export function walletEffects(tx: Transaction): Array<[ID, Minor]> {
  switch (tx.kind) {
    case "income":
      return tx.walletId ? [[tx.walletId, tx.amount]] : [];
    case "expense":
      return tx.walletId ? [[tx.walletId, -tx.amount]] : [];
    case "transfer": {
      const out: Array<[ID, Minor]> = [];
      if (tx.walletId) out.push([tx.walletId, -tx.amount]);
      if (tx.toWalletId) out.push([tx.toWalletId, tx.toAmount ?? tx.amount]);
      return out;
    }
    default:
      if (!tx.walletId) return [];
      return [[tx.walletId, tx.flow === "out" ? -tx.amount : tx.amount]];
  }
}

export function computeBalances(wallets: Wallet[], txs: Transaction[]): Record<ID, Minor> {
  const b: Record<ID, Minor> = {};
  for (const w of wallets) b[w.id] = w.openingBalance;
  for (const tx of txs) {
    for (const [id, d] of walletEffects(tx)) {
      if (id in b) b[id] += d;
    }
  }
  return b;
}

/** True for records that count as real income or spending. */
export function isFlow(tx: Transaction): tx is Transaction & { kind: "income" | "expense" } {
  return tx.kind === "income" || tx.kind === "expense";
}

/* ------------------------------------------------------------------ */
/*  Currency                                                           */
/* ------------------------------------------------------------------ */

export function rateOf(currency: string, settings: Settings): number | null {
  if (currency === settings.baseCurrency) return 1;
  const r = settings.rates[currency];
  return r && r > 0 ? r : null;
}

/** Converts minor units to the base currency, or null when no rate is set. */
export function toBase(minor: Minor, currency: string, settings: Settings): Minor | null {
  const r = rateOf(currency, settings);
  return r === null ? null : Math.round(minor * r);
}

export interface Total {
  total: Minor;
  /** Currencies that were left out because no exchange rate is set */
  missing: string[];
}

export function sumWallets(wallets: Wallet[], balances: Record<ID, Minor>, settings: Settings): Total {
  let total = 0;
  const missing = new Set<string>();
  for (const w of wallets) {
    const v = toBase(balances[w.id] ?? 0, w.currency, settings);
    if (v === null) missing.add(w.currency);
    else total += v;
  }
  return { total, missing: [...missing] };
}

export function activeWallets(wallets: Wallet[]): Wallet[] {
  return wallets.filter((w) => !w.archived);
}

export function totalWallets(wallets: Wallet[]): Wallet[] {
  return wallets.filter((w) => !w.archived && w.includeInTotal);
}

/* ------------------------------------------------------------------ */
/*  Goals and debts                                                    */
/* ------------------------------------------------------------------ */

/** Own balance of every envelope goal (money moved in minus moved out). */
export function goalEnvelopes(txs: Transaction[]): Record<ID, Minor> {
  const out: Record<ID, Minor> = {};
  for (const tx of txs) {
    if (tx.kind !== "goal" || !tx.goalId) continue;
    out[tx.goalId] = (out[tx.goalId] ?? 0) + (tx.flow === "out" ? tx.amount : -tx.amount);
  }
  return out;
}

export function goalSaved(goal: Goal, envelopes: Record<ID, Minor>, balances: Record<ID, Minor>): Minor {
  if (goal.walletId) return Math.max(0, balances[goal.walletId] ?? 0);
  return Math.max(0, envelopes[goal.id] ?? 0);
}

export interface GoalInfo {
  saved: Minor;
  remaining: Minor;
  progress: number;
  monthsLeft: number | null;
  /** Monthly amount needed to hit the deadline */
  monthly: Minor | null;
  done: boolean;
}

export function goalInfo(goal: Goal, saved: Minor, today: DayKey): GoalInfo {
  const remaining = Math.max(0, goal.target - saved);
  const progress = goal.target > 0 ? Math.min(1, saved / goal.target) : 0;
  let monthsLeft: number | null = null;
  let monthly: Minor | null = null;
  if (goal.deadline) {
    const days = diffDays(goal.deadline, today);
    monthsLeft = Math.max(0, days / 30.44);
    if (remaining > 0) monthly = days <= 0 ? remaining : Math.ceil(remaining / Math.max(1, monthsLeft) / 100) * 100;
  }
  return { saved, remaining, progress, monthsLeft, monthly, done: remaining === 0 && goal.target > 0 };
}

export interface DebtInfo {
  paid: Minor;
  remaining: Minor;
  progress: number;
  status: "active" | "overdue" | "closed";
  payments: Transaction[];
  daysToDue: number | null;
}

export function debtInfo(debt: Debt, txs: Transaction[], today: DayKey): DebtInfo {
  const payments = txs
    .filter((t) => t.kind === "debt" && t.debtId === debt.id && t.debtRole === "payment")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const paid = payments.reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, debt.amount - paid);
  const closed = !!debt.closedAt || remaining === 0;
  const daysToDue = debt.dueDate ? diffDays(debt.dueDate, today) : null;
  const overdue = !closed && daysToDue !== null && daysToDue < 0;
  return {
    paid,
    remaining: closed ? 0 : remaining,
    progress: debt.amount > 0 ? Math.min(1, paid / debt.amount) : 0,
    status: closed ? "closed" : overdue ? "overdue" : "active",
    payments,
    daysToDue
  };
}

/* ------------------------------------------------------------------ */
/*  Net worth                                                          */
/* ------------------------------------------------------------------ */

export interface NetWorth {
  wallets: Minor;
  goals: Minor;
  receivables: Minor;
  liabilities: Minor;
  total: Minor;
  missing: string[];
}

export function netWorth(data: AppData, balances: Record<ID, Minor>, today: DayKey): NetWorth {
  const { settings } = data;
  const w = sumWallets(totalWallets(data.wallets), balances, settings);
  const missing = new Set(w.missing);
  const env = goalEnvelopes(data.transactions);
  let goals = 0;
  for (const g of data.goals) {
    if (g.walletId || g.archived) continue;
    const v = toBase(env[g.id] ?? 0, g.currency, settings);
    if (v === null) missing.add(g.currency);
    else goals += Math.max(0, v);
  }
  let receivables = 0;
  let liabilities = 0;
  for (const d of data.debts) {
    const info = debtInfo(d, data.transactions, today);
    if (info.status === "closed") continue;
    const v = toBase(info.remaining, d.currency, settings);
    if (v === null) {
      missing.add(d.currency);
      continue;
    }
    if (d.direction === "owed_to_me") receivables += v;
    else liabilities += v;
  }
  return {
    wallets: w.total,
    goals,
    receivables,
    liabilities,
    total: w.total + goals + receivables - liabilities,
    missing: [...missing]
  };
}

/* ------------------------------------------------------------------ */
/*  Ledger in base currency                                            */
/* ------------------------------------------------------------------ */

export interface LedgerEntry {
  tx: Transaction;
  day: DayKey;
  /** Amount in base currency (always positive) */
  base: Minor;
}

/** Income and expense records converted to the base currency. */
export function buildLedger(data: AppData): { entries: LedgerEntry[]; skipped: number } {
  const cur = new Map(data.wallets.map((w) => [w.id, w.currency]));
  const entries: LedgerEntry[] = [];
  let skipped = 0;
  for (const tx of data.transactions) {
    if (!isFlow(tx)) continue;
    const currency = (tx.walletId && cur.get(tx.walletId)) || data.settings.baseCurrency;
    const base = toBase(tx.amount, currency, data.settings);
    if (base === null) {
      skipped++;
      continue;
    }
    entries.push({ tx, day: dayOf(tx.date), base });
  }
  entries.sort((a, b) => (a.tx.date < b.tx.date ? -1 : 1));
  return { entries, skipped };
}

/**
 * End-of-day balance series for a set of wallets, in base currency.
 * Walks backwards from today's balance, so it always agrees with it.
 */
export function balanceSeries(
  data: AppData,
  balances: Record<ID, Minor>,
  walletIds: Set<ID>,
  from: DayKey,
  to: DayKey
): Array<{ day: DayKey; value: Minor }> {
  const { settings } = data;
  const cur = new Map(data.wallets.map((w) => [w.id, w.currency]));
  let current = 0;
  for (const id of walletIds) {
    const v = toBase(balances[id] ?? 0, cur.get(id) ?? settings.baseCurrency, settings);
    if (v !== null) current += v;
  }
  const eff = new Map<DayKey, Minor>();
  for (const tx of data.transactions) {
    const day = dayOf(tx.date);
    for (const [wid, d] of walletEffects(tx)) {
      if (!walletIds.has(wid)) continue;
      const v = toBase(d, cur.get(wid) ?? settings.baseCurrency, settings);
      if (v === null) continue;
      eff.set(day, (eff.get(day) ?? 0) + v);
    }
  }
  let bal = current;
  for (const [day, v] of eff) if (day > to) bal -= v;
  const out: Array<{ day: DayKey; value: Minor }> = [];
  let day = to;
  let guard = 0;
  while (day >= from && guard++ < 4000) {
    out.push({ day, value: bal });
    bal -= eff.get(day) ?? 0;
    day = addDays(day, -1);
  }
  return out.reverse();
}

/* ------------------------------------------------------------------ */
/*  Periods                                                            */
/* ------------------------------------------------------------------ */

export type Period = "week" | "month" | "quarter" | "year";

export interface Range {
  period: Period;
  offset: number;
  from: DayKey;
  to: DayKey;
  label: string;
  days: number;
}

const ROMAN = ["I", "II", "III", "IV"];

export function periodRange(period: Period, offset: number, today: DayKey): Range {
  let from: DayKey;
  let to: DayKey;
  let label: string;
  const thisYear = parseDay(today).getFullYear();
  switch (period) {
    case "week": {
      from = addDays(startOfWeek(today), offset * 7);
      to = addDays(from, 6);
      const a = parseDay(from);
      const b = parseDay(to);
      label =
        a.getMonth() === b.getMonth()
          ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`
          : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
      if (offset === 0) label = "Эта неделя";
      else if (offset === -1) label = "Прошлая неделя";
      break;
    }
    case "month": {
      from = addMonths(startOfMonth(today), offset, 1);
      to = endOfMonth(from);
      label = monthTitle(from);
      break;
    }
    case "quarter": {
      from = addMonths(startOfQuarter(today), offset * 3, 1);
      to = endOfMonth(addMonths(from, 2, 1));
      const d = parseDay(from);
      label = `${ROMAN[Math.floor(d.getMonth() / 3)]} квартал${d.getFullYear() !== thisYear ? ` ${d.getFullYear()}` : ""}`;
      break;
    }
    case "year": {
      const y = thisYear + offset;
      from = `${y}-01-01`;
      to = `${y}-12-31`;
      label = String(y);
      break;
    }
  }
  return { period, offset, from, to, label, days: diffDays(to, from) + 1 };
}

export interface PeriodStats {
  income: Minor;
  expense: Minor;
  net: Minor;
  count: number;
  expenseByCategory: Map<string, Minor>;
  incomeByCategory: Map<string, Minor>;
  /** Days of the range that have already happened */
  elapsedDays: number;
}

export function periodStats(entries: LedgerEntry[], range: Range, today: DayKey): PeriodStats {
  let income = 0;
  let expense = 0;
  let count = 0;
  const expenseByCategory = new Map<string, Minor>();
  const incomeByCategory = new Map<string, Minor>();
  for (const e of entries) {
    if (e.day < range.from || e.day > range.to) continue;
    count++;
    const key = e.tx.categoryId ?? "none";
    if (e.tx.kind === "income") {
      income += e.base;
      incomeByCategory.set(key, (incomeByCategory.get(key) ?? 0) + e.base);
    } else {
      expense += e.base;
      expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + e.base);
    }
  }
  const end = today < range.to ? today : range.to;
  const elapsedDays = today < range.from ? 0 : diffDays(end, range.from) + 1;
  return { income, expense, net: income - expense, count, expenseByCategory, incomeByCategory, elapsedDays };
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return (cur - prev) / Math.abs(prev);
}
