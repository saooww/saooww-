import { addDays, addMonths, diffDays, endOfMonth, formatDate, MONTHS_GEN, parseDay, pluralN, startOfMonth, type DayKey } from "./dates";
import { categoryRows, type FreeCash } from "./analytics";
import type { LedgerEntry } from "./finance";
import { formatMoney, type Minor } from "./money";
import type { Category, ID } from "../store/types";
import { tr } from "../i18n/i18n";

/**
 * «Спросить Ardessa»: answers to a few everyday money questions, worked out
 * from the person's own records only — every figure is a sum of real
 * operations, and each answer says how it was counted. Nothing is guessed.
 */
export type Intent = "top" | "why" | "save" | "upcoming";

export interface AnswerRow {
  icon: string;
  color?: string;
  title: string;
  sub?: string;
  value: string;
  tone?: "negative" | "positive";
}

export interface Answer {
  intent: Intent;
  text: string;
  rows: AnswerRow[];
  how: string;
  /** Put money into a goal right from the answer */
  action?: { goalId: ID; goalName: string; amount: Minor };
}

export interface UpcomingItem {
  date: DayKey;
  title: string;
  amount?: Minor;
  direction?: "in" | "out";
  kind: string;
}

const pct = (v: number) => `${Math.round(Math.abs(v) * 100)}%`;

/** Which question a free-form text asks, in any of the app's languages. */
export function intentOf(text: string): Intent | null {
  const t = text.toLowerCase();
  if (/вырос|выросл|почему|больше чем|why|grew|grow|rose|increase|subi|augment|gestiegen|warum|aument|por qué|neden|arttı|为什么|増え|なぜ|क्यों|बढ़/.test(t)) return "why";
  if (/отлож|накоп|сэконом|сколько можно|save|saving|ahorr|épargn|économ|spar|guardar|poupar|biriktir|存|貯|बचा/.test(t)) return "save";
  if (/скоро|подписк|платеж|платёж|спиш|списан|upcoming|bill|payment|subscription|pago|paiement|zahlung|pagamento|ödeme|付款|支払|भुगतान/.test(t)) return "upcoming";
  if (/больше всего|куда|на что|траты|расход|top|most|spend|gast|dépens|ausgab|despesa|harca|花|支出|使|खर्च/.test(t)) return "top";
  return null;
}

function spendBy(entries: LedgerEntry[], from: DayKey, to: DayKey): { by: Map<string, Minor>; total: Minor; count: number } {
  const by = new Map<string, Minor>();
  let total = 0;
  let count = 0;
  for (const e of entries) {
    if (e.tx.kind !== "expense" || e.day < from || e.day > to) continue;
    const k = e.tx.categoryId ?? "";
    by.set(k, (by.get(k) ?? 0) + e.base);
    total += e.base;
    count++;
  }
  return { by, total, count };
}

/** «На что ушло больше всего?» — this month's spending by category. */
export function answerTop(entries: LedgerEntry[], categories: Map<ID, Category>, today: DayKey, base: string): Answer {
  const from = startOfMonth(today);
  const cur = spendBy(entries, from, today);
  const prevFrom = addMonths(from, -1, 1);
  const prevTo = addDays(prevFrom, Math.min(diffDays(today, from), diffDays(endOfMonth(prevFrom), prevFrom)));
  const prev = spendBy(entries, prevFrom, prevTo);
  const rows = categoryRows(cur.by, prev.by, categories).slice(0, 5);
  const month = MONTHS_GEN[parseDay(today).getMonth()];
  if (!rows.length) return { intent: "top", text: tr("В этом месяце расходов пока нет."), rows: [], how: tr("Считаются расходы с начала месяца.") };
  return {
    intent: "top",
    text: tr("С 1 {0} больше всего ушло на «{1}» — {2}, это {3} всех трат.", month, rows[0].name, formatMoney(rows[0].amount, { currency: base }), pct(rows[0].share)),
    rows: rows.map((r) => ({
      icon: r.icon,
      color: r.color,
      title: r.name,
      sub: r.delta === null ? tr("{0} всех трат", pct(r.share)) : tr("{0} всех трат · {1}{2} к прошлому месяцу", pct(r.share), r.delta >= 0 ? "+" : "−", pct(r.delta)),
      value: formatMoney(r.amount, { currency: base })
    })),
    how: tr("Расходы с 1 по {0}: {1}, {2}. Переводы между счетами и пополнения целей не входят.", formatDate(today), formatMoney(cur.total, { currency: base }), pluralN(cur.count, ["операция", "операции", "операций"]))
  };
}

/** «Почему траты выросли?» — the same days of this month and the last, category by category. */
export function answerWhy(entries: LedgerEntry[], categories: Map<ID, Category>, today: DayKey, base: string): Answer {
  const from = startOfMonth(today);
  const days = diffDays(today, from);
  const prevFrom = addMonths(from, -1, 1);
  const prevTo = addDays(prevFrom, Math.min(days, diffDays(endOfMonth(prevFrom), prevFrom)));
  const cur = spendBy(entries, from, today);
  const prev = spendBy(entries, prevFrom, prevTo);
  const how = tr("1–{0} {1} против 1–{2} {3}: {4} против {5}. Переводы и цели не входят.", parseDay(today).getDate(), MONTHS_GEN[parseDay(today).getMonth()], parseDay(prevTo).getDate(), MONTHS_GEN[parseDay(prevTo).getMonth()], formatMoney(cur.total, { currency: base }), formatMoney(prev.total, { currency: base }));
  if (!prev.total) return { intent: "why", text: tr("За прошлый месяц нет расходов — сравнивать не с чем."), rows: [], how };
  const change = (cur.total - prev.total) / prev.total;
  const deltas = categoryRows(cur.by, prev.by, categories)
    .map((r) => ({ r, d: r.amount - r.prev }))
    .concat([...prev.by.keys()].filter((k) => !cur.by.has(k)).map((k) => ({ r: { id: k, name: categories.get(k)?.name ?? tr("Без категории"), icon: categories.get(k)?.icon ?? "CircleDashed", color: categories.get(k)?.color ?? "#7C7C84", amount: 0, prev: prev.by.get(k) ?? 0, share: 0, delta: -1 }, d: -(prev.by.get(k) ?? 0) })));
  if (change <= 0.02) {
    const down = deltas.filter((x) => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 3);
    return {
      intent: "why",
      text: change < -0.02 ? tr("Траты не выросли: за те же дни вы потратили на {0} меньше, чем в прошлом месяце.", pct(change)) : tr("Траты почти не изменились — разница меньше 2%."),
      rows: down.map(({ r, d }) => ({ icon: r.icon, color: r.color, title: r.name, sub: tr("{0} → {1}", formatMoney(r.prev, { currency: base }), formatMoney(r.amount, { currency: base })), value: `−${formatMoney(-d, { currency: base })}`, tone: "positive" as const })),
      how
    };
  }
  const up = deltas.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const growth = cur.total - prev.total;
  const covered = up.reduce((s, x) => s + x.d, 0);
  return {
    intent: "why",
    text: tr("За те же дни вы потратили на {0} больше ({1}). {2} этого роста — {3}.", pct(change), `+${formatMoney(growth, { currency: base })}`, covered >= growth * 0.8 ? tr("Почти весь") : tr("Большая часть"), up.map((x) => `«${x.r.name}»`).join(", ")),
    rows: up.map(({ r, d }) => ({ icon: r.icon, color: r.color, title: r.name, sub: tr("{0} → {1}", formatMoney(r.prev, { currency: base }), formatMoney(r.amount, { currency: base })), value: `+${formatMoney(d, { currency: base })}`, tone: "negative" as const })),
    how
  };
}

/** «Сколько можно отложить?» — what the month's end looks like, and a safe amount for a goal. */
export function answerSave(cash: FreeCash, goal: { id: ID; name: string } | null, base: string): Answer {
  const rows: AnswerRow[] = [
    { icon: "Wallet", title: tr("Сейчас на счетах для трат"), value: formatMoney(cash.available, { currency: base }) },
    { icon: "ArrowDownLeft", title: tr("Ожидаемые поступления"), value: `+${formatMoney(cash.income, { currency: base })}`, tone: "positive" },
    { icon: "CalendarCheck", title: tr("Платежи и планы"), value: `−${formatMoney(cash.obligations, { currency: base })}` },
    { icon: "ShoppingBag", title: tr("Обычные траты до конца месяца"), value: `−${formatMoney(cash.everyday, { currency: base })}` }
  ];
  const how = tr("Остаток = деньги на счетах для трат + поступления − платежи − обычные траты (ваш средний темп за 60 дней). Накопительные и инвестиционные счета не входят.");
  if (cash.free <= 0) return { intent: "save", text: tr("Если тратить как обычно, к {0} денег не останется (≈ {1}). Сейчас лучше ничего не откладывать.", formatDate(cash.until), formatMoney(cash.free, { currency: base })), rows, how };
  // a margin for the unexpected: a fifth of the expected surplus stays free
  const amount = Math.floor((cash.free * 0.8) / 100_000) * 100_000 || Math.floor((cash.free * 0.8) / 10_000) * 10_000;
  return {
    intent: "save",
    text: goal && amount > 0
      ? tr("Если тратить как обычно, к {0} останется ≈ {1}. Без риска можно отложить {2} в «{3}».", formatDate(cash.until), formatMoney(cash.free, { currency: base }), formatMoney(amount, { currency: base }), goal.name)
      : tr("Если тратить как обычно, к {0} останется ≈ {1}. Без риска можно отложить {2}.", formatDate(cash.until), formatMoney(cash.free, { currency: base }), formatMoney(amount, { currency: base })),
    rows,
    how: `${how} ${tr("Пятая часть остатка остаётся в запасе.")}`,
    action: goal && amount > 0 ? { goalId: goal.id, goalName: goal.name, amount } : undefined
  };
}

/** «Что скоро списать?» — payments, plans and debts in the next two weeks. */
export function answerUpcoming(items: UpcomingItem[], base: string): Answer {
  const out = items.filter((i) => i.direction === "out" && i.amount);
  const total = out.reduce((s, i) => s + (i.amount ?? 0), 0);
  return {
    intent: "upcoming",
    text: out.length ? tr("За две недели спишется {0} — {1}. Ближайший — «{2}», {3}.", formatMoney(total, { currency: base }), pluralN(out.length, ["платёж", "платежа", "платежей"]), out[0].title, formatDate(out[0].date)) : tr("В ближайшие две недели списаний не запланировано."),
    rows: out.slice(0, 8).map((i) => ({ icon: i.kind === "recurring" ? "Repeat" : i.kind === "debt" ? "HandCoins" : "CalendarCheck", title: i.title, sub: formatDate(i.date), value: `−${formatMoney(i.amount ?? 0, { currency: base })}` })),
    how: tr("Регулярные платежи, запланированные покупки и сроки долгов на 14 дней вперёд.")
  };
}
