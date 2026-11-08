import { useMemo } from "react";
import { CalendarCheck, CircleCheckBig, ReceiptText } from "../../ui/glyphs";
import { capitalize, dayOf, startOfWeek } from "../../lib/dates";
import { safeToSpend } from "../../lib/safeToSpend";
import { dayPlan } from "../../lib/tasks";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Money } from "../../ui/Money";
import { Button, Group, ProgressBar } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { TxRow, usePresentCtx } from "../transactions/TxRow";
import { useLingering } from "../planner/actions";

/** Behind the day sphere: today's money and tasks in plain numbers. */
export function DaySheet() {
  const { close } = useSheet();
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const transactions = useData((s) => s.transactions);
  const keep = useLingering();
  const ctx = usePresentCtx();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  const plan = useMemo(() => dayPlan(tasks, today, keep), [tasks, today, keep]);
  const todays = useMemo(() => transactions.filter((t) => dayOf(t.date) === today && (t.kind === "expense" || t.kind === "income")).sort((a, b) => (a.date < b.date ? 1 : -1)), [transactions, today]);
  const title = capitalize(new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));

  const go = (fn: () => void) => {
    close();
    window.setTimeout(fn, 120);
  };

  return (
    <Sheet title="Ваш день" ariaLabel="Ваш день" tall>
      <div className="px-5 pb-4 text-center text-subhead text-ink-2">{title}</div>

      {s && s.allowance > 0 && (
        <Group header="Деньги">
          <div className="grid grid-cols-3 gap-2 p-3">
            <Stat label={s.today < 0 ? "Сверх нормы" : "Можно ещё"}>
              <Money value={Math.abs(s.today)} currency={base} tone={s.today < 0 ? "negative" : "default"} privacy />
            </Stat>
            <Stat label="Потрачено">
              <Money value={s.spentToday} currency={base} privacy />
            </Stat>
            <Stat label="Норма">
              <Money value={s.allowance} currency={base} privacy />
            </Stat>
          </div>
          <div className="px-4 pb-4">
            <ProgressBar value={s.allowance ? Math.min(1, s.spentToday / s.allowance) : 0} tone={s.today < 0 ? "negative" : "ink"} />
            <div className="mt-2 text-footnote text-ink-2">
              {s.daysLeft === 1 ? "Последний день месяца" : `До конца месяца ${s.daysLeft} дн.`} · норма пересчитывается каждое утро
            </div>
          </div>
        </Group>
      )}

      {todays.length > 0 && (
        <div className="mt-4">
          <Group header="Операции сегодня">
            {todays.slice(0, 6).map((tx) => (
              <TxRow key={tx.id} tx={tx} ctx={ctx} onOpen={(t) => go(() => nav.sheet("tx", { id: t.id }))} />
            ))}
          </Group>
        </div>
      )}

      <div className="mt-4">
        <Group header="Дела">
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-title-3 font-semibold tnum">
                {plan.completed}
                <span className="text-subhead font-normal text-ink-3"> из {plan.total}</span>
              </span>
              <span className="text-footnote text-ink-2">{plan.total === 0 ? "на сегодня ничего" : plan.completed === plan.total ? "всё сделано" : `осталось ${plan.total - plan.completed}`}</span>
            </div>
            <ProgressBar value={plan.total ? plan.completed / plan.total : 0} tone={plan.total && plan.completed === plan.total ? "positive" : "ink"} className="mt-3" />
          </div>
        </Group>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 px-4">
        <Button variant="secondary" icon={CircleCheckBig} onClick={() => go(() => nav.planner("today"))}>
          Открыть дела
        </Button>
        <Button variant="secondary" icon={ReceiptText} onClick={() => go(() => nav.tab("transactions"))}>
          Все операции
        </Button>
        <Button variant="secondary" icon={CalendarCheck} onClick={() => go(() => nav.sheet("weekReview", { from: startOfWeek(today) }))}>
          Итоги недели
        </Button>
      </div>
    </Sheet>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tile rounded-[14px] px-3 py-2.5">
      <div className="text-caption text-ink-2">{label}</div>
      <div className="mt-0.5 truncate text-subhead font-semibold tnum text-ink">{children}</div>
    </div>
  );
}
