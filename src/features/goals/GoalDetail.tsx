import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Star, Target, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDayHeading, pluralN } from "../../lib/dates";
import { goalPace, goalStatus, goalStatusText } from "../../lib/goals";
import { goalInfo, goalSaved } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { useAppData, useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { Button, EmptyState, Group, IconChip, ProgressRing, Row } from "../../ui/primitives";

export function GoalDetail({ id }: { id: ID }) {
  const goal = useData((s) => s.goals.find((g) => g.id === id));
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const data = useAppData();
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();

  const history = useMemo(
    () => transactions.filter((t) => t.goalId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, id]
  );

  const pace = useMemo(() => (goal ? goalPace(goal, data, balances, today) : 0), [goal, data, balances, today]);
  const [allHistory, setAllHistory] = useState(false);

  if (!goal) {
    return (
      <Screen title="Цель">
        <EmptyState icon={Target} title="Цель удалена" />
      </Screen>
    );
  }

  const info = goalInfo(goal, goalSaved(goal, env, balances), today);
  const linked = goal.walletId ? wallets.find((w) => w.id === goal.walletId) : undefined;
  const status = goalStatus(goal, info, pace, today);
  const st = goalStatusText(status, goal.currency);
  const shown = allHistory ? history : history.slice(0, 5);

  return (
    <Screen title={goal.name} actions={<button type="button" className="h-9 px-1 text-body text-accent-ink" onClick={() => nav.sheet("goal", { editId: goal.id })}>Изменить</button>}>
      <div className="flex flex-col items-center px-6 pt-2 text-center">
        <ProgressRing value={info.progress} size={188} stroke={10} tone={info.done ? "positive" : "accent"}>
          <div className="flex flex-col items-center">
            <NamedIcon name={goal.icon} size={22} strokeWidth={1.9} className="text-ink-2" />
            <div className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em] tnum">{Math.floor(info.progress * 100)}%</div>
          </div>
        </ProgressRing>
        <div className="mt-4 text-title-2 font-semibold">{goal.name}</div>
        <div className="mt-1 text-callout text-ink-2">
          <Money value={info.saved} currency={goal.currency} privacy className="font-semibold text-ink" /> из <Money value={goal.target} currency={goal.currency} />
        </div>
        <div className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-footnote font-semibold", st.tone === "positive" ? "bg-positive-soft text-positive" : st.tone === "warning" ? "bg-warning-soft text-warning" : "tile text-ink-2")}>
          {st.text}
        </div>
      </div>

      {!info.done && (
        <div className="mt-6 grid grid-cols-2 gap-2.5 px-5">
          <Button icon={ArrowDownToLine} onClick={() => nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" })}>
            Пополнить
          </Button>
          <Button variant="secondary" icon={ArrowUpFromLine} disabled={info.saved <= 0} onClick={() => nav.sheet("goalMoney", { goalId: goal.id, direction: "withdraw" })}>
            Снять
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-5">
        <Group footer={linked ? `Прогресс равен балансу кошелька «${linked.name}». Пополнение — это перевод на него.` : "У цели свой баланс: пополнения переносят деньги из кошелька, а снятие возвращает их обратно."}>
          {!info.done && <Row title="Осталось накопить" value={<Money value={info.remaining} currency={goal.currency} />} />}
          <Row title="Срок" value={goal.deadline ? `${formatDate(goal.deadline, { year: "always" })}${info.monthsLeft !== null && info.monthsLeft > 0 ? ` · ${pluralN(Math.max(1, Math.round(info.monthsLeft)), ["месяц", "месяца", "месяцев"])}` : ""}` : "Без срока"} />
          {info.monthly !== null && !info.done && <Row title="Откладывать в месяц" value={<span className="font-semibold text-ink">{formatMoney(info.monthly, { currency: goal.currency })}</span>} />}
          {!info.done && <Row title="Темп за 3 месяца" value={pace > 0 ? `${formatMoney(Math.round(pace / 100) * 100, { currency: goal.currency })} в месяц` : "нет пополнений"} />}
          {linked && <Row title="Кошелёк" value={linked.name} chevron onClick={() => nav.push("wallet", { id: linked.id })} />}
        </Group>

        <section>
          <h2 className="section-label px-5 pb-2.5">История</h2>
          {history.length === 0 ? (
            <div className="mx-5 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-subhead text-ink-2">Пополнений пока не было</div>
          ) : (
            <Group>
              {shown.map((t) => {
                const deposit = t.kind === "transfer" ? t.toWalletId === goal.walletId : t.flow === "out";
                const w = wallets.find((x) => x.id === (t.kind === "transfer" ? (deposit ? t.walletId : t.toWalletId) : t.walletId));
                return (
                  <Row
                    key={t.id}
                    leading={<IconChip icon={deposit ? ArrowDownToLine : ArrowUpFromLine} size={34} />}
                    title={deposit ? "Пополнение" : "Снятие"}
                    subtitle={`${formatDayHeading(dayOf(t.date))}${w ? ` · ${deposit ? "из" : "в"} «${w.name}»` : ""}`}
                    value={<Money value={deposit ? t.amount : -t.amount} sign="always" tone={deposit ? "positive" : "default"} currency={goal.currency} />}
                    onClick={() => nav.sheet("tx", { id: t.id })}
                  />
                );
              })}
              {history.length > 5 && (
                <button type="button" onClick={() => setAllHistory((v) => !v)} className="w-full py-3 text-center text-subhead font-medium text-accent-ink active:opacity-60">
                  {allHistory ? "Свернуть" : `Показать все · ${history.length}`}
                </button>
              )}
            </Group>
          )}
        </section>

        <Group>
          <Row icon={Pencil} title="Изменить цель" chevron onClick={() => nav.sheet("goal", { editId: goal.id })} />
          <Row icon={Star} title={goal.primary ? "Убрать с главного экрана" : "Показывать на главном экране"} onClick={() => useData.getState().setPrimaryGoal(goal.id)} />
          <Row
            icon={Trash2}
            iconTone="negative"
            title="Удалить цель"
            destructive
            onClick={() =>
              confirmDelete({
                title: `Удалить «${goal.name}»?`,
                message: linked ? "Кошелёк и его деньги останутся без изменений." : info.saved > 0 ? `Накопленные ${formatMoney(info.saved, { currency: goal.currency })} вернутся в кошельки, из которых их переводили.` : undefined,
                onConfirm: () => {
                  nav.pop();
                  setTimeout(() => undoable("Цель удалена", () => useData.getState().deleteGoal(goal.id)), 380);
                }
              })
            }
          />
        </Group>
      </div>
    </Screen>
  );
}
