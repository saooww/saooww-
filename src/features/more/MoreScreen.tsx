import { useMemo } from "react";
import { CalendarDays, Palette, FlaskConical, Gauge, HandCoins, Repeat, Search, Settings, Shapes, Target } from "../../ui/glyphs";
import { budgetStates } from "../../lib/insights";
import { goalInfo, goalSaved } from "../../lib/finance";
import { debtPeople } from "../../lib/debts";
import { formatMoney } from "../../lib/money";
import { monthlyEquivalent } from "../../lib/recurrence";
import { MONTHS_GEN, parseDay, pluralN } from "../../lib/dates";
import { useAppData, useBalances, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Avatar, Button, Group, IconButton, Row } from "../../ui/primitives";
import { getLang, locale, tr } from "../../i18n/i18n";
import { ProgressPanel } from "./ProgressPanel";
import { HeroCard } from "../../ui/HeroCard";
import { LogoWord } from "../../ui/Brand";
import { materialOf } from "../../store/catalog";

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
    const people = debtPeople(data.debts, data.transactions, today).filter((p) => !p.closed);
    const debts = people;
    const owedToMe = people.reduce((a, p) => a + p.toMe, 0);
    const iOwe = people.reduce((a, p) => a + p.fromMe, 0);
    const plans = data.plans.filter((p) => p.status === "planned" && p.date >= today).length;
    return { goals: goals.length, goalProgress, budgets: budgets.length, over, near, monthly, subs: subs.length, owedToMe, iOwe, debtCount: debts.length, plans };
  }, [data, entries, balances, env, today]);

  return (
    <Screen title={tr("Профиль")} large actions={<IconButton icon={Search} label={tr("Поиск")} onClick={() => nav.sheet("search")} />}>
      {/* who you are, and the way into the app's look and settings */}
      <HeroCard material={materialOf("titanium")} onClick={() => nav.push("settings")} ariaLabel={tr("Настройки и профиль")}>
        <div className="flex min-h-[196px] flex-col p-5">
          <div className="flex items-center justify-between">
            <LogoWord size={11} color={materialOf("titanium").ink} />
            <Settings size={18} style={{ color: materialOf("titanium").inkMuted }} />
          </div>
          <div className="mt-auto flex items-center gap-3.5">
            <Avatar name={name || tr("Я")} size={52} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-title-2 font-semibold">{name || tr("Ваш профиль")}</span>
              <span className="block text-footnote" style={{ color: materialOf("titanium").inkMuted }}>{since ? tr("В Ardessa с {0}", since) : tr("Имя, оформление, данные")}</span>
            </span>
          </div>
        </div>
      </HeroCard>

      <ProgressPanel />

      {demo && (
        <div className="mx-4 mt-5 rounded-lg border border-line-strong px-4 py-3.5">
          <div className="flex items-center gap-2 text-subhead font-semibold">
            <FlaskConical size={16} className="text-accent-ink" />{tr("Демонстрационные данные")}</div>
          <p className="mt-1 text-footnote text-ink-2">{tr("Всё уже работает — попробуйте. Когда будете готовы, начните с чистого листа.")}</p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => nav.push("data")}>{tr("Начать со своих данных")}</Button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 px-4">
          {[
            { icon: Target, title: tr("Цели"), sub: s.goals ? tr("{0} · {1}%", s.goals, Math.round(s.goalProgress * 100)) : tr("Квартира, отпуск"), tone: "", go: () => nav.push("goals") },
            {
              icon: HandCoins,
              title: tr("Долги"),
              sub: s.debtCount ? [s.owedToMe ? tr("вам {0}", formatMoney(s.owedToMe)) : "", s.iOwe ? tr("вы {0}", formatMoney(s.iOwe)) : ""].filter(Boolean).join(" · ") : tr("Кто кому и сколько"),
              tone: "",
              go: () => nav.push("debts")
            },
            {
              icon: Gauge,
              title: tr("Бюджеты"),
              sub: s.budgets ? (s.over ? tr("{0} превышен{1}", s.over, s.over > 1 ? "о" : "") : s.near ? tr("{0} близко к лимиту", s.near) : tr("всё в норме")) : tr("Лимиты"),
              tone: s.over ? "text-negative" : s.near ? "text-warning" : "",
              go: () => nav.push("budgets")
            },
            { icon: Repeat, title: tr("Подписки"), sub: s.subs ? tr("{0} в месяц", formatMoney(s.monthly)) : tr("Регулярные списания"), tone: "", go: () => nav.push("subscriptions") },
            { icon: CalendarDays, title: tr("Планы"), sub: s.plans ? pluralN(s.plans, ["операция", "операции", "операций"]) : tr("Покупки и прогноз"), tone: "", go: () => nav.push("plans") },
            { icon: Shapes, title: tr("Категории"), sub: tr("{0} штук", data.categories.filter((c) => !c.archived).length), tone: "", go: () => nav.push("categories") }
          ].map((t) => (
            <button key={t.title} type="button" onClick={t.go} className="panel relative flex h-[116px] flex-col justify-between rounded-[22px] p-3.5 text-left active:opacity-80">
              <span className="tile grid h-10 w-10 place-items-center rounded-[14px] text-ink">
                <t.icon size={21} />
              </span>
              <span>
                <span className="block text-callout font-bold">{t.title}</span>
                <span className={`block truncate text-caption ${t.tone || "text-ink-2"}`}>{t.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <Group>
          <Row icon={Palette} title={tr("Оформление")} subtitle={tr("Темы, свой цвет, шрифт цифр")} chevron onClick={() => nav.push("settings")} />
          <Row icon={Settings} title={tr("Настройки")} chevron onClick={() => nav.push("settings")} />
        </Group>
      </div>
    </Screen>
  );
}
