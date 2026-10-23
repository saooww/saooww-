import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Search, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { goalInfo, goalSaved } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { homeInsight } from "../../lib/insights";
import { useAppData, useBalances, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Wordmark } from "../../ui/Brand";
import { Money } from "../../ui/Money";
import { introActive, Reveal } from "../../ui/intro";
import { spring } from "../../ui/motion";
import { Avatar, Group, IconButton, IconChip, ProgressBar, SectionHeader } from "../../ui/primitives";
import { TxRow, usePresentCtx } from "../transactions/TxRow";
import { WalletCarousel, useCardModels } from "./WalletCarousel";
import { HomeReminder, SafeToSpendCard } from "./HomeCards";

export function HomeScreen() {
  const name = useData((s) => s.settings.name);
  const cards = useCardModels();
  const [intro] = useState(introActive);

  const openComposer = (kind: "expense" | "income" | "transfer") => {
    haptic();
    // Read the card index only on tap: swiping the carousel shouldn't re-render the whole screen.
    const current = cards[Math.min(useUI.getState().homeCardIndex, cards.length - 1)];
    nav.sheet("composer", { kind, walletId: current?.walletId ?? undefined });
  };

  return (
    <Screen
      header={
        <Reveal intro={intro} delay={0.55} y={-6} className="flex w-full items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-2">
            <IconButton icon={Search} label="Поиск" size={36} iconSize={18} onClick={() => nav.sheet("search")} />
            <button type="button" aria-label="Настройки и профиль" onClick={() => nav.push("settings")} className="rounded-full active:opacity-70">
              <Avatar name={name || "Я"} size={36} />
            </button>
          </div>
        </Reveal>
      }
    >
      <Reveal intro={intro} delay={0.6} y={8} className="px-5 pb-5 pt-2">
        <Greeting name={name} />
      </Reveal>

      <WalletCarousel
        intro={intro}
        onOpen={(card, rect) => {
          if (card.walletId) nav.push("wallet", { id: card.walletId, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
          else nav.tab("wallets");
        }}
        onAdd={() => nav.sheet("wallet")}
      />

      <div className="mt-6 grid grid-cols-3 gap-2.5 px-5">
        <Reveal intro={intro} delay={0.75} y={12}>
          <ActionButton icon={ArrowDownLeft} label="Доход" tone="income" onClick={() => openComposer("income")} />
        </Reveal>
        <Reveal intro={intro} delay={0.8} y={12}>
          <ActionButton icon={ArrowUpRight} label="Расход" tone="expense" onClick={() => openComposer("expense")} />
        </Reveal>
        <Reveal intro={intro} delay={0.85} y={12}>
          <ActionButton icon={ArrowLeftRight} label="Перемещение" tone="transfer" onClick={() => openComposer("transfer")} />
        </Reveal>
      </div>

      <Reveal intro={intro} delay={0.95} y={12}>
        <SafeToSpendCard />
        <HomeReminder />
        <HomeInsight />
        <RecentOperations />
        <PrimaryGoal />
      </Reveal>
    </Screen>
  );
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function Greeting({ name }: { name: string }) {
  const today = useToday();
  const date = useMemo(() => new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), [today]);
  const first = name.trim().split(/\s+/)[0];
  return (
    <div>
      <div className="label-caps">{date}</div>
      <h1 className="mt-1.5 text-title-2 font-semibold tracking-[-0.025em] text-ink">
        {greetingFor(new Date().getHours())}
        {first ? <span className="text-ink-2">, {first}</span> : null}
      </h1>
    </div>
  );
}

const ACTION_TONE = {
  income: { tile: "bg-positive-soft text-positive", ring: "color-mix(in srgb, var(--positive) 28%, transparent)" },
  expense: { tile: "fill-accent text-[var(--accent-on)]", ring: "" },
  transfer: { tile: "tile text-ink", ring: "" }
};

function ActionButton({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: keyof typeof ACTION_TONE; onClick: () => void }) {
  const t = ACTION_TONE[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={spring.press}
      className="panel flex h-[88px] w-full flex-col items-center justify-center gap-2.5 rounded-[20px]"
    >
      <span className={cn("grid h-10 w-10 place-items-center rounded-[14px]", t.tile)} style={t.ring ? { boxShadow: `inset 0 0 0 0.5px ${t.ring}` } : undefined}>
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <span className="text-footnote font-semibold tracking-[-0.005em] text-ink">{label}</span>
    </motion.button>
  );
}

function HomeInsight() {
  const data = useAppData();
  const { entries } = useLedger();
  const today = useToday();
  const insight = useMemo(() => homeInsight(data, entries, today), [data, entries, today]);
  if (!insight) return null;
  const tone = ({ neutral: undefined, positive: "positive", warning: "warning", negative: "negative" } as const)[insight.tone];
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={spring.press}
      onClick={() => {
        if (!insight.action) return;
        const { tab, route, params } = insight.action;
        if (route) nav.push(route, params);
        else nav.tab(tab);
      }}
      className="panel mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-[18px] py-3 pl-3 pr-3.5 text-left"
    >
      <IconChip name={insight.icon} tone={tone} size={34} />
      <span className="min-w-0 flex-1 text-subhead leading-[19px] text-ink">{insight.text}</span>
      {insight.action && <ChevronRight size={16} className="shrink-0 text-ink-3" />}
    </motion.button>
  );
}

function RecentOperations() {
  const transactions = useData((s) => s.transactions);
  const ctx = usePresentCtx();
  const recent = useMemo(() => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3), [transactions]);
  return (
    <div className="mt-8">
      <SectionHeader title="Последние операции" action={recent.length ? { label: "Все", onClick: () => nav.tab("transactions") } : undefined} />
      {recent.length ? (
        <Group>
          {recent.map((tx) => (
            <TxRow key={tx.id} tx={tx} ctx={ctx} onOpen={(t) => nav.sheet("tx", { id: t.id })} />
          ))}
        </Group>
      ) : (
        <div className="mx-4 rounded-lg border border-dashed border-line-strong px-4 py-7 text-center text-subhead text-ink-2">
          Здесь появятся ваши операции. Начните с кнопок выше.
        </div>
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
      <SectionHeader title="Цель" action={{ label: "Все цели", onClick: () => nav.push("goals") }} />
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
              {info.done ? "Цель достигнута" : goal.deadline ? `до ${formatDate(goal.deadline, { year: "auto" })}` : "без срока"}
              {info.monthly && !info.done ? ` · ${formatMoney(info.monthly, { currency: goal.currency })} в месяц` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-title-3 font-semibold tracking-[-0.03em] tnum">
              {Math.floor(info.progress * 100)}
              <span className="text-footnote font-medium text-ink-2">%</span>
            </div>
          </div>
        </div>
        <ProgressBar value={info.progress} className="mt-3.5" tone={info.done ? "positive" : "accent"} />
        <div className="mt-2 flex justify-between text-footnote text-ink-2">
          <Money value={info.saved} currency={goal.currency} privacy />
          <Money value={goal.target} currency={goal.currency} />
        </div>
      </button>
    </div>
  );
}
