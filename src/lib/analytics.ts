import type { AppData, Category, ID } from "../store/types";
import { OTHER_COLOR } from "../store/catalog";
import {
  addDays,
  addMonths,
  dayOf,
  diffDays,
  eachDay,
  endOfMonth,
  formatDate,
  MONTHS_SHORT,
  MONTHS_SHORT_NOM,
  monthTitle,
  parseDay,
  startOfMonth,
  WEEKDAYS_SHORT,
  weekdayIndex,
  type DayKey
} from "./dates";
import { balanceSeries, debtInfo, rateOf, toBase, totalWallets, type LedgerEntry, type Range } from "./finance";
import type { Minor } from "./money";
import { occurrencesInRange } from "./recurrence";

/* ------------------------------------------------------------------ */
/*  Buckets                                                            */
/* ------------------------------------------------------------------ */

export interface Bucket {
  from: DayKey;
  to: DayKey;
  /** Axis label */
  label: string;
  /** Tooltip label */
  tip: string;
}

export function bucketsFor(range: Range): Bucket[] {
  switch (range.period) {
    case "week":
      return eachDay(range.from, range.to).map((d) => ({ from: d, to: d, label: WEEKDAYS_SHORT[weekdayIndex(d)], tip: `${WEEKDAYS_SHORT[weekdayIndex(d)]}, ${formatDate(d)}` }));
    case "month":
      return eachDay(range.from, range.to).map((d) => ({ from: d, to: d, label: String(parseDay(d).getDate()), tip: formatDate(d) }));
    case "quarter": {
      const out: Bucket[] = [];
      let cur = range.from;
      while (cur <= range.to) {
        const dow = weekdayIndex(cur);
        let end = addDays(cur, 6 - dow);
        if (end > range.to) end = range.to;
        const a = parseDay(cur);
        const b = parseDay(end);
        out.push({
          from: cur,
          to: end,
          label: `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`,
          tip: a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}` : `${formatDate(cur)} – ${formatDate(end)}`
        });
        cur = addDays(end, 1);
      }
      return out;
    }
    case "year": {
      const out: Bucket[] = [];
      for (let m = 0; m < 12; m++) {
        const from = addMonths(range.from, m, 1);
        out.push({ from, to: endOfMonth(from), label: MONTHS_SHORT_NOM[m], tip: monthTitle(from, "always") });
      }
      return out;
    }
  }
}

export type SeriesKind = "expense" | "income" | "net";

export function bucketSeries(entries: LedgerEntry[], buckets: Bucket[], kind: SeriesKind): Minor[] {
  const out = buckets.map(() => 0);
  if (!buckets.length) return out;
  const from = buckets[0].from;
  const to = buckets[buckets.length - 1].to;
  for (const e of entries) {
    if (e.day < from || e.day > to) continue;
    // buckets are contiguous and ordered — binary search
    let lo = 0;
    let hi = buckets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (buckets[mid].to < e.day) lo = mid + 1;
      else hi = mid;
    }
    const sign = e.tx.kind === "income" ? 1 : -1;
    if (kind === "expense" && sign < 0) out[lo] += e.base;
    else if (kind === "income" && sign > 0) out[lo] += e.base;
    else if (kind === "net") out[lo] += sign * e.base;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Categories                                                         */
/* ------------------------------------------------------------------ */

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: Minor;
  share: number;
  prev: Minor;
  delta: number | null;
}

export function categoryRows(cur: Map<string, Minor>, prev: Map<string, Minor>, categories: Map<ID, Category>): CategoryRow[] {
  const total = [...cur.values()].reduce((s, v) => s + v, 0);
  const rows: CategoryRow[] = [];
  for (const [id, amount] of cur) {
    const c = categories.get(id);
    const p = prev.get(id) ?? 0;
    rows.push({
      id,
      name: c?.name ?? "Без категории",
      icon: c?.icon ?? "CircleDashed",
      color: c?.color ?? OTHER_COLOR,
      amount,
      share: total ? amount / total : 0,
      prev: p,
      delta: p ? (amount - p) / p : null
    });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

/** Top rows for a donut, the tail folded into «Остальное». */
export function donutSlices(rows: CategoryRow[], max = 6): CategoryRow[] {
  if (rows.length <= max) return rows;
  const head = rows.slice(0, max - 1);
  const tail = rows.slice(max - 1);
  const amount = tail.reduce((s, r) => s + r.amount, 0);
  const share = tail.reduce((s, r) => s + r.share, 0);
  return [...head, { id: "__rest", name: "Остальное", icon: "Ellipsis", color: OTHER_COLOR, amount, share, prev: 0, delta: null }];
}

/* ------------------------------------------------------------------ */
/*  Habits                                                             */
/* ------------------------------------------------------------------ */

export interface Habits {
  /** Average spend per weekday (Mon..Sun) */
  weekday: Minor[];
  peakWeekday: number | null;
  avgTicket: Minor;
  noSpendDays: number;
  topNote: { label: string; count: number; total: Minor } | null;
  expenseCount: number;
}

export function habits(entries: LedgerEntry[], from: DayKey, to: DayKey): Habits {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of eachDay(from, to)) counts[weekdayIndex(d)]++;
  const spendDays = new Set<DayKey>();
  const notes = new Map<string, { label: string; count: number; total: Minor }>();
  let total = 0;
  let n = 0;
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < from || e.day > to) continue;
    sums[weekdayIndex(e.day)] += e.base;
    spendDays.add(e.day);
    total += e.base;
    n++;
    if (e.tx.recurringId) continue;
    const label = (e.tx.note ?? "").trim();
    if (!label) continue;
    const k = label.toLowerCase();
    const cur = notes.get(k) ?? { label, count: 0, total: 0 };
    cur.count++;
    cur.total += e.base;
    notes.set(k, cur);
  }
  const weekday = sums.map((s, i) => (counts[i] ? Math.round(s / counts[i]) : 0));
  let peak: number | null = null;
  weekday.forEach((v, i) => {
    if (v > 0 && (peak === null || v > weekday[peak])) peak = i;
  });
  const topNote = [...notes.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  return {
    weekday,
    peakWeekday: peak,
    avgTicket: n ? Math.round(total / n / 100) * 100 : 0,
    noSpendDays: Math.max(0, eachDay(from, to).length - spendDays.size),
    topNote: topNote && topNote.count >= 3 ? topNote : null,
    expenseCount: n
  };
}

/* ------------------------------------------------------------------ */
/*  Forecasts                                                          */
/* ------------------------------------------------------------------ */

function walletCurrency(data: AppData, walletId?: ID): string {
  return data.wallets.find((w) => w.id === walletId)?.currency ?? data.settings.baseCurrency;
}

export interface Scheduled {
  income: Minor;
  expense: Minor;
  items: Array<{ date: DayKey; title: string; amount: Minor; kind: "income" | "expense"; source: "recurring" | "plan" | "debt" }>;
}

/** Known future money movements between two days (inclusive). */
export function scheduledBetween(data: AppData, from: DayKey, to: DayKey, includeDebts = true): Scheduled {
  const items: Scheduled["items"] = [];
  for (const r of data.recurring) {
    if (!r.active || r.kind === "transfer") continue;
    const amt = toBase(r.amount, walletCurrency(data, r.walletId), data.settings);
    if (amt === null) continue;
    for (const d of occurrencesInRange(r, from, to)) items.push({ date: d, title: r.title, amount: amt, kind: r.kind, source: "recurring" });
  }
  for (const p of data.plans) {
    if (p.status !== "planned" || p.date < from || p.date > to) continue;
    const amt = toBase(p.amount, walletCurrency(data, p.walletId), data.settings);
    if (amt === null) continue;
    items.push({ date: p.date, title: p.title, amount: amt, kind: p.kind, source: "plan" });
  }
  if (includeDebts) {
    for (const d of data.debts) {
      if (!d.dueDate || d.dueDate < from || d.dueDate > to) continue;
      const info = debtInfo(d, data.transactions, from);
      if (info.status === "closed" || !info.remaining) continue;
      const amt = toBase(info.remaining, d.currency, data.settings);
      if (amt === null) continue;
      items.push({ date: d.dueDate, title: d.direction === "i_owe" ? `Вернуть: ${d.counterparty}` : `Вернёт: ${d.counterparty}`, amount: amt, kind: d.direction === "i_owe" ? "expense" : "income", source: "debt" });
    }
  }
  items.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    income: items.filter((i) => i.kind === "income").reduce((s, i) => s + i.amount, 0),
    expense: items.filter((i) => i.kind === "expense").reduce((s, i) => s + i.amount, 0),
    items
  };
}

export interface MonthForecast {
  spent: Minor;
  projected: Minor;
  /** Typical everyday spending per day (excludes regular payments and plans) */
  dailyRate: Minor;
  daysLeft: number;
  scheduled: Minor;
  lastMonth: Minor;
  /** Same point of last month, for pace comparison */
  lastMonthToDate: Minor;
}

export function monthForecast(data: AppData, entries: LedgerEntry[], today: DayKey): MonthForecast {
  const mFrom = startOfMonth(today);
  const mTo = endOfMonth(today);
  const lmFrom = addMonths(mFrom, -1, 1);
  const lmTo = endOfMonth(lmFrom);
  const dom = parseDay(today).getDate();
  const lmSameDay = addDays(lmFrom, Math.min(dom, diffDays(lmTo, lmFrom) + 1) - 1);
  const winFrom = addDays(today, -59);
  let spent = 0;
  let variableThisMonth = 0;
  let variable60 = 0;
  let lastMonth = 0;
  let lastMonthToDate = 0;
  for (const e of entries) {
    if (e.tx.kind !== "expense") continue;
    const regular = !!(e.tx.recurringId || e.tx.planId);
    if (e.day >= mFrom && e.day <= today) {
      spent += e.base;
      if (!regular) variableThisMonth += e.base;
    }
    if (e.day >= winFrom && e.day <= today && !regular) variable60 += e.base;
    if (e.day >= lmFrom && e.day <= lmTo) {
      lastMonth += e.base;
      if (e.day <= lmSameDay) lastMonthToDate += e.base;
    }
  }
  const rate60 = variable60 / 60;
  const rateMonth = variableThisMonth / Math.max(1, dom);
  const dailyRate = Math.round((dom >= 10 ? 0.5 * rate60 + 0.5 * rateMonth : rate60) / 100) * 100;
  const daysLeft = diffDays(mTo, today);
  const scheduled = daysLeft > 0 ? scheduledBetween(data, addDays(today, 1), mTo, false).expense : 0;
  return {
    spent,
    projected: spent + dailyRate * daysLeft + scheduled,
    dailyRate,
    daysLeft,
    scheduled,
    lastMonth,
    lastMonthToDate
  };
}

export interface FreeCash {
  available: Minor;
  income: Minor;
  obligations: Minor;
  everyday: Minor;
  free: Minor;
  until: DayKey;
}

/**
 * Money that will be left at the end of the month in everyday wallets
 * (savings and investments excluded) after known payments and typical spending.
 */
export function freeCash(data: AppData, balances: Record<ID, Minor>, entries: LedgerEntry[], today: DayKey): FreeCash {
  const until = endOfMonth(today);
  let available = 0;
  for (const w of totalWallets(data.wallets)) {
    if (w.kind === "savings" || w.kind === "investment") continue;
    const r = rateOf(w.currency, data.settings);
    if (r === null) continue;
    available += Math.round((balances[w.id] ?? 0) * r);
  }
  const sch = scheduledBetween(data, addDays(today, 1), until);
  const fc = monthForecast(data, entries, today);
  const everyday = fc.dailyRate * fc.daysLeft;
  return {
    available,
    income: sch.income,
    obligations: sch.expense,
    everyday,
    free: available + sch.income - sch.expense - everyday,
    until
  };
}

/* ------------------------------------------------------------------ */
/*  Capital over time                                                  */
/* ------------------------------------------------------------------ */

/**
 * Per-day value in base currency.
 * capital — wallets + goal balances + money owed to me − money I owe
 * savings — savings & investment wallets + goal balances
 */
export function capitalSeries(data: AppData, balances: Record<ID, Minor>, from: DayKey, to: DayKey, mode: "capital" | "savings" = "capital"): Array<{ day: DayKey; value: Minor }> {
  const ids = new Set(totalWallets(data.wallets).filter((w) => mode === "capital" || w.kind === "savings" || w.kind === "investment").map((w) => w.id));
  const wallets = balanceSeries(data, balances, ids, from, to);
  const extra = new Map<DayKey, Minor>();
  let before = 0;
  const add = (day: DayKey, v: Minor) => {
    if (day < from) before += v;
    else extra.set(day, (extra.get(day) ?? 0) + v);
  };
  const goalCurrency = new Map(data.goals.map((g) => [g.id, g]));
  for (const t of data.transactions) {
    if (t.kind === "goal" && t.goalId) {
      const g = goalCurrency.get(t.goalId);
      if (!g || g.walletId || g.archived) continue;
      const v = toBase(t.amount, g.currency, data.settings);
      if (v !== null) add(dayOf(t.date), t.flow === "out" ? v : -v);
    }
  }
  for (const d of mode === "capital" ? data.debts : []) {
    const sign = d.direction === "owed_to_me" ? 1 : -1;
    const rate = rateOf(d.currency, data.settings);
    if (rate === null) continue;
    add(d.date, sign * Math.round(d.amount * rate));
    let paid = 0;
    for (const t of data.transactions) {
      if (t.kind !== "debt" || t.debtId !== d.id || t.debtRole !== "payment") continue;
      paid += t.amount;
      add(dayOf(t.date), -sign * Math.round(t.amount * rate));
    }
    if (d.closedAt && paid < d.amount) add(dayOf(d.closedAt), -sign * Math.round((d.amount - paid) * rate));
  }
  let acc = before;
  return wallets.map((p) => {
    acc += extra.get(p.day) ?? 0;
    return { day: p.day, value: p.value + acc };
  });
}

/* ------------------------------------------------------------------ */
/*  Monthly history                                                    */
/* ------------------------------------------------------------------ */

export function monthlyTotals(entries: LedgerEntry[], today: DayKey, months: number) {
  const out: Array<{ month: DayKey; label: string; income: Minor; expense: Minor }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const from = addMonths(startOfMonth(today), -i, 1);
    out.push({ month: from, label: MONTHS_SHORT_NOM[parseDay(from).getMonth()], income: 0, expense: 0 });
  }
  const first = out[0].month;
  for (const e of entries) {
    if (e.day < first) continue;
    const idx = out.findIndex((m, j) => e.day >= m.month && (j === out.length - 1 || e.day < out[j + 1].month));
    if (idx < 0) continue;
    if (e.tx.kind === "income") out[idx].income += e.base;
    else out[idx].expense += e.base;
  }
  return out;
}
