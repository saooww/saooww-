import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, ChevronDown, CircleCheck, HandCoins, Plus, RotateCcw, Trash2 } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { formatDate, nowISO, pluralN, todayKey } from "../../lib/dates";
import { activeWallets } from "../../lib/finance";
import { debtHistory, debtPeople, personKey, splitRepayment, type DebtPerson } from "../../lib/debts";
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

const GREEN = "#2e9d72";
const RED = "#df0714";

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

const personColor = (p: DebtPerson) => (p.closed ? "#5b5f66" : p.net < 0 ? RED : GREEN);

function PersonAvatar({ p, size = 46 }: { p: DebtPerson; size?: number }) {
  const c = personColor(p);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4, color: c, background: `color-mix(in srgb, ${c} 15%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 34%, transparent)` }}
    >
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function dueLabel(p: DebtPerson): { text: string; tone: string } | null {
  if (p.closed || p.daysToDue === null || !p.nextDue) return null;
  if (p.daysToDue < 0) return { text: tr("Просрочен на {0}", pluralN(-p.daysToDue, ["день", "дня", "дней"])), tone: "text-negative" };
  if (p.daysToDue === 0) return { text: tr("Срок сегодня"), tone: "text-warning" };
  if (p.daysToDue <= 3) return { text: tr("Через {0}", pluralN(p.daysToDue, ["день", "дня", "дней"])), tone: "text-warning" };
  return { text: tr("до {0}", formatDate(p.nextDue)), tone: "text-ink-2" };
}

/** The people: one card each, however many loans lie behind it. */
export function DebtsScreen() {
  const debts = useData((s) => s.debts);
  const transactions = useData((s) => s.transactions);
  const base = useData((s) => s.settings.baseCurrency);
  const today = useToday();
  const [showClosed, setShowClosed] = useState(false);
  const people = useMemo(() => debtPeople(debts, transactions, today), [debts, transactions, today]);
  const open = people.filter((p) => !p.closed).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const closed = people.filter((p) => p.closed);
  const inBase = open.filter((p) => p.currency === base);
  const owedToMe = inBase.reduce((s, p) => s + p.toMe, 0);
  const iOwe = inBase.reduce((s, p) => s + p.fromMe, 0);
  const toMeCount = open.filter((p) => p.net > 0).length;
  const fromMeCount = open.filter((p) => p.net < 0).length;

  return (
    <Screen title={tr("Долги")} large actions={<IconButton icon={Plus} label={tr("Новый долг")} onClick={() => nav.sheet("debt")} />}>
      {open.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tr("Долгов нет")}
          text={tr("Записывайте, кому вы одолжили и у кого заняли, — приложение напомнит о сроках.")}
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("debt")}>{tr("Записать долг")}</Button>}
        />
      ) : (
        <>
          <section className="panel relative mx-4 overflow-hidden rounded-[22px]" aria-label={tr("Долги")}>
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 120% at 0% 0%, color-mix(in srgb, var(--positive) 13%, transparent), transparent 60%), radial-gradient(70% 120% at 100% 0%, color-mix(in srgb, var(--negative) 12%, transparent), transparent 60%)" }} />
            <div className="relative grid grid-cols-2">
              <div className="p-4">
                <div className="flex items-center gap-1.5 text-footnote text-ink-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                  {tr("Вам должны")}
                </div>
                <Money value={owedToMe} currency={base} privacy variant="hero" className="mt-1.5 block text-[26px] leading-none text-positive" />
                <div className="mt-1.5 text-caption text-ink-3">{pluralN(toMeCount, ["человек", "человека", "человек"])}</div>
              </div>
              <div className="hairline-l p-4">
                <div className="flex items-center gap-1.5 text-footnote text-ink-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-negative" />
                  {tr("Вы должны")}
                </div>
                <Money value={iOwe} currency={base} privacy variant="hero" className="mt-1.5 block text-[26px] leading-none text-negative" />
                <div className="mt-1.5 text-caption text-ink-3">{pluralN(fromMeCount, ["человеку", "людям", "людям"])}</div>
              </div>
            </div>
            {owedToMe + iOwe > 0 && (
              <div className="relative flex h-[3px] gap-[2px] px-4 pb-0 pt-0" aria-hidden>
                <div className="h-full rounded-full bg-positive" style={{ flex: Math.max(owedToMe, 1) }} />
                <div className="h-full rounded-full bg-negative" style={{ flex: Math.max(iOwe, 1) }} />
              </div>
            )}
          </section>

          <div className="flex items-baseline justify-between px-5 pb-2.5 pt-6">
            <h2 className="text-title-3 font-semibold">{tr("Люди")}</h2>
            <span className="text-footnote text-ink-3">{tr("по сумме")}</span>
          </div>
          <div className="flex flex-col gap-2.5 px-4">
            {open.map((p, i) => (
              <PersonRow key={p.key} p={p} delay={i * 0.04} />
            ))}
          </div>
        </>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        <Button variant="secondary" size="md" icon={ArrowUpRight} onClick={() => nav.sheet("debt", { direction: "owed_to_me" })}>{tr("Дал в долг")}</Button>
        <Button variant="secondary" size="md" icon={ArrowDownLeft} onClick={() => nav.sheet("debt", { direction: "i_owe" })}>{tr("Взял в долг")}</Button>
      </div>

      {closed.length > 0 && (
        <div className="mt-7">
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="flex w-full items-center gap-2 px-5 py-2 text-subhead font-medium text-ink-2">
            <CircleCheck size={16} />
            {tr("Закрытые · {0}", closed.length)}
            <ChevronDown size={16} className={cn("transition-transform", showClosed && "rotate-180")} />
          </button>
          {showClosed && (
            <div className="mt-1 flex flex-col gap-2.5 px-4">
              {closed.map((p) => (
                <PersonRow key={p.key} p={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}

function PersonRow({ p, delay = 0 }: { p: DebtPerson; delay?: number }) {
  const due = dueLabel(p);
  const mine = p.net >= 0;
  const c = personColor(p);
  return (
    <motion.button
      type="button"
      aria-label={`${p.name}: ${p.closed ? tr("долг закрыт") : `${mine ? "+" : "−"}${formatMoney(Math.abs(p.net), { currency: p.currency })}`}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay }}
      whileTap={{ scale: 0.985 }}
      onClick={() => nav.push("debt", { id: p.debts[p.debts.length - 1].debt.id })}
      className="panel rounded-[20px] p-3.5 text-left"
    >
      <div className="flex items-center gap-3">
        <PersonAvatar p={p} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-headline font-semibold">{p.name}</div>
          <div className="truncate text-footnote text-ink-2">
            {p.closed ? tr("закрыт") : pluralN(p.debts.length, ["долг", "долга", "долгов"])} {due && <span className={due.tone}>· {due.text}</span>}
          </div>
        </div>
        <div className="text-right">
          <Money value={p.closed ? 0 : p.net} currency={p.currency} sign={p.closed ? "never" : "always"} privacy className={cn("text-callout font-bold", p.closed ? "text-ink-3" : mine ? "text-positive" : "text-negative")} />
          <div className="text-caption text-ink-3">{tr("осталось")}</div>
        </div>
      </div>
      <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(p.progress > 0 ? 3 : 0, p.progress * 100)}%`, background: c }} />
      </div>
      <div className="mt-1.5 flex justify-between text-caption text-ink-3">
        <span>
          {p.closed ? tr("Вернули всё {0}", formatMoney(p.total, { currency: p.currency })) : tr("Вернули {0} из {1}", formatMoney(p.paid, { currency: p.currency }), formatMoney(p.total, { currency: p.currency }))}
        </span>
      </div>
    </motion.button>
  );
}

/** One person in full: what is left, the loans behind it, and every part returned — when, and through which account. */
export function DebtDetail({ id }: { id: ID }) {
  const debts = useData((s) => s.debts);
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const today = useToday();
  const person = useMemo(() => {
    const d = debts.find((x) => x.id === id);
    if (!d) return undefined;
    const key = personKey(d.counterparty, d.currency);
    return debtPeople(debts, transactions, today).find((p) => p.key === key);
  }, [debts, transactions, today, id]);

  if (!person) {
    return (
      <Screen title={tr("Долг")}>
        <EmptyState icon={HandCoins} title={tr("Долг удалён")} />
      </Screen>
    );
  }
  const p = person;
  const dir: Debt["direction"] = p.fromMe > p.toMe ? "i_owe" : "owed_to_me";
  const remaining = dir === "owed_to_me" ? p.toMe : p.fromMe;
  const history = debtHistory(p, transactions, wallets);
  const c = personColor(p);
  const mine = p.net >= 0;
  const openLoans = p.debts.filter((x) => x.info.status !== "closed");
  const nextLoan = openLoans.find((x) => x.debt.direction === dir) ?? openLoans[0];
  const due = dueLabel(p);

  return (
    <Screen title={p.name} actions={<button type="button" className="h-9 px-1 text-body text-accent-ink" onClick={() => nav.sheet("debt", { direction: dir, counterparty: p.name })}>{tr("Ещё займ")}</button>}>
      <div className="flex flex-col items-center px-6 pt-1 text-center">
        <PersonAvatar p={p} size={84} />
        <div className="mt-3 text-callout text-ink-2">{p.closed ? tr("Всё возвращено") : mine ? tr("Вам должны") : tr("Вы должны")}</div>
        <Money value={p.closed ? 0 : Math.abs(p.net)} currency={p.currency} privacy variant="hero" className={cn("mt-1 text-[42px] leading-none", p.closed ? "text-ink-3" : mine ? "text-positive" : "text-negative")} />
        <div className="mt-1.5 text-footnote text-ink-2">
          {tr("вернули {0} из {1}", formatMoney(p.paid, { currency: p.currency }), formatMoney(p.total, { currency: p.currency }))}
          {due && <span className={due.tone}> · {due.text}</span>}
        </div>
      </div>
      <div className="mt-4 px-5">
        <div className="h-[10px] overflow-hidden rounded-full bg-[var(--line)]">
          <motion.div className="h-full rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} initial={{ width: 0 }} animate={{ width: `${Math.max(p.progress > 0 ? 3 : 0, p.progress * 100)}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      </div>

      {!p.closed && (
        <div className="mt-4 grid grid-cols-2 gap-2 px-4">
          <Button icon={HandCoins} onClick={() => nav.sheet("debtPay", { personKey: p.key, direction: dir })}>
            {dir === "owed_to_me" ? tr("Вернул часть") : tr("Вернуть часть")}
          </Button>
          <Button variant="secondary" icon={CalendarCheck} onClick={() => nextLoan && remind(nextLoan.debt, remaining)}>
            {tr("Напомнить")}
          </Button>
        </div>
      )}

      <section className="mt-7">
        <h2 className="px-5 pb-2.5 text-title-3 font-semibold">{tr("История")}</h2>
        <div className="relative mx-4 pl-7">
          <div className="absolute bottom-3 left-[7px] top-3 w-[2px] rounded-full" style={{ background: "linear-gradient(var(--positive), var(--line))" }} />
          {history.map((e) => {
            const back = e.kind === "payment";
            const loan = p.debts.find((x) => x.debt.id === e.debtId)?.debt;
            const title =
              e.kind === "open"
                ? loan?.direction === "owed_to_me"
                  ? tr("Дал в долг")
                  : tr("Взял в долг")
                : loan?.direction === "owed_to_me"
                  ? tr("Вернул часть")
                  : tr("Вы вернули часть");
            return (
              <div key={e.id} className="relative mb-2.5">
                <span className="absolute -left-7 top-[18px] h-[14px] w-[14px] rounded-full" style={{ background: back ? "var(--positive)" : "var(--accent)", boxShadow: "0 0 0 4px var(--bg)" }} />
                <button type="button" disabled={!e.txId} onClick={() => e.txId && nav.sheet("tx", { id: e.txId })} className="panel flex w-full items-center gap-3 rounded-[18px] px-3.5 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-semibold">{title}{e.kind === "open" && loan?.note ? ` · ${loan.note}` : ""}</span>
                    <span className="block truncate text-caption text-ink-2">
                      {formatDate(e.day, { year: "auto" })} · {e.walletName ? (back ? (loan?.direction === "owed_to_me" ? tr("на «{0}»", e.walletName) : tr("с «{0}»", e.walletName)) : (loan?.direction === "owed_to_me" ? tr("с «{0}»", e.walletName) : tr("на «{0}»", e.walletName))) : tr("без движения по счёту")}
                    </span>
                  </span>
                  <Money value={e.signed} currency={p.currency} sign="always" privacy tone={e.signed > 0 ? "positive" : "default"} className="text-callout font-semibold" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="px-5 pb-2.5 text-title-3 font-semibold">{pluralN(p.debts.length, ["Займ", "Займа", "Займов"])}</h2>
        <Group>
          {p.debts.map(({ debt: d, info }) => (
            <Row
              key={d.id}
              title={`${d.direction === "owed_to_me" ? tr("Дал") : tr("Взял")} ${formatMoney(d.amount, { currency: d.currency })}${d.note ? ` · ${d.note}` : ""}`}
              subtitle={`${formatDate(d.date, { year: "auto" })}${d.dueDate ? ` · ${tr("до {0}", formatDate(d.dueDate, { year: "auto" }))}` : ""}`}
              value={info.status === "closed" ? <span className="text-ink-3">{tr("закрыт")}</span> : <Money value={info.remaining} currency={d.currency} className="font-semibold text-ink" />}
              chevron
              onClick={() => nav.sheet("debt", { editId: d.id })}
            />
          ))}
        </Group>
      </section>

      <div className="mt-5">
        <Group>
          {p.closed ? (
            <Row icon={RotateCcw} title={tr("Открыть снова")} onClick={() => p.debts.forEach(({ debt }) => useData.getState().setDebtClosed(debt.id, false))} />
          ) : (
            <Row
              icon={CircleCheck}
              title={mine ? tr("Простить остаток и закрыть") : tr("Закрыть без платежа")}
              onClick={() => undoable(tr("Долг закрыт"), () => openLoans.forEach(({ debt }) => useData.getState().setDebtClosed(debt.id, true)))}
            />
          )}
        </Group>
      </div>
    </Screen>
  );
}

export function DebtSheet({ editId, direction: d0, counterparty: c0 }: { editId?: ID; direction?: Debt["direction"]; counterparty?: string }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.debts.find((d) => d.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [direction, setDirection] = useState<Debt["direction"]>(existing?.direction ?? d0 ?? "owed_to_me");
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? c0 ?? "");
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
        {existing && (
          <Group>
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
                    close();
                    setTimeout(() => undoable(tr("Долг удалён"), () => useData.getState().deleteDebt(existing.id)), 300);
                  }
                })
              }
            />
          </Group>
        )}
      </div>
    </Sheet>
  );
}

/** Part of a repayment from one person: the sum goes to the oldest loans first; when and through which account is up to you. */
export function DebtPaySheet({ personKey: key, direction }: { personKey: string; direction: Debt["direction"] }) {
  const { close } = useSheet();
  const debts = useData((s) => s.debts);
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const today = useToday();
  const person = useMemo(() => debtPeople(debts, transactions, today).find((p) => p.key === key), [debts, transactions, today, key]);
  const live = activeWallets(wallets).filter((w) => !person || w.currency === person.currency);
  const remaining = person ? (direction === "owed_to_me" ? person.toMe : person.fromMe) : 0;
  const [amount, setAmount] = useState(remaining ? amountToInput(remaining).replace(/\s/g, "").replace(",", ".") : "");
  const [moveMoney, setMoveMoney] = useState(true);
  const [walletId, setWalletId] = useState(live.find((w) => w.id === defaultWalletId)?.id ?? live[0]?.id ?? "");
  const [date, setDate] = useState(todayKey());
  if (!person) return null;
  const value = parseAmount(amount);
  const tooMuch = value > remaining;
  const mine = direction === "owed_to_me";
  const { parts } = splitRepayment(person, direction, Math.min(value, remaining));
  const fmt = (v: number) => formatMoney(v, { currency: person.currency });

  const save = () => {
    if (!value || tooMuch) return;
    undoable(value === remaining ? tr("Долг закрыт") : tr("Платёж записан"), () => {
      for (const part of parts) useData.getState().payDebt(part.debtId, part.amount, moveMoney ? walletId : undefined, date === todayKey() ? nowISO() : `${date}T12:00`);
    });
    haptic("success");
    close();
  };

  return (
    <Sheet title={mine ? tr("{0} вернул часть", person.name) : tr("Платёж: {0}", person.name)} ariaLabel={mine ? tr("Возврат долга") : tr("Платёж по долгу")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!value || tooMuch} onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-4 pt-1">
        <Group footer={tooMuch ? tr("Больше остатка ({0})", fmt(remaining)) : tr("Остаток: {0}", fmt(remaining))}>
          <FormRow label={tr("Сумма")}>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum", tooMuch && "text-negative")} />
          </FormRow>
          <FormRow label={tr("Когда")}>
            <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <div className="scroll-x -mt-2 flex gap-2 px-4">
          {[
            { label: tr("Всё · {0}", fmt(remaining)), v: remaining },
            ...(remaining >= 200_000 ? [{ label: tr("Половину · {0}", fmt(Math.round(remaining / 200) * 100)), v: Math.round(remaining / 200) * 100 }] : []),
            ...(remaining >= 400_000 ? [{ label: tr("Четверть · {0}", fmt(Math.round(remaining / 400) * 100)), v: Math.round(remaining / 400) * 100 }] : [])
          ].map((q) => (
            <Chip key={q.label} selected={value === q.v} onClick={() => setAmount(amountToInput(q.v).replace(/\s/g, "").replace(",", "."))}>
              {q.label}
            </Chip>
          ))}
        </div>
        <Group footer={moveMoney ? (mine ? tr("Деньги придут на выбранный счёт — наличные это или карта.") : tr("Деньги спишутся с выбранного счёта.")) : tr("Только учёт: балансы кошельков не изменятся.")}>
          <FormRow label={mine ? tr("Куда пришли деньги") : tr("Откуда вернули")}>
            <Toggle checked={moveMoney} onChange={setMoveMoney} label={tr("Через кошелёк")} />
          </FormRow>
          {moveMoney && (
            <FormRow label={tr("Счёт")}>
              <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                {live.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </FormRow>
          )}
        </Group>
        {parts.length > 1 && (
          <p className="px-6 text-center text-footnote text-ink-3">
            {tr("Распределится по займам: {0}", parts.map((x) => fmt(x.amount)).join(" + "))}
          </p>
        )}
      </div>
    </Sheet>
  );
}
