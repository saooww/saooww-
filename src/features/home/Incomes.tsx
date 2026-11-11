import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_NOM, dayOf, endOfMonth, formatDate, parseDay, startOfMonth, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { planLeft, planReceived } from "../../lib/plans";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { activeWallets } from "../../lib/finance";
import { useData } from "../../store/store";
import { useAppData, useToday } from "../../store/hooks";
import { scheduledBetween } from "../../lib/analytics";
import type { ID, Plan } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Money } from "../../ui/Money";
import { Chip, FormRow, Group, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

/** Income plans of this month, plus any earlier ones not fully received yet. */
export function useMonthIncomes() {
  const plans = useData((s) => s.plans);
  const txs = useData((s) => s.transactions);
  const today = useToday();
  return useMemo(() => {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    const list = plans
      .filter((p) => p.kind === "income" && p.status !== "skipped" && ((p.date >= from && p.date <= to) || (p.status === "planned" && p.date < from)))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const expected = list.reduce((s, p) => s + p.amount, 0);
    const received = list.reduce((s, p) => s + (p.status === "done" ? p.amount : Math.min(p.amount, planReceived(p, txs))), 0);
    const next = list.find((p) => p.status === "planned");
    return { list, expected, received, left: Math.max(0, expected - received), next, today };
  }, [plans, txs, today]);
}

const GREEN_GLOW = { background: "var(--positive)", boxShadow: "0 0 12px color-mix(in srgb, var(--positive) 70%, transparent)" } as const;

/** «Зарплата в ноябре»: what is expected this month, what has come in, and one tap to record the next part. */
export function IncomeCard() {
  const { list, expected, received, next, today } = useMonthIncomes();
  const base = useData((s) => s.settings.baseCurrency);
  const title = list.length === 1 ? list[0].title : tr("Доходы · {0}", MONTHS_NOM[parseDay(today).getMonth()]);
  const share = expected ? Math.min(1, received / expected) : 0;
  const addIncome = () => nav.sheet("plan", { kind: "income", date: today });

  if (!list.length) {
    return (
      <button type="button" onClick={addIncome} className="mx-4 mt-4 flex h-[58px] w-[calc(100%-32px)] items-center justify-center gap-2 rounded-[20px] border border-dashed border-line-strong text-subhead font-semibold text-ink-2 active:bg-surface-press">
        <Plus size={16} />
        {tr("Ожидаемый доход — зарплата, аванс")}
      </button>
    );
  }
  return (
    <section className="panel mx-4 mt-4 rounded-[24px] px-4 pb-3.5 pt-4" aria-label={tr("Доходы месяца")}>
      <button type="button" onClick={() => nav.sheet("incomes")} className="block w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-headline font-semibold">{title}</span>
          <span className="shrink-0 text-footnote text-ink-2">{next ? tr("ждём {0}", formatDate(next.date)) : tr("всё получено")}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <Money value={received} currency={base} variant="hero" privacy className="text-[28px] leading-none" />
          <span className="text-footnote text-ink-2">{tr("из {0}", formatMoney(expected, { currency: base }))}</span>
        </div>
        <div className="mt-3 h-[8px] overflow-hidden rounded-full bg-[var(--line)]">
          <motion.div className="h-full rounded-full" style={GREEN_GLOW} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      </button>
      <div className="mt-3 flex items-center gap-2">
        {next && (
          <button
            type="button"
            onClick={() => {
              haptic();
              nav.sheet("receive", { planId: next.id });
            }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 text-footnote font-bold text-[var(--bg)] active:opacity-80"
          >
            <Plus size={14} strokeWidth={2.6} />
            {tr("Получил часть")}
          </button>
        )}
        <button type="button" onClick={() => nav.sheet("incomes")} className="tile flex h-9 items-center gap-1 rounded-full px-3.5 text-footnote font-semibold">
          {tr("Все доходы")}
          <ChevronRight size={13} className="text-ink-3" />
        </button>
      </div>
    </section>
  );
}

/** All income plans of the month: each with its progress and the parts already received. */
export function IncomesSheet() {
  const { close } = useSheet();
  const { list, expected, received, today } = useMonthIncomes();
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const wname = (id?: ID) => wallets.find((w) => w.id === id)?.name;
  const data = useAppData();
  const regular = useMemo(() => scheduledBetween(data, today, endOfMonth(today), false).items.filter((i) => i.kind === "income" && i.source === "recurring"), [data, today]);
  const share = expected ? Math.min(1, received / expected) : 0;

  return (
    <Sheet tall title={tr("Доходы · {0}", MONTHS_NOM[parseDay(today).getMonth()])} ariaLabel={tr("Доходы месяца")} right={<SheetAction strong onClick={close}>{tr("Готово")}</SheetAction>}>
      <div className="px-5 pb-1 text-footnote text-ink-2">
        {tr("Ожидаете {0} · уже получено {1}", formatMoney(expected, { currency: base }), formatMoney(received, { currency: base }))}
      </div>
      <div className="mx-5 mt-2 h-[10px] overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full" style={{ ...GREEN_GLOW, width: `${share * 100}%` }} />
      </div>

      <div className="mt-5 flex flex-col gap-3 px-4">
        {list.map((p) => {
          const got = p.status === "done" ? p.amount : planReceived(p, txs);
          const left = planLeft(p, txs);
          const parts = txs.filter((t) => t.planId === p.id).sort((a, b) => (a.date < b.date ? -1 : 1));
          return (
            <section key={p.id} className="panel rounded-[22px] p-4">
              <button type="button" onClick={() => nav.sheet("plan", { editId: p.id })} className="flex w-full items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-positive-soft text-positive">
                  <Check size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline font-semibold">{p.title}</span>
                  <span className="block text-footnote text-ink-2">{p.status === "done" ? tr("получено полностью") : p.date < today ? tr("ждали {0}", formatDate(p.date)) : tr("ждём до {0}", formatDate(p.date))}</span>
                </span>
                <Money value={p.amount} currency={base} className="text-callout font-semibold" />
              </button>
              <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[var(--line)]">
                <div className="h-full rounded-full" style={{ ...GREEN_GLOW, width: `${Math.min(100, (got / p.amount) * 100)}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-caption text-ink-2">
                <span>{tr("Получено {0}", formatMoney(got, { currency: base }))}</span>
                <span>{p.status === "planned" ? tr("Осталось {0}", formatMoney(left, { currency: base })) : ""}</span>
              </div>
              {(parts.length > 0 || p.status === "planned") && (
                <div className="mt-2.5 border-t border-[var(--line)] pt-1.5">
                  {parts.map((t) => (
                    <button key={t.id} type="button" onClick={() => nav.sheet("tx", { id: t.id })} className="flex w-full items-center gap-2.5 py-2 text-left">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-positive" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-subhead">{formatDate(dayOf(t.date), { year: "auto" })}</span>
                        <span className="block truncate text-caption text-ink-2">{wname(t.walletId) ?? "—"}</span>
                      </span>
                      <Money value={t.amount} currency={base} sign="always" tone="positive" className="text-subhead font-semibold" />
                    </button>
                  ))}
                  {p.status === "planned" && (
                    <div className="flex items-center gap-2.5 py-2 text-ink-3">
                      <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-current" />
                      <span className="flex-1 text-subhead">{p.date < today ? tr("ещё не пришло") : tr("ожидается {0}", formatDate(p.date))}</span>
                      <Money value={left} currency={base} className="text-subhead" />
                    </div>
                  )}
                </div>
              )}
              {p.status === "planned" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => nav.sheet("receive", { planId: p.id })} className="h-11 rounded-[14px] bg-[var(--ink)] text-subhead font-bold text-[var(--bg)] active:opacity-80">
                    {tr("Получил часть")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic("success");
                      undoable(tr("Доход получен"), () => useData.getState().completePlan(p.id));
                    }}
                    className="tile h-11 rounded-[14px] text-subhead font-semibold"
                  >
                    {tr("Получил всё")}
                  </button>
                </div>
              )}
            </section>
          );
        })}
        <button type="button" onClick={() => nav.sheet("plan", { kind: "income", date: today })} className="flex h-[52px] items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong text-subhead font-semibold text-ink-2 active:bg-surface-press">
          <Plus size={16} />
          {tr("Ожидаемый доход")}
        </button>
      </div>
      {regular.length > 0 && (
        <div className="mt-5">
          <Group header={tr("Придут сами")} footer={tr("Регулярные поступления записываются в свой день и уже учтены в прогнозе.")}>
            {regular.map((r, i) => (
              <div key={`${r.title}-${i}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout">{r.title}</span>
                  <span className="block text-caption text-ink-2">{formatDate(r.date)}</span>
                </span>
                <Money value={r.amount} currency={base} sign="always" tone="positive" className="text-callout font-semibold" />
              </div>
            ))}
          </Group>
        </div>
      )}
    </Sheet>
  );
}

/** One part of an expected income: how much came in, when, and on which account. */
export function ReceiveSheet({ planId }: { planId: ID }) {
  const { close } = useSheet();
  const plan = useData((s) => s.plans.find((p) => p.id === planId));
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const left = plan ? planLeft(plan, txs) || plan.amount : 0;
  const [amount, setAmount] = useState(left ? amountToInput(left).replace(/\s/g, "").replace(",", ".") : "");
  const [walletId, setWalletId] = useState(plan?.walletId ?? defaultWalletId ?? live[0]?.id);
  const [date, setDate] = useState(todayKey());
  if (!plan) return null;
  const value = parseAmount(amount);
  const fmt = (v: number) => formatMoney(v, { currency: wallets.find((w) => w.id === walletId)?.currency });
  const valid = value > 0 && !!walletId;
  const whole = value >= left;

  const save = () => {
    if (!valid) return;
    undoable(whole ? tr("Доход получен") : tr("Часть записана"), () => useData.getState().receivePlan(plan.id, value, { walletId, date: date === todayKey() ? undefined : `${date}T12:00` }));
    haptic("success");
    close();
  };

  return (
    <Sheet title={plan.title} ariaLabel={tr("Получил часть")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-4 pt-1">
        <Group footer={tr("Осталось получить {0} из {1}", fmt(left), fmt(plan.amount))}>
          <FormRow label={tr("Сколько пришло")}>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label={tr("Когда")}>
            <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={tr("Куда")}>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              {live.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </FormRow>
        </Group>
        <div className="scroll-x -mt-1 flex gap-2 px-4">
          {[
            { label: tr("Всё · {0}", fmt(left)), v: left },
            ...(left >= 200_000 ? [{ label: tr("Половину · {0}", fmt(Math.round(left / 200) * 100)), v: Math.round(left / 200) * 100 }] : [])
          ].map((q) => (
            <Chip key={q.label} selected={value === q.v} onClick={() => setAmount(amountToInput(q.v).replace(/\s/g, "").replace(",", "."))}>
              {q.label}
            </Chip>
          ))}
        </div>
        <p className="px-6 text-center text-footnote text-ink-3">{whole ? tr("Это весь остаток — доход будет отмечен полученным.") : tr("Остальное останется в ожидании: прогноз учтёт только его.")}</p>
      </div>
    </Sheet>
  );
}

export type { Plan };
