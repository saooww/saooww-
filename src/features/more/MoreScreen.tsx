import { useMemo } from "react";
import { CalendarDays, Palette, FlaskConical, Gauge, HandCoins, Repeat, Search, Settings, Shapes, Target } from "../../ui/glyphs";
import { budgetStates } from "../../lib/insights";
import { debtInfo, goalInfo, goalSaved } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { monthlyEquivalent } from "../../lib/recurrence";
import { MONTHS_GEN, parseDay, pluralN } from "../../lib/dates";
import { useAppData, useBalances, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Avatar, Button, Group, IconButton, Row } from "../../ui/primitives";
import { getLang, locale, tr } from "../../i18n/i18n";

export function MoreScreen() {
  const data = useAppData();
  const { entries } = useLedger();
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();
  const demo = useData((s) => s.meta.demo);
  const name = useData((s) => s.settings.name);
  const createdAt = useData((s) => s.meta.createdAt);
  const since = !createdAt ? "" : getLang() === "ru" ? `${MONTHS_GEN[parseDay(createdAt.slice(0, 10)).getMonth()]} ${createdAt.slice(0, 4)}` : new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(parseDay(createdAt.slice(0, 10)));

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
    const plans = data.plans.filter((p) => p.status === "planned" && p.date >= today).length;
    return { goals: goals.length, goalProgress, budgets: budgets.length, over, near, monthly, subs: subs.length, owedToMe, iOwe, debtCount: debts.length, plans };
  }, [data, entries, balances, env, today]);

  return (
    <Screen title={tr("Профиль")} large actions={<IconButton icon={Search} label={tr("Поиск")} onClick={() => nav.sheet("search")} />}>
      {/* who you are, and the way into the app's look and settings */}
      <button type="button" onClick={() => nav.push("settings")} className="panel mx-4 flex w-[calc(100%-32px)] items-center gap-4 rounded-[24px] p-4 text-left active:opacity-80">
        <Avatar name={name || tr("Я")} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-title-3 font-semibold text-ink">{name || tr("Ваш профиль")}</span>
          <span className="block text-footnote text-ink-2">{since ? tr("В Ardessa с {0}", since) : tr("Имя, оформление, данные")}</span>
        </span>
        <Settings size={20} className="shrink-0 text-ink-3" />
      </button>

      {demo && (
        <div className="mx-4 mt-4 rounded-lg border border-line-strong px-4 py-3.5">
          <div className="flex items-center gap-2 text-subhead font-semibold">
            <FlaskConical size={16} className="text-accent-ink" />{tr("Демонстрационные данные")}</div>
          <p className="mt-1 text-footnote text-ink-2">{tr("Всё уже работает — попробуйте. Когда будете готовы, начните с чистого листа.")}</p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => nav.push("data")}>{tr("Начать со своих данных")}</Button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <Group header={tr("Деньги")}>
          <Row icon={Target} title={tr("Цели")} subtitle={s.goals ? tr("{0} · в среднем {1}%", pluralN(s.goals, ["цель", "цели", "целей"]), Math.round(s.goalProgress * 100)) : tr("Квартира, отпуск, подушка")} chevron onClick={() => nav.push("goals")} />
          <Row
            icon={Gauge}
            iconTone={s.over ? "negative" : s.near ? "warning" : undefined}
            title={tr("Бюджеты")}
            subtitle={s.budgets ? (s.over ? tr("{0} превышен{1}", s.over, s.over > 1 ? "о" : "") : s.near ? tr("{0} близко к лимиту", s.near) : tr("Всё в пределах лимитов")) : tr("Лимиты по категориям")}
            chevron
            onClick={() => nav.push("budgets")}
          />
          <Row icon={CalendarDays} title={tr("Планы и календарь")} subtitle={s.plans ? `${pluralN(s.plans, ["запланированная операция", "запланированные операции", "запланированных операций"])}` : tr("Крупные покупки и прогноз")} chevron onClick={() => nav.push("plans")} />
          <Row icon={Repeat} title={tr("Подписки и платежи")} subtitle={s.subs ? tr("{0} в месяц", formatMoney(s.monthly)) : tr("Регулярные списания")} chevron onClick={() => nav.push("subscriptions")} />
          <Row
            icon={HandCoins}
            title={tr("Долги")}
            subtitle={s.debtCount ? [s.owedToMe ? tr("вам {0}", formatMoney(s.owedToMe)) : "", s.iOwe ? tr("вы {0}", formatMoney(s.iOwe)) : ""].filter(Boolean).join(" · ") : tr("Кто кому и сколько")}
            chevron
            onClick={() => nav.push("debts")}
          />
        </Group>

        <Group>
          <Row icon={Palette} title={tr("Оформление")} subtitle={tr("Темы, свой цвет, шрифт цифр")} chevron onClick={() => nav.push("settings")} />
          <Row icon={Shapes} title={tr("Категории")} chevron onClick={() => nav.push("categories")} />
          <Row icon={Settings} title={tr("Настройки")} chevron onClick={() => nav.push("settings")} />
        </Group>
      </div>
    </Screen>
  );
}
