import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CircleCheck, HandCoins, Pencil, Plus, RotateCcw, Trash2 } from "../../ui/glyphs";
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
import { Avatar, Button, EmptyState, FormRow, Group, IconButton, ProgressBar, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
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

export function DebtsScreen() {
  const debts = useData((s) => s.debts);
  const transactions = useData((s) => s.transactions);
  const base = useData((s) => s.settings.baseCurrency);
  const today = useToday();
  const [tab, setTab] = useState<"active" | "closed">("active");
  const items = useMemo(() => debts.map((d) => ({ d, info: debtInfo(d, transactions, today) })), [debts, transactions, today]);
  const active = items.filter((x) => x.info.status !== "closed").sort((a, b) => (a.d.dueDate ?? "9") .localeCompare(b.d.dueDate ?? "9"));
  const closed = items.filter((x) => x.info.status === "closed");
  const owedToMe = active.filter((x) => x.d.direction === "owed_to_me" && x.d.currency === base).reduce((s, x) => s + x.info.remaining, 0);
  const iOwe = active.filter((x) => x.d.direction === "i_owe" && x.d.currency === base).reduce((s, x) => s + x.info.remaining, 0);
  const list = tab === "active" ? active : closed;

  return (
    <Screen title={tr("Долги")} large actions={<IconButton icon={Plus} label={tr("Новый долг")} onClick={() => nav.sheet("debt")} />}>
      <div className="grid grid-cols-2 gap-2 px-4">
        <div className="panel rounded-lg px-4 py-3.5">
          <div className="text-footnote font-medium text-ink-2">{tr("Вам должны")}</div>
          <Money value={owedToMe} currency={base} className="mt-0.5 block text-title-3 font-semibold text-positive" />
          <div className="text-caption text-ink-3">{pluralN(active.filter((x) => x.d.direction === "owed_to_me").length, ["человек", "человека", "человек"])}</div>
        </div>
        <div className="panel rounded-lg px-4 py-3.5">
          <div className="text-footnote font-medium text-ink-2">{tr("Вы должны")}</div>
          <Money value={iOwe} currency={base} className="mt-0.5 block text-title-3 font-semibold" />
          <div className="text-caption text-ink-3">{pluralN(active.filter((x) => x.d.direction === "i_owe").length, ["человеку", "людям", "людям"])}</div>
        </div>
      </div>

      <div className="mt-4 px-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: "active", label: tr("Активные · {0}", active.length) }, { value: "closed", label: tr("Закрытые · {0}", closed.length) }]} />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={tab === "active" ? tr("Долгов нет") : tr("Закрытых долгов пока нет")}
          text={tab === "active" ? tr("Записывайте, кому вы одолжили и у кого заняли, — приложение напомнит о сроках.") : undefined}
          action={tab === "active" ? <Button size="md" icon={Plus} onClick={() => nav.sheet("debt")}>{tr("Записать долг")}</Button> : undefined}
        />
      ) : (
        <div className="mt-4 flex flex-col gap-2.5 px-4">
          {list.map(({ d, info }, i) => {
            const due = dueText(d, info);
            return (
              <motion.button
                key={d.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.smooth, delay: i * 0.03 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => nav.push("debt", { id: d.id })}
                className="panel rounded-lg px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={d.counterparty} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-semibold">{d.counterparty}</div>
                    <div className="truncate text-footnote">
                      <span className="text-ink-2">{d.direction === "owed_to_me" ? tr("вам должны") : tr("вы должны")} · </span>
                      <span className={due.tone}>{due.text}</span>
                    </div>
                  </div>
                  <Money value={info.status === "closed" ? d.amount : info.remaining} currency={d.currency} className={cn("text-body font-semibold", info.status !== "closed" && d.direction === "owed_to_me" && "text-positive", info.status === "closed" && "text-ink-3")} />
                </div>
                {info.status !== "closed" && info.paid > 0 && (
                  <>
                    <ProgressBar value={info.progress} tone="positive" height={4} className="mt-3" />
                    <div className="mt-1.5 text-caption text-ink-3">{tr("Возвращено")}{" "}{formatMoney(info.paid, { currency: d.currency })}{" "}{tr("из")}{" "}{formatMoney(d.amount, { currency: d.currency })}
                    </div>
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </Screen>
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
  const due = dueText(debt, info);
  const opening = transactions.find((t) => t.debtId === debt.id && t.debtRole === "open");
  const mine = debt.direction === "owed_to_me";

  return (
    <Screen title={debt.counterparty} actions={<button type="button" className="h-9 px-1 text-body text-accent-ink" onClick={() => nav.sheet("debt", { editId: debt.id })}>{tr("Изменить")}</button>}>
      <div className="flex flex-col items-center px-6 pt-2 text-center">
        <Avatar name={debt.counterparty} size={64} />
        <div className="mt-3 text-callout text-ink-2">{mine ? tr("{0} — вам должны", debt.counterparty) : tr("Вы должны — {0}", debt.counterparty)}</div>
        <Money value={info.status === "closed" ? 0 : info.remaining} currency={debt.currency} variant="hero" className={cn("mt-1 text-[38px] font-semibold tracking-[-0.035em]", mine && info.status !== "closed" && "text-positive")} />
        <div className={cn("mt-1 text-footnote font-medium", due.tone)}>{due.text}</div>
      </div>
      <div className="mt-5 px-5">
        <ProgressBar value={info.progress} tone="positive" />
        <div className="mt-2 flex justify-between text-footnote text-ink-2">
          <span>{tr("Возвращено")}{" "}{formatMoney(info.paid, { currency: debt.currency })}</span>
          <span>{tr("из")}{" "}{formatMoney(debt.amount, { currency: debt.currency })}</span>
        </div>
      </div>

      {info.status !== "closed" && (
        <div className="mt-5 px-5">
          <Button block icon={HandCoins} onClick={() => nav.sheet("debtPay", { debtId: debt.id })}>
            {mine ? tr("Записать возврат") : tr("Записать платёж")}
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

export function DebtSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.debts.find((d) => d.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [direction, setDirection] = useState<Debt["direction"]>(existing?.direction ?? "owed_to_me");
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
