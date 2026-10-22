import { useMemo } from "react";
import { CalendarDays, FlaskConical, Gauge, HandCoins, ListTodo, NotebookPen, Repeat, Search, Settings, Shapes, Target } from "lucide-react";
import { budgetStates } from "../../lib/insights";
import { debtInfo, goalInfo, goalSaved } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { monthlyEquivalent } from "../../lib/recurrence";
import { pluralN } from "../../lib/dates";
import { useAppData, useBalances, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Button, Group, Row } from "../../ui/primitives";

export function MoreScreen() {
  const data = useAppData();
  const { entries } = useLedger();
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();
  const demo = useData((s) => s.meta.demo);

  const s = useMemo(() => {
    const goals = data.goals.filter((g) => !g.archived);
    const goalProgress = goals.length ? goals.reduce((acc, g) => acc + goalInfo(g, goalSaved(g, env, balances), today).progress, 0) / goals.length : 0;
    const budgets = budgetStates(data, entries, today);
    const over = budgets.filter((b) => b.level === "over").length;
    const near = budgets.filter((b) => b.level === "near").length;
    const subs = data.recurring.filter((r) => r.active && r.kind === "expense");
    const monthly = subs.reduce((acc, r) => acc + monthlyEquivalent(r), 0);
    const debts = data.debts.map((d) => ({ d, info: debtInfo(d, data.transactions, today) })).filter((x) => x.info.status !== "closed");
    const owedToMe = debts.filter((x) => x.d.direction === "owed_to_me").reduce((a, x) => a + x.info.remaining, 0);
    const iOwe = debts.filter((x) => x.d.direction === "i_owe").reduce((a, x) => a + x.info.remaining, 0);
    const tasks = data.tasks.filter((t) => !t.done);
    const overdueTasks = tasks.filter((t) => t.due && t.due < today).length;
    const plans = data.plans.filter((p) => p.status === "planned" && p.date >= today).length;
    return { goals: goals.length, goalProgress, budgets: budgets.length, over, near, monthly, subs: subs.length, owedToMe, iOwe, debtCount: debts.length, tasks: tasks.length, overdueTasks, notes: data.notes.length, plans };
  }, [data, entries, balances, env, today]);

  return (
    <Screen title="Ещё" large>
      <div className="px-4">
        <button type="button" onClick={() => nav.sheet("search")} className="flex h-10 w-full items-center gap-2 rounded-sm tile px-3 text-left text-body text-ink-3">
          <Search size={17} />
          Поиск по всему приложению
        </button>
      </div>

      {demo && (
        <div className="mx-4 mt-4 rounded-lg border border-line-strong px-4 py-3.5">
          <div className="flex items-center gap-2 text-subhead font-semibold">
            <FlaskConical size={16} className="text-accent-ink" />
            Демонстрационные данные
          </div>
          <p className="mt-1 text-footnote text-ink-2">Всё уже работает — попробуйте. Когда будете готовы, начните с чистого листа.</p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => nav.push("data")}>
            Начать со своих данных
          </Button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <Group header="Планирование">
          <Row icon={Target} title="Цели" subtitle={s.goals ? `${pluralN(s.goals, ["цель", "цели", "целей"])} · в среднем ${Math.round(s.goalProgress * 100)}%` : "Квартира, отпуск, подушка"} chevron onClick={() => nav.push("goals")} />
          <Row
            icon={Gauge}
            iconTone={s.over ? "negative" : s.near ? "warning" : undefined}
            title="Бюджеты"
            subtitle={s.budgets ? (s.over ? `${s.over} превышен${s.over > 1 ? "о" : ""}` : s.near ? `${s.near} близко к лимиту` : "Всё в пределах лимитов") : "Лимиты по категориям"}
            chevron
            onClick={() => nav.push("budgets")}
          />
          <Row icon={CalendarDays} title="Планы и календарь" subtitle={s.plans ? `${pluralN(s.plans, ["запланированная операция", "запланированные операции", "запланированных операций"])}` : "Крупные покупки и прогноз"} chevron onClick={() => nav.push("plans")} />
          <Row icon={Repeat} title="Подписки и платежи" subtitle={s.subs ? `${formatMoney(s.monthly)} в месяц` : "Регулярные списания"} chevron onClick={() => nav.push("subscriptions")} />
        </Group>

        <Group header="Учёт">
          <Row
            icon={HandCoins}
            title="Долги"
            subtitle={s.debtCount ? [s.owedToMe ? `вам ${formatMoney(s.owedToMe)}` : "", s.iOwe ? `вы ${formatMoney(s.iOwe)}` : ""].filter(Boolean).join(" · ") : "Кто кому и сколько"}
            chevron
            onClick={() => nav.push("debts")}
          />
          <Row icon={ListTodo} iconTone={s.overdueTasks ? "warning" : undefined} title="Задачи" subtitle={s.tasks ? `${pluralN(s.tasks, ["активная", "активные", "активных"])}${s.overdueTasks ? ` · ${s.overdueTasks} просрочено` : ""}` : "Финансовые дела"} chevron onClick={() => nav.push("tasks")} />
          <Row icon={NotebookPen} title="Заметки" subtitle={s.notes ? pluralN(s.notes, ["заметка", "заметки", "заметок"]) : "Мысли о деньгах"} chevron onClick={() => nav.push("notes")} />
        </Group>

        <Group>
          <Row icon={Shapes} title="Категории" chevron onClick={() => nav.push("categories")} />
          <Row icon={Settings} title="Настройки" chevron onClick={() => nav.push("settings")} />
        </Group>
      </div>
    </Screen>
  );
}
