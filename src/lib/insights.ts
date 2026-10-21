import type { AppData, ID } from "../store/types";
import type { RouteName, Tab } from "../store/ui";
import { addDays, endOfMonth, diffDays, plural, pluralN, startOfMonth, type DayKey, formatRelative } from "./dates";
import { debtInfo, rateOf, totalWallets, type LedgerEntry } from "./finance";
import { formatMoney, formatPercent, type Minor } from "./money";
import { monthForecast, monthlyTotals, scheduledBetween } from "./analytics";
import { monthlyEquivalent } from "./recurrence";

export interface Insight {
  id: string;
  icon: string;
  tone: "neutral" | "positive" | "warning" | "negative";
  text: string;
  action?: { tab: Tab; route?: RouteName; params?: Record<string, unknown> };
}

export interface BudgetState {
  id: ID;
  categoryId: ID | null;
  limit: Minor;
  spent: Minor;
  remaining: Minor;
  progress: number;
  /** Spend at the current pace by month end */
  projected: Minor;
  level: "ok" | "near" | "over";
}

export function budgetStates(data: AppData, entries: LedgerEntry[], today: DayKey): BudgetState[] {
  const from = startOfMonth(today);
  const byCat = new Map<string, Minor>();
  let all = 0;
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < from || e.day > today) continue;
    all += e.base;
    const k = e.tx.categoryId ?? "none";
    byCat.set(k, (byCat.get(k) ?? 0) + e.base);
  }
  const daysTotal = diffDays(endOfMonth(today), from) + 1;
  const elapsed = diffDays(today, from) + 1;
  return data.budgets.map((b) => {
    const spent = b.categoryId === null ? all : byCat.get(b.categoryId) ?? 0;
    const progress = b.limit > 0 ? spent / b.limit : 0;
    const projected = Math.round((spent / elapsed) * daysTotal);
    return {
      id: b.id,
      categoryId: b.categoryId,
      limit: b.limit,
      spent,
      remaining: b.limit - spent,
      progress,
      projected,
      level: progress > 1 ? "over" : progress >= 0.85 ? "near" : "ok"
    };
  });
}

/** The single most useful observation for the home screen, or nothing. */
export function homeInsight(data: AppData, entries: LedgerEntry[], today: DayKey): Insight | null {
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const daysLeft = diffDays(endOfMonth(today), today);

  // 1. Budgets that are over or about to run out
  const budgets = budgetStates(data, entries, today)
    .filter((b) => b.level !== "ok")
    .sort((a, b) => b.progress - a.progress);
  const b = budgets[0];
  if (b) {
    const name = b.categoryId ? cats.get(b.categoryId)?.name ?? "Категория" : "Общий бюджет";
    if (b.level === "over") {
      return { id: `budget-${b.id}`, icon: "TriangleAlert", tone: "negative", text: `${name}: бюджет превышен на ${formatMoney(-b.remaining)}`, action: { tab: "more", route: "budgets" } };
    }
    if (daysLeft >= 2) {
      return {
        id: `budget-${b.id}`,
        icon: "Gauge",
        tone: "warning",
        text: `${name}: осталось ${formatMoney(b.remaining)} на ${pluralN(daysLeft, ["день", "дня", "дней"])}`,
        action: { tab: "more", route: "budgets" }
      };
    }
  }

  // 2. Debts I have to return soon
  for (const d of data.debts) {
    if (d.direction !== "i_owe") continue;
    const info = debtInfo(d, data.transactions, today);
    if (info.status === "closed" || info.daysToDue === null || info.daysToDue > 3) continue;
    const when = info.daysToDue < 0 ? `${pluralN(-info.daysToDue, ["день", "дня", "дней"])} как истёк` : formatRelative(d.dueDate!);
    return {
      id: `debt-${d.id}`,
      icon: "HandCoins",
      tone: info.daysToDue < 0 ? "negative" : "warning",
      text: `${capitalizeFirst(when)} срок возврата долга: ${d.counterparty}, ${formatMoney(info.remaining, { currency: d.currency })}`,
      action: { tab: "more", route: "debt", params: { id: d.id } }
    };
  }

  // 3. Payments in the next two days
  const soon = scheduledBetween(data, today, addDays(today, 2), false).items.filter((i) => i.kind === "expense");
  if (soon.length) {
    const first = soon[0];
    const when = formatRelative(first.date);
    const more = soon.length > 1 ? ` и ещё ${soon.length - 1}` : "";
    return { id: `soon-${first.date}-${first.title}`, icon: "CalendarClock", tone: "neutral", text: `${capitalizeFirst(when)} — ${first.title}, ${formatMoney(first.amount)}${more}`, action: { tab: "more", route: "plans" } };
  }

  // 4. Spending pace against last month
  const fc = monthForecast(data, entries, today);
  const dom = Number(today.slice(8, 10));
  if (dom >= 7 && fc.lastMonthToDate > 0) {
    const delta = fc.spent / fc.lastMonthToDate - 1;
    if (delta <= -0.1) {
      return { id: "pace", icon: "TrendingDown", tone: "positive", text: `Расходы на ${formatPercent(-delta)} ниже, чем к этому дню прошлого месяца`, action: { tab: "analytics" } };
    }
    if (delta >= 0.15) {
      return { id: "pace", icon: "TrendingUp", tone: "warning", text: `Расходы на ${formatPercent(delta)} выше, чем к этому дню прошлого месяца`, action: { tab: "analytics" } };
    }
  }
  return null;
}

function capitalizeFirst(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Up to three observations for the analytics screen, each backed by the user's data. */
export function analyticsTips(data: AppData, entries: LedgerEntry[], balances: Record<ID, Minor>, today: DayKey): Insight[] {
  const tips: Insight[] = [];
  const months = monthlyTotals(entries, today, 4).slice(0, 3); // three full months before this one
  const avgExpense = months.reduce((s, m) => s + m.expense, 0) / Math.max(1, months.filter((m) => m.expense > 0).length);
  const avgIncome = months.reduce((s, m) => s + m.income, 0) / Math.max(1, months.filter((m) => m.income > 0).length);

  // Safety cushion
  let reserve = 0;
  for (const w of totalWallets(data.wallets)) {
    if (w.kind !== "savings") continue;
    const r = rateOf(w.currency, data.settings);
    if (r !== null) reserve += (balances[w.id] ?? 0) * r;
  }
  if (avgExpense > 0 && reserve > 0) {
    const m = reserve / avgExpense;
    const months1 = Math.round(m * 10) / 10;
    tips.push({
      id: "cushion",
      icon: "LifeBuoy",
      tone: m >= 6 ? "positive" : m >= 3 ? "neutral" : "warning",
      text: `Накоплений хватит на ${String(months1).replace(".", ",")} ${plural(Math.floor(months1), ["месяц", "месяца", "месяцев"])} обычных расходов${m < 3 ? ". Рекомендуемый минимум — 3" : m < 6 ? ". Хорошая цель — 6 месяцев" : ""}`,
      action: { tab: "wallets" }
    });
  }

  // Savings rate
  if (avgIncome > 0) {
    const rate = (avgIncome - avgExpense) / avgIncome;
    tips.push({
      id: "rate",
      icon: "PiggyBank",
      tone: rate >= 0.2 ? "positive" : rate >= 0 ? "neutral" : "negative",
      text:
        rate >= 0
          ? `В среднем вы сохраняете ${formatPercent(rate)} дохода${rate < 0.1 ? " — меньше рекомендуемых 10–20%" : ""}`
          : `Последние месяцы расходы превышают доходы на ${formatPercent(-rate)}`
    });
  }

  // Subscriptions marked as unused
  const unused = data.recurring.filter((r) => r.active && r.isSubscription && (r.usage === "never" || r.usage === "rarely"));
  if (unused.length) {
    const yearly = unused.reduce((s, r) => s + monthlyEquivalent(r) * 12, 0);
    tips.push({
      id: "subs",
      icon: "Repeat",
      tone: "warning",
      text: `${unused.length === 1 ? `«${unused[0].title}»` : `${unused.length} подписки`} почти не используются — это ${formatMoney(yearly)} в год`,
      action: { tab: "more", route: "subscriptions" }
    });
  }
  return tips.slice(0, 3);
}
