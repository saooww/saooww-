import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_NOM, addDays, addMonths, dayOf, endOfMonth, formatDate, parseDay, startOfMonth, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { nextMonthPlan, nextSlot, planLeft, planReceived, planSchedule, type PlanSlot } from "../../lib/plans";
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

/** Income plans of this month (any piece dated in it), plus earlier ones with something still to come. */
export function useMonthIncomes() {
  const plans = useData((s) => s.plans);
  const txs = useData((s) => s.transactions);
  const today = useToday();
  return useMemo(() => {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    const list = plans
      .filter((p) => {
        if (p.kind !== "income" || p.status === "skipped") return false;
        const slots = planSchedule(p, txs);
        return slots.some((x) => x.date >= from && x.date <= to) || (p.status === "planned" && slots.some((x) => x.left > 0 && x.date < from));
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const expected = list.reduce((s, p) => s + p.amount, 0);
    const received = list.reduce((s, p) => s + (p.status === "done" ? p.amount : Math.min(p.amount, planReceived(p, txs))), 0);
    // the piece to wait for next: the earliest one not fully in, over all plans
    let next: { plan: Plan; slot: PlanSlot } | undefined;
    for (const p of list) {
      const slot = nextSlot(p, txs);
      if (slot && (!next || slot.date < next.slot.date)) next = { plan: p, slot };
    }
    return { list, expected, received, left: Math.max(0, expected - received), next, estimate: list.some((p) => p.estimate && p.status === "planned"), today };
  }, [plans, txs, today]);
}

const GREEN_GLOW = { background: "var(--positive)", boxShadow: "0 0 12px color-mix(in srgb, var(--positive) 70%, transparent)" } as const;

/** «Зарплата в ноябре»: what is expected this month, what has come in, and one tap to record the next part. */
export function IncomeCard() {
  const { list, expected, received, next, estimate, today } = useMonthIncomes();
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
          <span className="shrink-0 text-footnote text-ink-2">{next ? tr("ждём {0}", formatDate(next.slot.date)) : tr("всё получено")}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <Money value={received} currency={base} variant="hero" privacy className="text-[28px] leading-none" />
          <span className="text-footnote text-ink-2">{estimate ? tr("из ≈ {0}", formatMoney(expected, { currency: base })) : tr("из {0}", formatMoney(expected, { currency: base }))}</span>
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
              nav.sheet("receive", { planId: next.plan.id, slotId: next.slot.id });
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

/** All income plans of the month: each as a schedule by date, what has come in and where, and what is still to come. */
export function IncomesSheet() {
  const { close } = useSheet();
  const { list, expected, received, estimate, today } = useMonthIncomes();
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const wname = (id?: ID) => wallets.find((w) => w.id === id)?.name;
  const share = expected ? Math.min(1, received / expected) : 0;
  const data = useAppData();
  const regular = useMemo(() => scheduledBetween(data, today, endOfMonth(today), false).items.filter((i) => i.kind === "income" && i.source === "recurring"), [data, today]);

  const nextMonth = (p: Plan) => {
    const st = useData.getState();
    const first = addMonths(startOfMonth(today), 1, 1);
    const last = endOfMonth(first);
    if (st.plans.some((x) => x.title === p.title && x.kind === "income" && x.date >= first && x.date <= last)) {
      nav.toast(tr("На следующий месяц уже есть «{0}»", p.title), {});
      return;
    }
    st.addPlan(nextMonthPlan(p, (d) => addMonths(d, 1, Number(d.slice(8)))));
    haptic("success");
    nav.toast(tr("График «{0}» перенесён на {1}", p.title, MONTHS_NOM[parseDay(first).getMonth()]), { tone: "positive" });
  };

  return (
    <Sheet tall title={tr("Доходы · {0}", MONTHS_NOM[parseDay(today).getMonth()])} ariaLabel={tr("Доходы месяца")} right={<SheetAction strong onClick={close}>{tr("Готово")}</SheetAction>}>
      <div className="px-5 pb-1 text-footnote text-ink-2">
        {tr("Ожидаете {0} · уже получено {1}", `${estimate ? "≈ " : ""}${formatMoney(expected, { currency: base })}`, formatMoney(received, { currency: base }))}
      </div>
      <div className="mx-5 mt-2 h-[10px] overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full" style={{ ...GREEN_GLOW, width: `${share * 100}%` }} />
      </div>

      <div className="mt-5 flex flex-col gap-3 px-4">
        {list.map((p) => {
          const got = p.status === "done" ? p.amount : Math.min(p.amount, planReceived(p, txs));
          const left = planLeft(p, txs);
          const slots = planSchedule(p, txs);
          const parts = txs.filter((t) => t.planId === p.id).sort((a, b) => (a.date < b.date ? -1 : 1));
          const next = nextSlot(p, txs);
          return (
            <section key={p.id} className="panel rounded-[22px] p-4">
              <button type="button" onClick={() => nav.sheet("plan", { editId: p.id })} className="flex w-full items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-positive-soft text-positive">
                  <Check size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline font-semibold">{p.title}</span>
                  <span className="block text-footnote text-ink-2">{p.status === "done" ? tr("получено полностью") : p.estimate ? tr("сумма ориентировочная") : tr("ждём по датам")}</span>
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

              <div className="mt-2.5 border-t border-[var(--line)] pt-1">
                <div className="pb-0.5 pt-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-ink-3">{tr("Выплаты")}</div>
                {slots.map((x) => {
                  const late = x.left > 0 && x.date < today && p.status === "planned";
                  return (
                    <button
                      key={x.id}
                      type="button"
                      disabled={x.left === 0 || p.status !== "planned"}
                      onClick={() => nav.sheet("receive", { planId: p.id, slotId: x.id })}
                      className="flex w-full items-center gap-2.5 py-2 text-left disabled:opacity-100"
                      aria-label={`${formatDate(x.date)} ${formatMoney(x.amount, { currency: base })}`}
                    >
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", x.state === "done" ? "bg-positive" : x.state === "partial" ? "bg-warning" : "border border-dashed border-current text-ink-3")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-subhead", x.left === 0 && "text-ink-2")}>{formatDate(x.date, { year: "auto" })}</span>
                        <span className={cn("block text-caption", late ? "text-warning" : "text-ink-3")}>
                          {x.state === "done" ? tr("получено") : x.state === "partial" ? tr("пришло {0}, ждём ещё {1}", formatMoney(x.got, { currency: base }), formatMoney(x.left, { currency: base })) : late ? tr("ещё не пришло") : tr("ожидается")}
                        </span>
                      </span>
                      <Money value={x.amount} currency={base} className={cn("text-subhead font-semibold", x.left === 0 ? "text-ink-3" : "text-ink")} />
                    </button>
                  );
                })}
              </div>

              {parts.length > 0 && (
                <div className="mt-1 border-t border-[var(--line)] pt-1">
                  <div className="pb-0.5 pt-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-ink-3">{tr("Пришло")}</div>
                  {parts.map((t) => (
                    <button key={t.id} type="button" onClick={() => nav.sheet("tx", { id: t.id })} className="flex w-full items-center gap-2.5 py-2 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-subhead">{formatDate(dayOf(t.date), { year: "auto" })}</span>
                        <span className="block truncate text-caption text-ink-2">{wname(t.walletId) ?? "—"}</span>
                      </span>
                      <Money value={t.amount} currency={base} sign="always" tone="positive" className="text-subhead font-semibold" />
                    </button>
                  ))}
                </div>
              )}

              {p.status === "planned" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => nav.sheet("receive", { planId: p.id, slotId: next?.id })} className="h-11 rounded-[14px] bg-[var(--ink)] text-subhead font-bold text-[var(--bg)] active:opacity-80">
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
              <button type="button" onClick={() => nextMonth(p)} className="mt-2 flex h-10 w-full items-center justify-center rounded-[12px] text-footnote font-semibold text-ink-2 active:bg-surface-3">
                {tr("Повторить на следующий месяц")}
              </button>
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

/** One piece of an expected income: how much came in, when, and on which account — card, cash, anything. */
export function ReceiveSheet({ planId, slotId }: { planId: ID; slotId?: string }) {
  const { close } = useSheet();
  const plan = useData((s) => s.plans.find((p) => p.id === planId));
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const slot = plan ? (planSchedule(plan, txs).find((x) => x.id === slotId && x.left > 0) ?? nextSlot(plan, txs)) : undefined;
  const planRest = plan ? planLeft(plan, txs) : 0;
  const left = slot?.left ?? planRest;
  const [amount, setAmount] = useState(left ? amountToInput(left).replace(/\s/g, "").replace(",", ".") : "");
  const [walletId, setWalletId] = useState(plan?.walletId ?? defaultWalletId ?? live[0]?.id);
  const [date, setDate] = useState(todayKey());
  if (!plan) return null;
  const value = parseAmount(amount);
  const cur = wallets.find((w) => w.id === walletId)?.currency;
  const fmt = (v: number) => formatMoney(v, { currency: cur });
  const valid = value > 0 && !!walletId;
  const over = value > planRest;

  const save = () => {
    if (!valid) return;
    undoable(value >= planRest ? tr("Доход получен") : tr("Часть записана"), () => useData.getState().receivePlan(plan.id, value, { walletId, date: date === todayKey() ? undefined : `${date}T12:00` }));
    haptic("success");
    close();
  };

  return (
    <Sheet title={plan.title} ariaLabel={tr("Получил часть")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-4 pt-1">
        <Group footer={slot ? tr("Выплата {0}: ждали {1}", formatDate(slot.date), fmt(slot.amount)) : tr("Осталось получить {0} из {1}", fmt(planRest), fmt(plan.amount))}>
          <FormRow label={tr("Сколько пришло")}>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label={tr("Когда")}>
            <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <div className="scroll-x -mt-1 flex gap-2 px-4">
          <Chip selected={date === todayKey()} onClick={() => setDate(todayKey())}>{tr("Сегодня")}</Chip>
          <Chip selected={date === addDays(todayKey(), -1)} onClick={() => setDate(addDays(todayKey(), -1))}>{tr("Вчера")}</Chip>
          {[
            { label: tr("Всё · {0}", fmt(left)), v: left },
            ...(left >= 200_000 ? [{ label: tr("Половину · {0}", fmt(Math.round(left / 200) * 100)), v: Math.round(left / 200) * 100 }] : [])
          ].map((q) => (
            <Chip key={q.label} selected={value === q.v} onClick={() => setAmount(amountToInput(q.v).replace(/\s/g, "").replace(",", "."))}>
              {q.label}
            </Chip>
          ))}
        </div>
        <div>
          <div className="section-label px-5 pb-2">{tr("Куда пришли деньги")}</div>
          <div className="scroll-x flex gap-2 px-4" role="radiogroup" aria-label={tr("Куда пришли деньги")}>
            {live.map((w) => (
              <Chip key={w.id} selected={walletId === w.id} onClick={() => setWalletId(w.id)}>
                {w.name}
              </Chip>
            ))}
          </div>
        </div>
        <p className="px-6 text-center text-footnote text-ink-3">
          {over ? tr("Больше, чем ждали: лишнее запишется как обычный доход, ожидание закроется.") : value >= planRest && value > 0 ? tr("Это весь остаток — доход будет отмечен полученным.") : tr("Остальное останется в ожидании: прогноз учтёт только его.")}
        </p>
      </div>
    </Sheet>
  );
}

export type { Plan };
