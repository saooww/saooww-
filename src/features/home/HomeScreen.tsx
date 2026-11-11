import { useMemo, useState } from "react";
import { ListChecks, ReceiptText, Search, SlidersHorizontal, Sparkles, Target, type LucideIcon } from "../../ui/glyphs";
import { formatDate } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { goalInfo, goalSaved } from "../../lib/finance";
import { useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Wordmark } from "../../ui/Brand";
import { Money } from "../../ui/Money";
import { introActive, Reveal } from "../../ui/intro";
import { Avatar, Group, IconButton, IconChip, ProgressBar, SectionHeader, Toggle } from "../../ui/primitives";
import { Sheet } from "../../ui/Sheet";
import type { HomeBlock } from "../../store/types";
import { TxRow, usePresentCtx } from "../transactions/TxRow";
import { HomeHero } from "./HomeHero";
import { HomeFeed } from "./HomeCards";
import { HomeToday } from "../planner/HomeToday";
import { tr } from "../../i18n/i18n";

export function HomeScreen() {
  const name = useData((s) => s.settings.name);
  const [intro] = useState(introActive);


  return (
    <Screen
      header={
        <Reveal intro={intro} delay={0.55} y={-6} className="flex w-full items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-2">
            <IconButton icon={Sparkles} label={tr("Спросить Ardessa")} size={36} iconSize={18} onClick={() => nav.push("assistant", {})} />
            <IconButton icon={Search} label={tr("Поиск")} size={36} iconSize={18} onClick={() => nav.sheet("search")} />
            <button type="button" aria-label={tr("Настройки и профиль")} onClick={() => nav.push("settings")} className="rounded-full active:opacity-70">
              <Avatar name={name || tr("Я")} size={36} />
            </button>
          </div>
        </Reveal>
      }
    >
      <Reveal intro={intro} delay={0.7} y={14}>
        <HomeHero />
      </Reveal>

      <Reveal intro={intro} delay={0.95} y={12}>
        <HomeBlocks />
      </Reveal>
    </Screen>
  );
}

/** The blocks under the quick actions; any of them can be hidden in «Настроить главную». */
function HomeBlocks() {
  const hidden = useData((s) => s.settings.homeHidden);
  const shown = (b: HomeBlock) => !hidden?.includes(b);
  return (
    <>
      {shown("today") && <HomeToday />}
      {shown("feed") && <HomeFeed />}
      {shown("recent") && <RecentOperations />}
      {shown("goal") && <PrimaryGoal />}
      <div className="mt-8 flex justify-center">
        <button type="button" onClick={() => nav.sheet("homeLayout")} className="flex h-10 items-center gap-2 rounded-full px-4 text-footnote font-medium text-ink-2 active:bg-surface-press">
          <SlidersHorizontal size={15} strokeWidth={2} />{tr("Настроить главную")}</button>
      </div>
    </>
  );
}

const HOME_BLOCKS: Array<{ id: HomeBlock; title: string; subtitle: string; icon: LucideIcon }> = [
  { id: "today", title: tr("Сегодня и скоро"), subtitle: tr("Дела дня и платежи на неделю"), icon: ListChecks },
  { id: "feed", title: tr("Важное"), subtitle: tr("Итоги месяца, копия данных, подсказки"), icon: Sparkles },
  { id: "recent", title: tr("Последние операции"), subtitle: tr("Три последние записи"), icon: ReceiptText },
  { id: "goal", title: tr("Цель"), subtitle: tr("Главная цель и её прогресс"), icon: Target }
];

/** Which blocks the home screen shows. The cards, the timeline and the smart line always stay. */
export function HomeLayoutSheet() {
  const hidden = useData((s) => s.settings.homeHidden ?? []);
  const update = useData((s) => s.updateSettings);
  return (
    <Sheet title={tr("Главная")} ariaLabel={tr("Настроить главную")}>
      <p className="px-6 pb-4 text-center text-footnote text-ink-2">{tr("Баланс, прогноз, доходы месяца и сумма на сегодня видны всегда. Остальное — по желанию.")}</p>
      <Group>
        {HOME_BLOCKS.map((b) => (
          <div key={b.id} className="flex min-h-[58px] items-center gap-3 px-4 py-2.5">
            <IconChip icon={b.icon} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-body text-ink">{b.title}</div>
              <div className="text-footnote text-ink-2">{b.subtitle}</div>
            </div>
            <Toggle
              checked={!hidden.includes(b.id)}
              label={b.title}
              onChange={(on) => update({ homeHidden: on ? hidden.filter((h) => h !== b.id) : [...hidden, b.id] })}
            />
          </div>
        ))}
      </Group>
    </Sheet>
  );
}

function RecentOperations() {
  const transactions = useData((s) => s.transactions);
  const ctx = usePresentCtx();
  const recent = useMemo(() => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3), [transactions]);
  return (
    <div className="mt-8">
      <SectionHeader title={tr("Последние операции")} action={recent.length ? { label: tr("Все"), onClick: () => nav.tab("transactions") } : undefined} />
      {recent.length ? (
        <Group>
          {recent.map((tx) => (
            <TxRow key={tx.id} tx={tx} ctx={ctx} onOpen={(t) => nav.sheet("tx", { id: t.id })} />
          ))}
        </Group>
      ) : (
        <div className="mx-4 rounded-lg border border-dashed border-line-strong px-4 py-7 text-center text-subhead text-ink-2">{tr("Здесь появятся ваши операции. Начните с кнопок выше.")}</div>
      )}
    </div>
  );
}

function PrimaryGoal() {
  const goals = useData((s) => s.goals);
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();
  const goal = useMemo(() => {
    const live = goals.filter((g) => !g.archived);
    return live.find((g) => g.primary) ?? live.sort((a, b) => (a.deadline ?? "9999") < (b.deadline ?? "9999") ? -1 : 1)[0];
  }, [goals]);
  if (!goal) return null;
  const info = goalInfo(goal, goalSaved(goal, env, balances), today);
  return (
    <div className="mt-8">
      <SectionHeader title={tr("Цель")} action={{ label: tr("Все цели"), onClick: () => nav.push("goals") }} />
      <button
        type="button"
        onClick={() => nav.push("goal", { id: goal.id })}
        className="panel mx-4 block w-[calc(100%-32px)] rounded-lg px-4 py-4 text-left active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <IconChip name={goal.icon} tone="accent" size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-medium">{goal.name}</div>
            <div className="text-footnote text-ink-2">
              {info.done ? tr("Цель достигнута") : goal.deadline ? tr("до {0}", formatDate(goal.deadline, { year: "auto" })) : tr("без срока")}
              {info.monthly && !info.done ? tr(" · {0} в месяц", formatMoney(info.monthly, { currency: goal.currency })) : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-title-3 font-semibold tracking-[-0.03em] tnum">
              {Math.floor(info.progress * 100)}
              <span className="text-footnote font-medium text-ink-2">%</span>
            </div>
          </div>
        </div>
        <ProgressBar value={info.progress} className="mt-3.5" tone={info.done ? "positive" : "ink"} color={info.done ? undefined : goal.color} />
        <div className="mt-2 flex justify-between text-footnote text-ink-2">
          <Money value={info.saved} currency={goal.currency} privacy />
          <Money value={goal.target} currency={goal.currency} />
        </div>
      </button>
    </div>
  );
}
