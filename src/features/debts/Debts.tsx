import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, Check, ChevronDown, ChevronRight, CircleCheck, HandCoins, Pencil, Plus, RotateCcw, Trash2 } from "../../ui/glyphs";
import { AnimatedMoney } from "../../ui/Money";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDayHeading, nowISO, pluralN, todayKey } from "../../lib/dates";
import { activeWallets, debtInfo, type DebtInfo } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Debt, ID } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, Chip, EmptyState, FormRow, Group, IconButton, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

function dueText(d: Debt, info: DebtInfo): { text: string; tone: string } {
  if (info.status === "closed") return { text: d.closedAt ? tr("Закрыт {0}", formatDate(dayOf(d.closedAt))) : tr("Закрыт"), tone: "text-ink-3" };
  if (info.daysToDue === null) return { text: tr("Без срока"), tone: "text-ink-2" };
  if (info.daysToDue < 0) return { text: tr("Просрочен на {0}", pluralN(-info.daysToDue, ["день", "дня", "дней"])), tone: "text-negative" };
  if (info.daysToDue === 0) return { text: tr("Срок сегодня"), tone: "text-warning" };
  if (info.daysToDue <= 3) return { text: tr("Через {0}", pluralN(info.daysToDue, ["день", "дня", "дней"])), tone: "text-warning" };
  return { text: tr("до {0}", formatDate(d.dueDate!)), tone: "text-ink-2" };
}

const GREEN = "#2e9d72";
const RED = "#df0714";
const SEGMENTS = 20;

/** A task in «Дела» that reminds about the debt on its due day */
function remind(d: Debt, remaining: number) {
  const sum = formatMoney(remaining, { currency: d.currency });
  const title = d.direction === "owed_to_me" ? tr("Напомнить про долг: {0} · {1}", d.counterparty, sum) : tr("Вернуть долг: {0} · {1}", d.counterparty, sum);
  const st = useData.getState();
  if (st.tasks.some((t) => !t.done && t.title === title)) {
    nav.toast(tr("Такое дело уже есть"), {});
    return;
  }
  const today = todayKey();
  const due = d.dueDate && d.dueDate >= today ? d.dueDate : today;
  st.addTask({ title, due, priority: 1, repeat: "none" });
  haptic("success");
  nav.toast(tr("Дело записано на {0}", formatDate(due)), { tone: "positive" });
}

/**
 * A debt as a card in its own colour — green when the money comes back to
 * you, red when you owe it: what is left in large figures, the share already
 * returned as a row of segments, and the deadline.
 */
function DebtCard({ d, info, big, delay = 0, onOpen }: { d: Debt; info: DebtInfo; big?: boolean; delay?: number; onOpen?: () => void }) {
  const mine = d.direction === "owed_to_me";
  const closed = info.status === "closed";
  const color = closed ? "#5b5f66" : mine ? GREEN : RED;
  const due = dueText(d, info);
  const late = !closed && info.daysToDue !== null && info.daysToDue < 0;
  const soon = !closed && info.daysToDue !== null && info.daysToDue >= 0 && info.daysToDue <= 3;
  const filled = Math.round(info.progress * SEGMENTS);
  return (
    <motion.div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && onOpen()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay }}
      whileTap={onOpen ? { scale: 0.985 } : undefined}
      className={cn("relative overflow-hidden rounded-[24px] text-white", onOpen && "cursor-pointer", big ? "px-5 pb-5 pt-5" : "px-[18px] pb-4 pt-4")}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(90% 70% at 100% 100%, rgba(0,0,0,0.35), transparent 70%), linear-gradient(150deg, ${color}, color-mix(in srgb, ${color} 34%, #050505))`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.12) inset, 0 24px 44px -26px color-mix(in srgb, ${color} 70%, transparent)`
      }}
    >
      <HandCoins size={big ? 170 : 130} className="pointer-events-none absolute -bottom-7 -right-6 opacity-[0.1]" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-subhead font-bold">{d.counterparty.trim().slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold", big ? "text-title-3" : "text-headline")}>{d.counterparty}</span>
          <span className="block text-caption text-white/75">{mine ? tr("вам должны") : tr("вы должны")}</span>
        </span>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold", late ? "bg-white text-[#b00610]" : soon ? "bg-white/90 text-black" : "bg-black/25")}>{due.text}</span>
      </div>
      <div className="relative mt-3 flex items-baseline justify-between gap-3">
        <Money value={closed ? d.amount : info.remaining} currency={d.currency} privacy variant="hero" className={cn("leading-none", big ? "text-[44px]" : "text-[32px]")} />
        {info.paid > 0 && !closed && <span className="num text-footnote text-white/80">{Math.round(info.progress * 100)}%</span>}
      </div>
      <div className="relative mt-3 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className="h-[7px] flex-1 rounded-[2px]" style={{ background: i < filled || closed ? "#ffffff" : "rgba(255,255,255,0.2)" }} />
        ))}
      </div>
      <div className="relative mt-2.5 flex items-center justify-between gap-2 text-caption text-white/80">
        <span className="truncate">{tr("Возвращено")} {formatMoney(info.paid, { currency: d.currency })} {tr("из")} {formatMoney(d.amount, { currency: d.currency })}</span>
        {onOpen && !closed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic();
              nav.sheet("debtPay", { debtId: d.id });
            }}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-footnote font-semibold text-black active:opacity-80"
          >
            <Check size={14} strokeWidth={2.4} />
            {mine ? tr("Вернули") : tr("Вернуть")}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function DebtsScreen() {
  const debts = useData((s) => s.debts);
  const transactions = useData((s) => s.transactions);
  const base = useData((s) => s.settings.baseCurrency);
  const today = useToday();
  const [showClosed, setShowClosed] = useState(false);
  const items = useMemo(() => debts.map((d) => ({ d, info: debtInfo(d, transactions, today) })), [debts, transactions, today]);
  const active = items.filter((x) => x.info.status !== "closed").sort((a, b) => b.info.remaining - a.info.remaining);
  const closed = items.filter((x) => x.info.status === "closed");
  const owedToMe = active.filter((x) => x.d.direction === "owed_to_me" && x.d.currency === base).reduce((s, x) => s + x.info.remaining, 0);
  const iOwe = active.filter((x) => x.d.direction === "i_owe" && x.d.currency === base).reduce((s, x) => s + x.info.remaining, 0);
  const net = owedToMe - iOwe;
  const [picked, setPicked] = useState<ID | null>(null);
  // the one that needs attention first: overdue, then the nearest due date
  const urgent = [...active].sort((a, b) => (a.info.daysToDue ?? 9999) - (b.info.daysToDue ?? 9999))[0];
  const sel = active.find((x) => x.d.id === picked) ?? urgent;
  const max = Math.max(1, ...active.map((x) => x.info.remaining));

  return (
    <Screen title={tr("Долги")} actions={<IconButton icon={Plus} label={tr("Новый долг")} onClick={() => nav.sheet("debt")} />}>
      {active.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tr("Долгов нет")}
          text={tr("Записывайте, кому вы одолжили и у кого заняли, — приложение напомнит о сроках.")}
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("debt")}>{tr("Записать долг")}</Button>}
        />
      ) : (
        <>
          <div className="px-5 pt-2 text-center">
            <div className="text-subhead text-ink-2">{net > 0 ? tr("В итоге вам вернут") : net < 0 ? tr("В итоге вы должны") : tr("Никто никому не должен")}</div>
            <AnimatedMoney value={net} currency={base} sign={net ? "always" : "never"} privacy variant="hero" className={cn("mt-1 block text-[50px] leading-none", net > 0 ? "text-positive" : net < 0 ? "text-negative" : "text-ink")} />
            <div className="mt-2 text-footnote text-ink-3">
              {tr("вам должны")} {formatMoney(owedToMe, { currency: base })} · {tr("вы должны")} {formatMoney(iOwe, { currency: base })}
            </div>
          </div>

          {/* everyone as a circle: green owes you, red you owe; the bigger, the larger the sum */}
          <div className="mt-7 flex flex-wrap items-end justify-center gap-x-6 gap-y-5 px-4">
            {active.map(({ d, info }, k) => {
              const mine = d.direction === "owed_to_me";
              const size = Math.round(66 + 46 * Math.sqrt(info.remaining / max));
              const on = sel?.d.id === d.id;
              const due = dueText(d, info);
              const c = mine ? GREEN : RED;
              return (
                <motion.button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${d.counterparty}: ${mine ? "+" : "−"}${formatMoney(info.remaining, { currency: d.currency })}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: on || !picked ? 1 : 0.6, scale: 1 }}
                  transition={{ ...spring.smooth, delay: k * 0.05 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    haptic();
                    setPicked(d.id);
                  }}
                  className="flex w-[118px] flex-col items-center text-center"
                >
                  <span
                    className="grid place-items-center rounded-full font-bold text-white"
                    style={{
                      width: size,
                      height: size,
                      fontSize: size * 0.36,
                      background: `radial-gradient(circle at 32% 26%, color-mix(in srgb, ${c} 55%, #fff), ${c} 55%, color-mix(in srgb, ${c} 55%, #000))`,
                      boxShadow: `0 0 ${on ? 44 : 28}px -6px ${c}${on ? ", 0 0 0 3px var(--bg), 0 0 0 5px " + c : ""}`
                    }}
                  >
                    {d.counterparty.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span className="mt-2.5 block max-w-full truncate text-callout font-semibold">{d.counterparty}</span>
                  <Money value={mine ? info.remaining : -info.remaining} currency={d.currency} sign="always" privacy className={cn("text-subhead font-bold", mine ? "text-positive" : "text-negative")} />
                  <span className={cn("text-caption", due.tone)}>{due.text}</span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-4 text-center text-caption text-ink-3">{tr("Чем больше круг — тем больше сумма")}</div>

          {sel && <Picked d={sel.d} info={sel.info} />}
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        <Button variant="secondary" icon={ArrowUpRight} onClick={() => nav.sheet("debt", { direction: "owed_to_me" })}>{tr("Дал в долг")}</Button>
        <Button variant="secondary" icon={ArrowDownLeft} onClick={() => nav.sheet("debt", { direction: "i_owe" })}>{tr("Взял в долг")}</Button>
      </div>

      {closed.length > 0 && (
        <div className="mt-7">
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="flex w-full items-center gap-2 px-5 py-2 text-subhead font-medium text-ink-2">
            <CircleCheck size={16} />
            {tr("Закрытые · {0}", closed.length)}
            <ChevronDown size={16} className={cn("transition-transform", showClosed && "rotate-180")} />
          </button>
          {showClosed && (
            <Group>
              {closed.map(({ d }) => (
                <Row key={d.id} title={d.counterparty} subtitle={dueText(d, debtInfo(d, transactions, today)).text} value={<Money value={d.amount} currency={d.currency} className="text-ink-3" />} chevron onClick={() => nav.push("debt", { id: d.id })} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Screen>
  );
}

/** The chosen person: how much is back already, and the two things to do next. */
function Picked({ d, info }: { d: Debt; info: DebtInfo }) {
  const mine = d.direction === "owed_to_me";
  const c = mine ? GREEN : RED;
  const pct = Math.round(info.progress * 100);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring.smooth} className="panel mx-4 mt-6 rounded-[24px] p-4">
        <button type="button" onClick={() => nav.push("debt", { id: d.id })} className="flex w-full items-center gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-headline font-bold text-white" style={{ background: c }}>
            {d.counterparty.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-headline font-semibold">{d.counterparty}</span>
            <span className="block text-footnote text-ink-2">
              {info.paid > 0 ? tr("Вернули {0}%", pct) : tr("Ещё ничего не вернули")} · {formatMoney(info.paid, { currency: d.currency })} {tr("из")} {formatMoney(d.amount, { currency: d.currency })}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-ink-3" />
        </button>
        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <motion.div className="h-full rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={{ duration: 0.7 }} />
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              haptic();
              nav.sheet("debtPay", { debtId: d.id });
            }}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[16px] bg-[var(--ink)] text-callout font-bold text-[var(--bg)]"
          >
            <Check size={16} strokeWidth={2.6} />
            {mine ? tr("Вернули") : tr("Вернуть")}
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => remind(d, info.remaining)} className="tile flex h-12 items-center justify-center gap-1.5 rounded-[16px] text-callout font-semibold">
            <CalendarCheck size={16} />
            {tr("Напомнить")}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function DebtDetail({ id }: { id: ID }) {
  const debt = useData((s) => s.debts.find((d) => d.id === id));
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const today = useToday();
  if (!debt) {
    return (
      <Screen title={tr("Долг")}>
        <EmptyState icon={HandCoins} title={tr("Долг удалён")} />
      </Screen>
    );
  }
  const info = debtInfo(debt, transactions, today);
  const opening = transactions.find((t) => t.debtId === debt.id && t.debtRole === "open");
  const mine = debt.direction === "owed_to_me";
  const open = info.status !== "closed";

  return (
    <Screen title={debt.counterparty} actions={<button type="button" className="h-9 px-1 text-body text-accent-ink" onClick={() => nav.sheet("debt", { editId: debt.id })}>{tr("Изменить")}</button>}>
      <div className="px-4">
        <DebtCard d={debt} info={info} big />
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          <Button icon={HandCoins} onClick={() => nav.sheet("debtPay", { debtId: debt.id })}>
            {mine ? tr("Записать возврат") : tr("Записать платёж")}
          </Button>
          <Button variant="secondary" icon={CalendarCheck} onClick={() => remind(debt, info.remaining)}>
            {tr("Напомнить")}
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-5">
        <Group>
          <Row title={mine ? tr("Выдано") : tr("Получено")} value={`${formatDate(debt.date, { year: "auto" })}`} />
          <Row title={tr("Срок возврата")} value={debt.dueDate ? formatDate(debt.dueDate, { year: "auto" }) : tr("Не указан")} />
          <Row title={tr("Кошелёк")} value={opening?.walletId ? wallets.find((w) => w.id === opening.walletId)?.name ?? "—" : tr("Без движения по счёту")} />
          {debt.note && <Row title={tr("Комментарий")} value={debt.note} />}
        </Group>

        <section>
          <h2 className="section-label px-5 pb-2.5">{tr("История платежей")}</h2>
          {info.payments.length === 0 ? (
            <div className="mx-5 rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-subhead text-ink-2">{tr("Платежей ещё не было")}</div>
          ) : (
            <Group>
              {info.payments.map((p) => (
                <Row
                  key={p.id}
                  icon={Check}
                  title={formatDayHeading(dayOf(p.date))}
                  subtitle={p.walletId ? wallets.find((w) => w.id === p.walletId)?.name : tr("Без движения по счёту")}
                  value={<Money value={p.amount} currency={debt.currency} className="text-ink" />}
                  onClick={() => nav.sheet("tx", { id: p.id })}
                />
              ))}
            </Group>
          )}
        </section>

        <Group>
          <Row icon={Pencil} title={tr("Изменить")} chevron onClick={() => nav.sheet("debt", { editId: debt.id })} />
          {info.status === "closed" ? (
            <Row icon={RotateCcw} title={tr("Открыть снова")} onClick={() => useData.getState().setDebtClosed(debt.id, false)} />
          ) : (
            <Row
              icon={CircleCheck}
              title={mine ? tr("Простить остаток и закрыть") : tr("Закрыть без платежа")}
              onClick={() => undoable(tr("Долг закрыт"), () => useData.getState().setDebtClosed(debt.id, true))}
            />
          )}
          <Row
            icon={Trash2}
            iconTone="negative"
            destructive
            title={tr("Удалить долг")}
            onClick={() =>
              confirmDelete({
                title: tr("Удалить долг?"),
                message: tr("Все связанные записи будут удалены, а балансы кошельков пересчитаны."),
                onConfirm: () => {
                  nav.pop();
                  setTimeout(() => undoable(tr("Долг удалён"), () => useData.getState().deleteDebt(debt.id)), 380);
                }
              })
            }
          />
        </Group>
      </div>
    </Screen>
  );
}

export function DebtSheet({ editId, direction: d0 }: { editId?: ID; direction?: Debt["direction"] }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.debts.find((d) => d.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [direction, setDirection] = useState<Debt["direction"]>(existing?.direction ?? d0 ?? "owed_to_me");
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? "");
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount).replace(",", ".") : "");
  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [hasDue, setHasDue] = useState(!!existing?.dueDate);
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? todayKey());
  const [note, setNote] = useState(existing?.note ?? "");
  const [moveMoney, setMoveMoney] = useState(!existing);
  const [walletId, setWalletId] = useState(defaultWalletId ?? live[0]?.id ?? "");
  const value = parseAmount(amount);
  const valid = counterparty.trim().length > 0 && value > 0;

  const save = () => {
    if (!valid) return;
    const st = useData.getState();
    const currency = existing?.currency ?? (moveMoney ? wallets.find((w) => w.id === walletId)?.currency : undefined) ?? base;
    const fields = { direction, counterparty: counterparty.trim(), amount: value, currency, date, dueDate: hasDue ? dueDate : undefined, note: note.trim() || undefined };
    if (existing) {
      st.updateDebt(existing.id, fields);
      // keep the opening record in step with the new amount / date
      const opening = st.transactions.find((t) => t.debtId === existing.id && t.debtRole === "open");
      if (opening) st.updateTransaction(opening.id, { amount: value, flow: direction === "i_owe" ? "in" : "out", date: `${date}T${opening.date.slice(11, 16) || "12:00"}` });
    } else {
      st.addDebt(fields, moveMoney ? walletId : undefined);
    }
    haptic("success");
    nav.toast(existing ? tr("Долг сохранён") : tr("Долг записан"), { tone: "positive" });
    close();
  };

  return (
    <Sheet tall title={existing ? tr("Долг") : tr("Новый долг")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <div className="px-4">
          <Segmented value={direction} onChange={setDirection} options={[{ value: "owed_to_me", label: tr("Дать в долг") }, { value: "i_owe", label: tr("Взять в долг") }]} />
        </div>
        <Group>
          <FormRow label={direction === "owed_to_me" ? tr("Кому") : tr("У кого")}>
            <input autoFocus={!existing} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={tr("Имя")} maxLength={40} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={tr("Сумма")}>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label={tr("Дата")}>
            <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <Group>
          <FormRow label={tr("Срок возврата")}>
            <Toggle checked={hasDue} onChange={setHasDue} label={tr("Срок возврата")} />
          </FormRow>
          {hasDue && (
            <FormRow label={tr("Вернуть до")}>
              <input type="date" value={dueDate} min={date} onChange={(e) => e.target.value && setDueDate(e.target.value)} className={cn(inputCls, "text-right")} />
            </FormRow>
          )}
        </Group>
        {!existing && (
          <Group footer={moveMoney ? (direction === "owed_to_me" ? tr("Сумма спишется с кошелька — это не расход, а деньги, которые к вам вернутся.") : tr("Сумма поступит в кошелёк — это не доход, а деньги, которые нужно вернуть.")) : tr("Только учёт: балансы кошельков не изменятся.")}>
            <FormRow label={tr("Деньги прошли через кошелёк")}>
              <Toggle checked={moveMoney} onChange={setMoveMoney} label={tr("Деньги прошли через кошелёк")} />
            </FormRow>
            {moveMoney && (
              <FormRow label={tr("Кошелёк")}>
                <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                  {live.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </FormRow>
            )}
          </Group>
        )}
        <Group>
          <div className="px-4 py-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Комментарий")} maxLength={120} className={inputCls} />
          </div>
        </Group>
      </div>
    </Sheet>
  );
}

export function DebtPaySheet({ debtId }: { debtId: ID }) {
  const { close } = useSheet();
  const debt = useData((s) => s.debts.find((d) => d.id === debtId));
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const today = useToday();
  const live = activeWallets(wallets).filter((w) => !debt || w.currency === debt.currency);
  const info = debt ? debtInfo(debt, transactions, today) : null;
  const [amount, setAmount] = useState(info ? amountToInput(info.remaining).replace(",", ".") : "");
  const [moveMoney, setMoveMoney] = useState(true);
  const [walletId, setWalletId] = useState(live.find((w) => w.id === defaultWalletId)?.id ?? live[0]?.id ?? "");
  const [date, setDate] = useState(todayKey());
  if (!debt || !info) return null;
  const value = parseAmount(amount);
  const tooMuch = value > info.remaining;
  const mine = debt.direction === "owed_to_me";

  const save = () => {
    if (!value || tooMuch) return;
    undoable(value === info.remaining ? tr("Долг закрыт") : tr("Платёж записан"), () =>
      useData.getState().payDebt(debt.id, value, moveMoney ? walletId : undefined, date === todayKey() ? nowISO() : `${date}T12:00`)
    );
    haptic("success");
    close();
  };

  return (
    <Sheet title={mine ? tr("Возврат долга") : tr("Платёж по долгу")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!value || tooMuch} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <Group footer={tooMuch ? tr("Больше остатка ({0})", formatMoney(info.remaining, { currency: debt.currency })) : tr("Остаток: {0}", formatMoney(info.remaining, { currency: debt.currency }))}>
          <FormRow label={tr("Сумма")}>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum", tooMuch && "text-negative")} />
          </FormRow>
          <FormRow label={tr("Дата")}>
            <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <div className="scroll-x -mt-2 flex gap-2 px-4">
          {[
            { label: tr("Всё · {0}", formatMoney(info.remaining, { currency: debt.currency })), v: info.remaining },
            ...(info.remaining >= 200_000 ? [{ label: tr("Половину · {0}", formatMoney(Math.round(info.remaining / 200) * 100, { currency: debt.currency })), v: Math.round(info.remaining / 200) * 100 }] : []),
            ...(info.remaining >= 400_000 ? [{ label: tr("Четверть · {0}", formatMoney(Math.round(info.remaining / 400) * 100, { currency: debt.currency })), v: Math.round(info.remaining / 400) * 100 }] : [])
          ].map((q) => (
            <Chip key={q.label} selected={value === q.v} onClick={() => setAmount(amountToInput(q.v).replace(/\s/g, "").replace(",", "."))}>
              {q.label}
            </Chip>
          ))}
        </div>
        <Group>
          <FormRow label={mine ? tr("Зачислить в кошелёк") : tr("Списать с кошелька")}>
            <Toggle checked={moveMoney} onChange={setMoveMoney} label={tr("Через кошелёк")} />
          </FormRow>
          {moveMoney && (
            <FormRow label={tr("Кошелёк")}>
              <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                {live.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </FormRow>
          )}
        </Group>
      </div>
    </Sheet>
  );
}
