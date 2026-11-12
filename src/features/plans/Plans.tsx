import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, ListTodo, Plus, Repeat, Target, HandCoins, Trash2, Pencil, SkipForward, Undo2 } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { scheduledBetween, freeCash } from "../../lib/analytics";
import { addDays, addMonths, capitalize, diffDays, endOfMonth, formatDate, formatDayHeading, formatRelative, monthTitle, parseDay, startOfMonth, startOfWeek, todayKey, type DayKey } from "../../lib/dates";
import { activeWallets, debtInfo } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { occurrencesInRange } from "../../lib/recurrence";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Plan } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { Button, FormRow, Group, IconButton, IconChip, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { uid } from "../../lib/id";
import { X } from "../../ui/glyphs";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { HeroCard } from "../../ui/HeroCard";
import { materialOf } from "../../store/catalog";
import { planLeft, planSchedule } from "../../lib/plans";
import { tr } from "../../i18n/i18n";

type EventKind = "plan" | "recurring" | "debt" | "task" | "goal";

export interface CalEvent {
  key: string;
  kind: EventKind;
  date: DayKey;
  title: string;
  amount?: number;
  currency?: string;
  direction?: "in" | "out";
  done?: boolean;
  overdue?: boolean;
  onOpen: () => void;
}

const EVENT_ICON: Record<EventKind, typeof Repeat> = { plan: CalendarCheck, recurring: Repeat, debt: HandCoins, task: ListTodo, goal: Target };

export function useEvents(from: DayKey, to: DayKey): CalEvent[] {
  const data = useAppData();
  const today = useToday();
  return useMemo(() => {
    const out: CalEvent[] = [];
    const cur = (walletId?: ID) => data.wallets.find((w) => w.id === walletId)?.currency ?? data.settings.baseCurrency;
    for (const p of data.plans) {
      if (p.status === "skipped") continue;
      const curr = cur(p.walletId);
      // an income in pieces shows each piece still to come on its own date
      const pieces = p.status === "planned" && p.parts?.length ? planSchedule(p, data.transactions).filter((x) => x.left > 0).map((x) => ({ key: x.id, date: x.date, amount: x.left })) : [{ key: "", date: p.date, amount: p.status === "planned" ? planLeft(p, data.transactions) || p.amount : p.amount }];
      for (const piece of pieces) {
        if (piece.date < from || piece.date > to) continue;
        out.push({
          key: `p-${p.id}${piece.key ? `-${piece.key}` : ""}`,
          kind: "plan",
          date: piece.date,
          title: p.estimate && p.status === "planned" ? `${p.title} ≈` : p.title,
          amount: piece.amount,
          currency: curr,
          direction: p.kind === "income" ? "in" : "out",
          done: p.status === "done",
          overdue: p.status === "planned" && piece.date < today,
          onOpen: () => nav.sheet("planActions", { id: p.id })
        });
      }
    }
    for (const r of data.recurring) {
      if (!r.active) continue;
      for (const d of occurrencesInRange(r, from, to)) {
        out.push({ key: `r-${r.id}-${d}`, kind: "recurring", date: d, title: r.title, amount: r.amount, currency: cur(r.walletId), direction: r.kind === "income" ? "in" : r.kind === "transfer" ? undefined : "out", onOpen: () => nav.sheet("recurring", { editId: r.id }) });
      }
    }
    for (const d of data.debts) {
      if (!d.dueDate || d.dueDate < from || d.dueDate > to) continue;
      const info = debtInfo(d, data.transactions, today);
      if (info.status === "closed") continue;
      out.push({ key: `d-${d.id}`, kind: "debt", date: d.dueDate, title: d.direction === "i_owe" ? tr("Вернуть долг: {0}", d.counterparty) : tr("Возврат долга: {0}", d.counterparty), amount: info.remaining, currency: d.currency, direction: d.direction === "i_owe" ? "out" : "in", overdue: info.status === "overdue", onOpen: () => nav.push("debt", { id: d.id }) });
    }
    // Tasks live in «Дела»; this calendar is about money.
    for (const g of data.goals) {
      if (!g.deadline || g.deadline < from || g.deadline > to || g.archived) continue;
      out.push({ key: `g-${g.id}`, kind: "goal", date: g.deadline, title: tr("Срок цели «{0}»", g.name), onOpen: () => nav.push("goal", { id: g.id }) });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [data, from, to, today]);
}

export function PlansScreen() {
  const today = useToday();
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<DayKey>(today);
  const [dir, setDir] = useState(1);
  const gridFrom = startOfWeek(month);
  const gridTo = addDays(startOfWeek(endOfMonth(month)), 6);
  const events = useEvents(addDays(today, -60) < gridFrom ? addDays(today, -60) : gridFrom, gridTo > addDays(today, 45) ? gridTo : addDays(today, 45));
  const byDay = useMemo(() => {
    const m = new Map<DayKey, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const cash = useMemo(() => freeCash(data, balances, entries, today), [data, balances, entries, today]);
  const monthPlan = useMemo(() => scheduledBetween(data, today, endOfMonth(today)), [data, today]);
  const overdue = events.filter((e) => e.overdue && e.kind === "plan");
  const upcoming = events.filter((e) => e.date > today && e.date <= addDays(today, 30) && !e.done).slice(0, 8);

  const days: DayKey[] = [];
  for (let d = gridFrom; d <= gridTo; d = addDays(d, 1)) days.push(d);
  const selectedEvents = byDay.get(selected) ?? [];
  const base = data.settings.baseCurrency;

  const go = (n: number) => {
    setDir(n);
    setMonth((m) => addMonths(m, n, 1));
  };

  return (
    <Screen title={tr("Планы")} large actions={<IconButton icon={Plus} label={tr("Запланировать")} onClick={() => nav.sheet("plan", { date: selected >= today ? selected : today })} />}>
      {/* Free cash forecast */}
      <section>
        <HeroCard material={materialOf("obsidian")} style={{ ["--ink" as string]: "#f5f3f0", ["--ink-2" as string]: "rgba(245,243,240,0.72)", ["--ink-3" as string]: "rgba(245,243,240,0.55)", ["--line" as string]: "rgba(255,255,255,0.12)" }}>
          <div className="px-5 pb-4 pt-[18px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{tr("Свободно к")}{" "}{formatDate(cash.until)}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-semibold", cash.free < 0 ? "bg-[var(--negative-soft)] text-negative" : "bg-[var(--positive-soft)] text-positive")}>{cash.free < 0 ? tr("Не хватит") : tr("Хватает")}</span>
          </div>
          <Money value={cash.free} currency={base} variant="hero" privacy tone={cash.free < 0 ? "negative" : "default"} className="mt-2 block text-[40px] leading-none" />
          <div className="mt-3 flex flex-col gap-1.5 text-subhead">
            <Line label={tr("Сейчас на счетах для трат")} value={cash.available} currency={base} />
            <Line label={tr("Ожидаемые поступления")} value={cash.income} currency={base} sign="+" />
            <Line label={tr("Платежи и планы")} value={-cash.obligations} currency={base} />
            <Line label={tr("Обычные траты до конца месяца")} value={-cash.everyday} currency={base} />
          </div>
          <p className="mt-3 text-caption text-ink-3">{tr("Без накопительных и инвестиционных счетов. Обычные траты — ваш средний темп за 60 дней.")}</p>
          </div>
        </HeroCard>
      </section>

      {overdue.length > 0 && (
        <section className="mt-5">
          <h2 className="section-label px-5 pb-2.5 !text-warning">{tr("Ждут проведения")}</h2>
          <Group>
            {overdue.map((e) => (
              <EventRow key={e.key} e={e} />
            ))}
          </Group>
        </section>
      )}

      {/* Calendar */}
      <section className="mt-5 px-4">
        <div className="panel rounded-xl p-3">
          <div className="flex items-center justify-between px-1">
            <IconButton icon={ChevronLeft} label={tr("Предыдущий месяц")} variant="plain" onClick={() => go(-1)} />
            <div className="text-headline font-semibold">{monthTitle(month)}</div>
            <IconButton icon={ChevronRight} label={tr("Следующий месяц")} variant="plain" onClick={() => go(1)} />
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-caption font-medium text-ink-3">
            {[tr("пн"), tr("вт"), tr("ср"), tr("чт"), tr("пт"), tr("сб"), tr("вс")].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={month}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-7 gap-y-1"
            >
              {days.map((d) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7);
                const ev = byDay.get(d) ?? [];
                const isToday = d === today;
                const isSel = d === selected;
                const hasIn = ev.some((e) => e.direction === "in");
                const hasOut = ev.some((e) => e.direction === "out");
                const hasOther = ev.some((e) => !e.direction);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      haptic();
                      setSelected(d);
                    }}
                    aria-label={`${formatDayHeading(d)}${ev.length ? tr(", событий: {0}", ev.length) : ""}`}
                    className="flex h-11 flex-col items-center justify-center gap-[3px]"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full text-callout tnum transition-colors",
                        isSel ? "bg-ink font-semibold text-ink-inverse" : isToday ? "font-semibold text-accent-ink" : inMonth ? "text-ink" : "text-ink-4"
                      )}
                    >
                      {parseDay(d).getDate()}
                    </span>
                    <span className="flex h-1 gap-[3px]">
                      {hasIn && <span className="h-1 w-1 rounded-full bg-positive" />}
                      {hasOut && <span className="h-1 w-1 rounded-full bg-accent" />}
                      {hasOther && <span className="h-1 w-1 rounded-full bg-ink-3" />}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="section-label px-5 pb-2.5">{formatDayHeading(selected)}</h2>
        {selectedEvents.length === 0 ? (
          <div className="mx-4 flex items-center justify-between rounded-lg border border-dashed border-line-strong px-4 py-3.5">
            <span className="text-subhead text-ink-2">{tr("Ничего не запланировано")}</span>
            {selected >= today && (
              <button type="button" className="text-subhead font-semibold text-accent-ink" onClick={() => nav.sheet("plan", { date: selected })}>{tr("Запланировать")}</button>
            )}
          </div>
        ) : (
          <Group>
            {selectedEvents.map((e) => (
              <EventRow key={e.key} e={e} hideDate />
            ))}
          </Group>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="section-label px-5 pb-2.5">{tr("Ближайшие 30 дней")}</h2>
          <Group footer={tr("В этом месяце ещё ожидается: поступлений {0}, списаний {1}.", formatShort(monthPlan.income, base), formatShort(monthPlan.expense, base))}>
            {upcoming.map((e) => (
              <EventRow key={e.key} e={e} />
            ))}
          </Group>
        </section>
      )}
    </Screen>
  );
}

function formatShort(v: number, currency: string) {
  return formatMoney(v, { currency, kopecks: "never" });
}

function Line({ label, value, currency, sign }: { label: string; value: number; currency: string; sign?: "+" }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <Money value={value} currency={currency} sign={sign ? "always" : "auto"} className="text-ink" />
    </div>
  );
}

export function EventRow({ e, hideDate }: { e: CalEvent; hideDate?: boolean }) {
  const Icon = EVENT_ICON[e.kind];
  const label = { plan: tr("План"), recurring: tr("Регулярно"), debt: tr("Долг"), task: tr("Дело"), goal: tr("Цель") }[e.kind];
  return (
    <Row
      leading={<IconChip icon={e.done ? Check : Icon} size={34} tone={e.overdue ? "warning" : e.done ? "positive" : undefined} />}
      title={<span className={e.done ? "text-ink-2 line-through decoration-ink-3" : undefined}>{e.title}</span>}
      subtitle={`${label}${hideDate ? "" : ` · ${capitalize(e.date === todayKey() ? tr("сегодня") : formatRelative(e.date))}`}${e.overdue ? tr(" · просрочено") : ""}`}
      value={e.amount !== undefined ? <Money value={e.direction === "out" ? -e.amount : e.amount} currency={e.currency} sign={e.direction ? "always" : "never"} tone={e.direction === "in" ? "positive" : "default"} /> : undefined}
      onClick={e.onOpen}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Plan sheets                                                         */
/* ------------------------------------------------------------------ */

export function PlanSheet({ editId, date: d0, kind: k0 }: { editId?: ID; date?: DayKey; kind?: Plan["kind"] }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.plans.find((p) => p.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const categories = useData((s) => s.categories);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [kind, setKind] = useState<Plan["kind"]>(existing?.kind ?? k0 ?? "expense");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount).replace(",", ".") : "");
  const [date, setDate] = useState(existing?.date ?? d0 ?? addDays(todayKey(), 7));
  const [walletId, setWalletId] = useState(existing?.walletId ?? defaultWalletId ?? live[0]?.id);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  // an income that comes in pieces: each with its own date (the advance on the 8th, the rest on the 16th…)
  const [parts, setParts] = useState<Array<{ id: string; date: DayKey; buf: string }>>(existing?.parts?.map((p) => ({ id: p.id, date: p.date, buf: amountToInput(p.amount).replace(",", ".") })) ?? []);
  const [estimate, setEstimate] = useState(existing?.estimate ?? false);
  const split = parts.length > 0;
  const partsTotal = parts.reduce((s, p) => s + parseAmount(p.buf), 0);
  const value = split ? partsTotal : parseAmount(amount);
  const valid = title.trim().length > 0 && value > 0 && !!date && parts.every((p) => !!p.date && parseAmount(p.buf) > 0);
  const setPart = (id: string, patch: Partial<{ date: DayKey; buf: string }>) => setParts((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const startSplit = () => setParts([{ id: uid("pp-"), date, buf: amount }, { id: uid("pp-"), date: addDays(date, 8), buf: "" }]);
  const addPart = () => setParts((l) => [...l, { id: uid("pp-"), date: addDays([...l].map((p) => p.date).sort().pop() ?? date, 8), buf: "" }]);
  const dropPart = (id: string) => {
    const rest = parts.filter((p) => p.id !== id);
    if (rest.length === 1) {
      // a single piece is just the plan itself
      setAmount(rest[0].buf);
      setDate(rest[0].date);
      setParts([]);
    } else setParts(rest);
  };

  const save = () => {
    if (!valid) return;
    const list = split && parts.length >= 2 ? parts.map((p) => ({ id: p.id, date: p.date, amount: parseAmount(p.buf) })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : undefined;
    const fields = { kind, title: title.trim(), amount: value, date: list ? list[0].date : date, parts: list, estimate: kind === "income" && estimate ? true : undefined, walletId, categoryId: categoryId || undefined, note: note.trim() || undefined };
    const st = useData.getState();
    if (existing) {
      st.updatePlan(existing.id, fields);
      st.syncPlan(existing.id);
    } else st.addPlan(fields);
    haptic("success");
    nav.toast(existing ? tr("План сохранён") : tr("Добавлено в план"), { tone: "positive" });
    close();
  };

  return (
    <Sheet title={existing ? tr("План") : tr("Запланировать")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <div className="px-4">
          <Segmented value={kind} onChange={(v) => { setKind(v); setCategoryId(""); }} options={[{ value: "expense", label: tr("Расход") }, { value: "income", label: tr("Поступление") }]} />
        </div>
        <Group>
          <FormRow label={tr("Название")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "expense" ? tr("Например, ремонт") : tr("Например, премия")} maxLength={60} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={split ? tr("Всего") : tr("Сумма")}>
            {split ? (
              <span className="tnum text-right text-body font-semibold">{partsTotal ? formatMoney(partsTotal) : "—"}</span>
            ) : (
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
            )}
          </FormRow>
          {!split && (
            <FormRow label={tr("Дата")}>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
            </FormRow>
          )}
        </Group>
        {kind === "income" && (
          <>
            {split ? (
              <Group header={tr("Выплаты по датам")} footer={tr("Деньги, которые придут, закрывают выплаты по порядку — с самой ранней.")}>
                {parts.map((p, i) => (
                  <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_32px] items-center gap-2 px-4 py-2.5" role="group" aria-label={tr("Выплата {0}", i + 1)}>
                    <input type="date" aria-label={tr("Дата выплаты {0}", i + 1)} value={p.date} onChange={(e) => e.target.value && setPart(p.id, { date: e.target.value })} className={inputCls} />
                    <input inputMode="decimal" aria-label={tr("Сумма выплаты {0}", i + 1)} value={p.buf} onChange={(e) => setPart(p.id, { buf: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0" className={cn(inputCls, "text-right tnum")} />
                    <button type="button" aria-label={tr("Убрать выплату {0}", i + 1)} onClick={() => dropPart(p.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-3">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addPart} className="flex h-12 w-full items-center gap-2 px-4 text-subhead font-semibold text-accent-ink active:bg-surface-3">
                  <Plus size={16} strokeWidth={2.4} />
                  {tr("Ещё выплата")}
                </button>
              </Group>
            ) : (
              <button type="button" onClick={startSplit} className="mx-4 flex h-12 items-center justify-center gap-2 rounded-[16px] border border-dashed border-line-strong text-subhead font-semibold text-ink-2 active:bg-surface-press">
                <CalendarDays size={16} />
                {tr("Разбить на выплаты по датам")}
              </button>
            )}
            <Group footer={estimate ? tr("Прогноз пока считает по этой сумме. Когда итог станет известен, снимите отметку и поправьте суммы.") : undefined}>
              <FormRow label={tr("Сумма ориентировочная")}>
                <Toggle checked={estimate} onChange={setEstimate} label={tr("Сумма ориентировочная")} />
              </FormRow>
            </Group>
          </>
        )}
        <Group>
          <FormRow label={tr("Кошелёк")}>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              {live.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label={tr("Категория")}>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              <option value="">{tr("Не выбрана")}</option>
              {categories.filter((c) => c.kind === kind && !c.archived).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormRow>
          <div className="px-4 py-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Комментарий")} maxLength={120} className={inputCls} />
          </div>
        </Group>
        <p className="px-8 text-footnote text-ink-3">{tr("План не меняет балансы, пока вы его не проведёте. Нужен повтор каждый месяц? Добавьте регулярный платёж в «Подписках и платежах».")}</p>
      </div>
    </Sheet>
  );
}

export function PlanActionsSheet({ id }: { id: ID }) {
  const { close } = useSheet();
  const plan = useData((s) => s.plans.find((p) => p.id === id));
  const wallet = useData((s) => (plan?.walletId ? s.wallets.find((w) => w.id === plan.walletId) : undefined));
  const today = useToday();
  if (!plan) return null;
  const late = plan.status === "planned" && plan.date < today;

  return (
    <Sheet ariaLabel={plan.title}>
      <div className="flex flex-col items-center px-6 pb-5 pt-1 text-center">
        <IconChip icon={CalendarDays} size={52} tone={late ? "warning" : plan.status === "done" ? "positive" : undefined} />
        <div className="mt-3 text-headline font-semibold">{plan.title}</div>
        <Money value={plan.kind === "income" ? plan.amount : -plan.amount} sign="always" currency={wallet?.currency} tone={plan.kind === "income" ? "positive" : "default"} variant="hero" className="mt-1 text-[30px] font-semibold" />
        <div className="mt-1 text-footnote text-ink-2">
          {formatDayHeading(plan.date)} · {plan.status === "done" ? tr("проведено") : plan.status === "skipped" ? tr("пропущено") : late ? tr("просрочено на {0} дн.", diffDays(today, plan.date)) : tr("запланировано")}
          {wallet ? ` · ${wallet.name}` : ""}
        </div>
        {plan.note && <p className="mt-2 text-subhead text-ink-2">{plan.note}</p>}
      </div>
      <Group>
        {plan.status === "planned" && (
          <Row
            icon={Check}
            iconTone="positive"
            title={tr("Провести сейчас")}
            subtitle={tr("Запишется как операция и изменит баланс")}
            onClick={() => {
              undoable(tr("План проведён"), () => useData.getState().completePlan(plan.id));
              haptic("success");
              close();
            }}
          />
        )}
        {plan.status === "done" && (
          <Row
            icon={Undo2}
            title={tr("Вернуть в план")}
            subtitle={tr("Связанная операция будет удалена")}
            onClick={() => {
              undoable(tr("Операция отменена, план восстановлен"), () => useData.getState().setPlanStatus(plan.id, "planned"));
              close();
            }}
          />
        )}
        <Row
          icon={Pencil}
          title={tr("Изменить")}
          onClick={() => {
            close();
            nav.sheet("plan", { editId: plan.id });
          }}
        />
        {plan.status === "planned" && (
          <Row
            icon={SkipForward}
            title={tr("Пропустить")}
            onClick={() => {
              undoable(tr("План пропущен"), () => useData.getState().setPlanStatus(plan.id, "skipped"));
              close();
            }}
          />
        )}
        <Row
          icon={Trash2}
          iconTone="negative"
          destructive
          title={tr("Удалить план")}
          onClick={() => {
            undoable(tr("План удалён"), () => useData.getState().deletePlan(plan.id));
            close();
          }}
        />
      </Group>
      <div className="px-4 pt-3">
        <Button variant="secondary" block onClick={close}>{tr("Закрыть")}</Button>
      </div>
    </Sheet>
  );
}
