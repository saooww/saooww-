import { useMemo } from "react";
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
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Avatar, Group, IconButton, ProgressBar, SectionHeader } from "../../ui/primitives";
import { TxRow, usePresentCtx } from "../transactions/TxRow";
import { WalletCarousel, useCardModels } from "./WalletCarousel";

export function HomeScreen() {
  const name = useData((s) => s.settings.name);
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const current = cards[Math.min(index, cards.length - 1)];

  const openComposer = (kind: "expense" | "income" | "transfer") => {
    haptic();
    nav.sheet("composer", { kind, walletId: current?.walletId ?? undefined });
  };

  return (
    <Screen
      header={
        <div className="flex w-full items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-2.5">
            <IconButton icon={Search} label="Поиск" variant="plain" size={36} iconSize={21} onClick={() => nav.sheet("search")} />
            <button type="button" aria-label="Настройки и профиль" onClick={() => nav.push("settings")} className="rounded-full active:opacity-70">
              <Avatar name={name || "Я"} size={32} />
            </button>
          </div>
        </div>
      }
    >
      <div className="pt-2">
        <WalletCarousel
          onOpen={(card, rect) => {
            if (card.walletId) nav.push("wallet", { id: card.walletId, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
            else nav.tab("wallets");
          }}
          onAdd={() => nav.sheet("wallet")}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2.5 px-5">
        <ActionButton icon={ArrowDownLeft} label="Доход" onClick={() => openComposer("income")} />
        <ActionButton icon={ArrowUpRight} label="Расход" onClick={() => openComposer("expense")} />
        <ActionButton icon={ArrowLeftRight} label="Перемещение" onClick={() => openComposer("transfer")} />
      </div>

      <HomeInsight />
      <RecentOperations />
      <PrimaryGoal />
    </Screen>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={spring.press}
      className="flex h-[76px] flex-col items-center justify-center gap-2 rounded-lg bg-surface active:bg-surface-press"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-3">
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span className="text-footnote font-medium text-ink">{label}</span>
    </motion.button>
  );
}

function HomeInsight() {
  const data = useAppData();
  const { entries } = useLedger();
  const today = useToday();
  const insight = useMemo(() => homeInsight(data, entries, today), [data, entries, today]);
  if (!insight) return null;
  const tone = { neutral: "text-ink-2", positive: "text-positive", warning: "text-warning", negative: "text-negative" }[insight.tone];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      onClick={() => {
        if (!insight.action) return;
        const { tab, route, params } = insight.action;
        if (route) nav.push(route, params);
        else nav.tab(tab);
      }}
      className="mx-5 mt-4 flex w-[calc(100%-40px)] items-center gap-3 rounded-lg border border-line px-4 py-3 text-left active:bg-surface"
    >
      <NamedIcon name={insight.icon} size={18} strokeWidth={2} className={cn("shrink-0", tone)} />
      <span className="min-w-0 flex-1 text-subhead text-ink">{insight.text}</span>
      {insight.action && <ChevronRight size={16} className="shrink-0 text-ink-3" />}
    </motion.button>
  );
}

function RecentOperations() {
  const transactions = useData((s) => s.transactions);
  const ctx = usePresentCtx();
  const recent = useMemo(() => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3), [transactions]);
  return (
    <div className="mt-7">
      <SectionHeader title="Последние операции" action={recent.length ? { label: "Все", onClick: () => nav.tab("transactions") } : undefined} />
      {recent.length ? (
        <Group>
          {recent.map((tx) => (
            <TxRow key={tx.id} tx={tx} ctx={ctx} onOpen={(t) => nav.sheet("tx", { id: t.id })} />
          ))}
        </Group>
      ) : (
        <div className="mx-5 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-subhead text-ink-2">
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
    <div className="mt-7">
      <SectionHeader title="Цель" action={{ label: "Все цели", onClick: () => nav.push("goals") }} />
      <button
        type="button"
        onClick={() => nav.push("goal", { id: goal.id })}
        className="mx-4 block w-[calc(100%-32px)] rounded-lg bg-surface px-4 py-4 text-left active:bg-surface-press"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-3">
            <NamedIcon name={goal.icon} size={18} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-medium">{goal.name}</div>
            <div className="text-footnote text-ink-2">
              {info.done ? "Цель достигнута" : goal.deadline ? `до ${formatDate(goal.deadline, { year: "auto" })}` : "без срока"}
              {info.monthly && !info.done ? ` · ${formatMoney(info.monthly, { currency: goal.currency })} в месяц` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-body font-semibold tnum">{Math.floor(info.progress * 100)}%</div>
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
