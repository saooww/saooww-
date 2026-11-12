import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_NOM, addDays, dayOf, diffDays, endOfMonth, formatDate, parseDay, startOfMonth, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { nextSlot, planLeft, planReceived, planSchedule, planSurplus, type PlanSlot } from "../../lib/plans";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { activeWallets } from "../../lib/finance";
import { useData } from "../../store/store";
import { useAppData, useToday } from "../../store/hooks";
import { scheduledBetween } from "../../lib/analytics";
import type { ID, Plan } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Money } from "../../ui/Money";
import { Chip, Group, inputCls } from "../../ui/primitives";
import { DateField } from "../../ui/DateField";
import { uid } from "../../lib/id";
import { X, Pencil, Trash2, Repeat } from "../../ui/glyphs";
import { askRemovePlan } from "../plans/removePlan";
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

/**
 * The month as a line with every payment on its day: filled — in, half — part
 * of it in, ring — still to come; a red mark for today. One look shows what
 * is behind and what is ahead.
 */
function IncomeTimeline({ list, today }: { list: Plan[]; today: string }) {
  const txs = useData((s) => s.transactions);
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const span = Math.max(1, diffDays(to, from));
  const x = (d: string) => `${(Math.max(0, Math.min(span, diffDays(d < from ? from : d > to ? to : d, from))) / span) * 100}%`;
  const marks = list.flatMap((p) => planSchedule(p, txs).filter((s) => s.date >= from && s.date <= to).map((s) => ({ key: `${p.id}-${s.id}`, s })));
  if (!marks.length) return null;
  return (
    <div className="relative mt-3.5 h-[30px]" aria-hidden="true">
      <div className="absolute inset-x-0 top-[9px] h-[3px] rounded-full bg-[var(--line)]" />
      <div className="absolute left-0 top-[9px] h-[3px] rounded-full" style={{ width: x(today), background: "color-mix(in srgb, var(--positive) 55%, transparent)" }} />
      <div className="absolute top-[3px] h-[15px] w-[2px] -translate-x-1/2 rounded-full bg-accent" style={{ left: x(today) }} />
      {marks.map(({ key, s }) => (
        <span key={key} className="absolute top-[4px] -translate-x-1/2" style={{ left: x(s.date) }}>
          <span
            className={cn("block h-[13px] w-[13px] rounded-full", s.state === "open" && "border-2 border-[var(--ink-3)] bg-[var(--bg)]")}
            style={s.state === "done" ? { background: "var(--positive)", boxShadow: "0 0 10px color-mix(in srgb, var(--positive) 70%, transparent)" } : s.state === "partial" ? { background: "linear-gradient(90deg, var(--positive) 50%, var(--line) 50%)", boxShadow: "0 0 0 2px var(--positive) inset" } : undefined}
          />
        </span>
      ))}
      <div className="absolute inset-x-0 top-[19px] flex justify-between text-[10px] text-ink-3">
        <span>1</span>
        <span>{parseDay(to).getDate()}</span>
      </div>
    </div>
  );
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
        <IncomeTimeline list={list} today={today} />
        {next && (
          <div className="mt-1 flex items-center justify-between text-caption text-ink-2">
            <span>
              {tr("Следующая")}: {next.slot.label ? `${next.slot.label} · ` : ""}
              {formatDate(next.slot.date)}
            </span>
            <span className="num font-semibold text-ink">{formatMoney(next.slot.left, { currency: base })}</span>
          </div>
        )}
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

  const makeMonthly = (p: Plan) => {
    const st = useData.getState();
    st.updatePlan(p.id, { repeat: "month", seriesId: p.seriesId ?? p.id });
    const made = st.rollPlans(today);
    haptic("success");
    nav.toast(made.length ? tr("«{0}» будет каждый месяц — следующий уже в плане", p.title) : tr("«{0}» будет каждый месяц", p.title), { tone: "positive" });
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
          const surplus = planSurplus(p, txs);
          return (
            <section key={p.id} className="panel rounded-[22px] p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-positive-soft text-positive">
                  <Check size={18} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-headline font-semibold">{p.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {p.status === "done" && <span className="rounded-full bg-positive-soft px-2 py-0.5 text-caption font-semibold text-positive">{tr("получено")}</span>}
                    {p.estimate && p.status === "planned" && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning">≈ {tr("приблизительно")}</span>}
                    {p.repeat === "month" && <span className="tile rounded-full px-2 py-0.5 text-caption font-semibold text-ink-2">{tr("каждый месяц")}</span>}
                  </span>
                </span>
                <span className="text-right">
                  <Money value={p.amount} currency={base} className="block text-callout font-semibold" />
                  {surplus > 0 && <span className="block text-caption font-semibold text-positive">{tr("+{0} сверх", formatMoney(surplus, { currency: base }))}</span>}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => nav.sheet("plan", { editId: p.id })} className="tile flex h-8 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold" aria-label={tr("Изменить «{0}»", p.title)}>
                  <Pencil size={13} />
                  {tr("Изменить")}
                </button>
                <button type="button" onClick={() => askRemovePlan(p)} className="tile flex h-8 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold text-negative" aria-label={tr("Удалить «{0}»", p.title)}>
                  <Trash2 size={13} />
                  {tr("Удалить")}
                </button>
              </div>
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
                        <span className={cn("block text-subhead", x.left === 0 && "text-ink-2")}>
                          {x.label ? <span className="font-semibold">{x.label} · </span> : null}
                          {formatDate(x.date, { year: "auto" })}
                        </span>
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
              {p.repeat !== "month" && (
                <button type="button" onClick={() => makeMonthly(p)} className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] text-footnote font-semibold text-ink-2 active:bg-surface-3">
                  <Repeat size={14} />
                  {tr("Повторять каждый месяц")}
                </button>
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

/**
 * Money for an expected income came in: which payment it is (an advance can
 * come early), how much, when, and where — one account, or split across
 * several (388 ₽ on the card and 4 000 ₽ in cash).
 */
export function ReceiveSheet({ planId, slotId }: { planId: ID; slotId?: string }) {
  const { close } = useSheet();
  const plan = useData((s) => s.plans.find((p) => p.id === planId));
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const slots = plan ? planSchedule(plan, txs) : [];
  const open = slots.filter((x) => x.left > 0);
  const first = open.find((x) => x.id === slotId) ?? open[0];
  const [partId, setPartId] = useState<string | undefined>(first?.id);
  const slot = slots.find((x) => x.id === partId);
  const planRest = plan ? planLeft(plan, txs) : 0;
  const startWallet = plan?.walletId ?? defaultWalletId ?? live[0]?.id ?? "";
  const toBuf = (v: number) => (v ? amountToInput(v).replace(/\s/g, "").replace(",", ".") : "");
  const [lines, setLines] = useState<Array<{ key: string; walletId: ID; buf: string }>>([{ key: "l0", walletId: startWallet, buf: toBuf(first?.left ?? planRest) }]);
  const [date, setDate] = useState(todayKey());
  if (!plan) return null;
  const total = lines.reduce((s, l) => s + parseAmount(l.buf), 0);
  const cur = wallets.find((w) => w.id === lines[0]?.walletId)?.currency;
  const fmt = (v: number) => formatMoney(v, { currency: cur });
  const valid = total > 0 && lines.every((l) => !!l.walletId && (parseAmount(l.buf) > 0 || lines.length === 1));
  const over = total > planRest;
  const setLine = (key: string, patch: Partial<{ walletId: ID; buf: string }>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const pick = (id: string) => {
    setPartId(id);
    const x = slots.find((y) => y.id === id);
    if (x && lines.length === 1) setLine(lines[0].key, { buf: toBuf(x.left) });
  };
  const splitAccounts = () => {
    const other = live.find((w) => w.id !== lines[0].walletId)?.id ?? lines[0].walletId;
    setLines((l) => [...l, { key: uid("l"), walletId: other, buf: "" }]);
  };

  const save = () => {
    if (!valid) return;
    const when = date === todayKey() ? undefined : `${date}T12:00`;
    undoable(total >= planRest ? tr("Доход получен") : tr("Часть записана"), () => {
      for (const l of lines) {
        const v = parseAmount(l.buf);
        if (v > 0) useData.getState().receivePlan(plan.id, v, { walletId: l.walletId, date: when, partId: plan.parts?.length ? partId : undefined });
      }
    });
    haptic("success");
    close();
  };

  return (
    <Sheet tall title={plan.title} ariaLabel={tr("Получил часть")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-4 pt-1">
        {plan.parts?.length && open.length > 1 ? (
          <div>
            <div className="section-label px-5 pb-2">{tr("Какая выплата")}</div>
            <div className="scroll-x flex gap-2 px-4" role="radiogroup" aria-label={tr("Какая выплата")}>
              {open.map((x) => (
                <Chip key={x.id} selected={partId === x.id} onClick={() => pick(x.id)}>
                  {x.label ? `${x.label} · ` : ""}
                  {formatDate(x.date)}
                </Chip>
              ))}
            </div>
            {slot && <div className="px-5 pt-1.5 text-caption text-ink-3">{tr("Ждали {0}, осталось {1}", fmt(slot.amount), fmt(slot.left))}</div>}
          </div>
        ) : null}

        <div>
          <div className="section-label px-5 pb-2">{lines.length > 1 ? tr("Сколько и куда") : tr("Сколько пришло")}</div>
          <div className="flex flex-col gap-2 px-4">
            {lines.map((l, i) => (
              <div key={l.key} className="panel rounded-[18px] p-3" role="group" aria-label={tr("Приход {0}", i + 1)}>
                <div className="flex items-center gap-2">
                  <span className="tile flex h-11 min-w-0 flex-1 items-center rounded-[14px] px-3">
                    <input autoFocus={i === 0} inputMode="decimal" aria-label={tr("Сумма прихода {0}", i + 1)} value={l.buf} onChange={(e) => setLine(l.key, { buf: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0" className={cn(inputCls, "text-right text-title-3 font-bold tnum")} />
                  </span>
                  {lines.length > 1 && (
                    <button type="button" aria-label={tr("Убрать приход {0}", i + 1)} onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-3">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="scroll-x mt-2 flex gap-1.5" role="radiogroup" aria-label={i === 0 ? tr("Куда пришли деньги") : tr("Куда пришли деньги {0}", i + 1)}>
                  {live.map((w) => (
                    <Chip key={w.id} selected={l.walletId === w.id} onClick={() => setLine(l.key, { walletId: w.id })}>
                      {w.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={splitAccounts} className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong text-subhead font-semibold text-ink-2 active:bg-surface-press">
              <Plus size={15} strokeWidth={2.4} />
              {lines.length > 1 ? tr("Ещё счёт") : tr("Разделить по счетам — часть на карту, часть наличными")}
            </button>
          </div>
        </div>

        <div className="px-4">
          <div className="section-label px-1 pb-2">{tr("Когда")}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip selected={date === todayKey()} onClick={() => setDate(todayKey())}>{tr("Сегодня")}</Chip>
            <Chip selected={date === addDays(todayKey(), -1)} onClick={() => setDate(addDays(todayKey(), -1))}>{tr("Вчера")}</Chip>
            <DateField label={tr("Дата прихода")} value={date} max={todayKey()} onChange={setDate} />
          </div>
        </div>

        <div className="mx-4 flex items-center justify-between rounded-[16px] px-4 py-3" style={{ background: "color-mix(in srgb, var(--positive) 12%, transparent)" }}>
          <span className="text-subhead text-ink-2">{tr("Итого придёт")}</span>
          <span className="num text-headline font-bold text-positive">+{fmt(total)}</span>
        </div>
        <p className="-mt-1 px-6 text-center text-footnote text-ink-3">
          {over ? tr("Больше, чем ждали ({0}): лишнее запишется обычным доходом, ожидание закроется.", fmt(planRest)) : total >= planRest && total > 0 ? tr("Это весь остаток — доход будет отмечен полученным.") : tr("Остальное ({0}) останется в ожидании: прогноз учтёт только его.", fmt(Math.max(0, planRest - total)))}
        </p>
      </div>
    </Sheet>
  );
}

export type { Plan };
