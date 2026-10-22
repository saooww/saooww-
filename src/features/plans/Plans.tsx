import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, ListTodo, Plus, Repeat, Target, HandCoins, Trash2, Pencil, SkipForward, Undo2 } from "lucide-react";
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
import { Button, FormRow, Group, IconButton, IconChip, Row, Segmented, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

type EventKind = "plan" | "recurring" | "debt" | "task" | "goal";

interface CalEvent {
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

function useEvents(from: DayKey, to: DayKey): CalEvent[] {
  const data = useAppData();
  const today = useToday();
  return useMemo(() => {
    const out: CalEvent[] = [];
    const cur = (walletId?: ID) => data.wallets.find((w) => w.id === walletId)?.currency ?? data.settings.baseCurrency;
    for (const p of data.plans) {
      if (p.date < from || p.date > to || p.status === "skipped") continue;
      out.push({
        key: `p-${p.id}`,
        kind: "plan",
        date: p.date,
        title: p.title,
        amount: p.amount,
        currency: cur(p.walletId),
        direction: p.kind === "income" ? "in" : "out",
        done: p.status === "done",
        overdue: p.status === "planned" && p.date < today,
        onOpen: () => nav.sheet("planActions", { id: p.id })
      });
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
      out.push({ key: `d-${d.id}`, kind: "debt", date: d.dueDate, title: d.direction === "i_owe" ? `Вернуть долг: ${d.counterparty}` : `Возврат долга: ${d.counterparty}`, amount: info.remaining, currency: d.currency, direction: d.direction === "i_owe" ? "out" : "in", overdue: info.status === "overdue", onOpen: () => nav.push("debt", { id: d.id }) });
    }
    for (const t of data.tasks) {
      if (!t.due || t.due < from || t.due > to) continue;
      out.push({ key: `t-${t.id}`, kind: "task", date: t.due, title: t.title, done: t.done, overdue: !t.done && t.due < today, onOpen: () => nav.sheet("task", { editId: t.id }) });
    }
    for (const g of data.goals) {
      if (!g.deadline || g.deadline < from || g.deadline > to || g.archived) continue;
      out.push({ key: `g-${g.id}`, kind: "goal", date: g.deadline, title: `Срок цели «${g.name}»`, onOpen: () => nav.push("goal", { id: g.id }) });
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
    <Screen title="Планы" large actions={<IconButton icon={Plus} label="Запланировать" onClick={() => nav.sheet("plan", { date: selected >= today ? selected : today })} />}>
      {/* Free cash forecast */}
      <section className="px-4">
        <div className="panel rounded-xl p-4">
          <div className="text-footnote font-medium text-ink-2">Свободно к {formatDate(cash.until)}</div>
          <Money value={cash.free} currency={base} variant="hero" privacy tone={cash.free < 0 ? "negative" : "default"} className="mt-0.5 block text-[30px] font-semibold tracking-[-0.03em]" />
          <div className="mt-3 flex flex-col gap-1.5 text-subhead">
            <Line label="Сейчас на счетах для трат" value={cash.available} currency={base} />
            <Line label="Ожидаемые поступления" value={cash.income} currency={base} sign="+" />
            <Line label="Платежи и планы" value={-cash.obligations} currency={base} />
            <Line label="Обычные траты до конца месяца" value={-cash.everyday} currency={base} />
          </div>
          <p className="mt-3 text-caption text-ink-3">Без накопительных и инвестиционных счетов. Обычные траты — ваш средний темп за 60 дней.</p>
        </div>
      </section>

      {overdue.length > 0 && (
        <section className="mt-5">
          <h2 className="label-caps px-5 pb-2.5 !text-warning">Ждут проведения</h2>
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
            <IconButton icon={ChevronLeft} label="Предыдущий месяц" variant="plain" onClick={() => go(-1)} />
            <div className="text-headline font-semibold">{monthTitle(month)}</div>
            <IconButton icon={ChevronRight} label="Следующий месяц" variant="plain" onClick={() => go(1)} />
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-caption font-medium text-ink-3">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
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
                    aria-label={`${formatDayHeading(d)}${ev.length ? `, событий: ${ev.length}` : ""}`}
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
        <h2 className="label-caps px-5 pb-2.5">{formatDayHeading(selected)}</h2>
        {selectedEvents.length === 0 ? (
          <div className="mx-4 flex items-center justify-between rounded-lg border border-dashed border-line-strong px-4 py-3.5">
            <span className="text-subhead text-ink-2">Ничего не запланировано</span>
            {selected >= today && (
              <button type="button" className="text-subhead font-semibold text-accent-ink" onClick={() => nav.sheet("plan", { date: selected })}>
                Запланировать
              </button>
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
          <h2 className="label-caps px-5 pb-2.5">Ближайшие 30 дней</h2>
          <Group footer={`В этом месяце ещё ожидается: поступлений ${formatShort(monthPlan.income, base)}, списаний ${formatShort(monthPlan.expense, base)}.`}>
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

function EventRow({ e, hideDate }: { e: CalEvent; hideDate?: boolean }) {
  const Icon = EVENT_ICON[e.kind];
  const label = { plan: "План", recurring: "Регулярно", debt: "Долг", task: "Задача", goal: "Цель" }[e.kind];
  return (
    <Row
      leading={<IconChip icon={e.done ? Check : Icon} size={34} tone={e.overdue ? "warning" : e.done ? "positive" : undefined} />}
      title={<span className={e.done ? "text-ink-2 line-through decoration-ink-3" : undefined}>{e.title}</span>}
      subtitle={`${label}${hideDate ? "" : ` · ${capitalize(e.date === todayKey() ? "сегодня" : formatRelative(e.date))}`}${e.overdue ? " · просрочено" : ""}`}
      value={e.amount !== undefined ? <Money value={e.direction === "out" ? -e.amount : e.amount} currency={e.currency} sign={e.direction ? "always" : "never"} tone={e.direction === "in" ? "positive" : "default"} /> : undefined}
      onClick={e.onOpen}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Plan sheets                                                         */
/* ------------------------------------------------------------------ */

export function PlanSheet({ editId, date: d0 }: { editId?: ID; date?: DayKey }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.plans.find((p) => p.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const categories = useData((s) => s.categories);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [kind, setKind] = useState<Plan["kind"]>(existing?.kind ?? "expense");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount).replace(",", ".") : "");
  const [date, setDate] = useState(existing?.date ?? d0 ?? addDays(todayKey(), 7));
  const [walletId, setWalletId] = useState(existing?.walletId ?? defaultWalletId ?? live[0]?.id);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const value = parseAmount(amount);
  const valid = title.trim().length > 0 && value > 0 && !!date;

  const save = () => {
    if (!valid) return;
    const fields = { kind, title: title.trim(), amount: value, date, walletId, categoryId: categoryId || undefined, note: note.trim() || undefined };
    const st = useData.getState();
    if (existing) st.updatePlan(existing.id, fields);
    else st.addPlan(fields);
    haptic("success");
    nav.toast(existing ? "План сохранён" : "Добавлено в план", { tone: "positive" });
    close();
  };

  return (
    <Sheet title={existing ? "План" : "Запланировать"} left={<SheetAction onClick={close}>Отмена</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <div className="px-4">
          <Segmented value={kind} onChange={(v) => { setKind(v); setCategoryId(""); }} options={[{ value: "expense", label: "Расход" }, { value: "income", label: "Поступление" }]} />
        </div>
        <Group>
          <FormRow label="Название">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "expense" ? "Например, ремонт" : "Например, премия"} maxLength={60} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label="Сумма">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label="Дата">
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <Group>
          <FormRow label="Кошелёк">
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              {live.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Категория">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              <option value="">Не выбрана</option>
              {categories.filter((c) => c.kind === kind && !c.archived).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormRow>
          <div className="px-4 py-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий" maxLength={120} className={inputCls} />
          </div>
        </Group>
        <p className="px-8 text-footnote text-ink-3">План не меняет балансы, пока вы его не проведёте. Нужен повтор каждый месяц? Добавьте регулярный платёж в «Подписках и платежах».</p>
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
          {formatDayHeading(plan.date)} · {plan.status === "done" ? "проведено" : plan.status === "skipped" ? "пропущено" : late ? `просрочено на ${diffDays(today, plan.date)} дн.` : "запланировано"}
          {wallet ? ` · ${wallet.name}` : ""}
        </div>
        {plan.note && <p className="mt-2 text-subhead text-ink-2">{plan.note}</p>}
      </div>
      <Group>
        {plan.status === "planned" && (
          <Row
            icon={Check}
            iconTone="positive"
            title="Провести сейчас"
            subtitle="Запишется как операция и изменит баланс"
            onClick={() => {
              undoable("План проведён", () => useData.getState().completePlan(plan.id));
              haptic("success");
              close();
            }}
          />
        )}
        {plan.status === "done" && (
          <Row
            icon={Undo2}
            title="Вернуть в план"
            subtitle="Связанная операция будет удалена"
            onClick={() => {
              undoable("Операция отменена, план восстановлен", () => useData.getState().setPlanStatus(plan.id, "planned"));
              close();
            }}
          />
        )}
        <Row
          icon={Pencil}
          title="Изменить"
          onClick={() => {
            close();
            nav.sheet("plan", { editId: plan.id });
          }}
        />
        {plan.status === "planned" && (
          <Row
            icon={SkipForward}
            title="Пропустить"
            onClick={() => {
              undoable("План пропущен", () => useData.getState().setPlanStatus(plan.id, "skipped"));
              close();
            }}
          />
        )}
        <Row
          icon={Trash2}
          iconTone="negative"
          destructive
          title="Удалить план"
          onClick={() => {
            undoable("План удалён", () => useData.getState().deletePlan(plan.id));
            close();
          }}
        />
      </Group>
      <div className="px-4 pt-3">
        <Button variant="secondary" block onClick={close}>
          Закрыть
        </Button>
      </div>
    </Sheet>
  );
}
