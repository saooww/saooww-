import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, LayoutGrid, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays, startOfMonth, startOfWeek, type DayKey } from "../../lib/dates";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav, useUI } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { useCardModels, WalletCarousel } from "./WalletCarousel";
import { tr } from "../../i18n/i18n";

/**
 * The top of the home screen, like a bank's: the wallet cards — the main
 * view — lighting the page in their colour, this month's money in and out
 * of the card in front, four quick actions, and a slim line for today.
 */
export function HomeHero({ intro }: { intro?: boolean }) {
  return (
    <div>
      <WalletCarousel
        glow
        intro={intro}
        onOpen={(card, rect) => {
          if (card.walletId) nav.push("wallet", { id: card.walletId, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
          else nav.tab("wallets");
        }}
        onAdd={() => nav.sheet("wallet")}
      />
      <CardFlow />
      <QuickActions />
      <TodaySummary />
    </div>
  );
}

/** Money in and out of the card in front, this month. */
function CardFlow() {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const { entries } = useLedger();
  const today = useToday();
  const base = useAppData().settings.baseCurrency;
  const card = cards[Math.min(index, cards.length - 1)];
  const flow = useMemo(() => {
    const from = startOfMonth(today);
    let inflow = 0;
    let outflow = 0;
    for (const e of entries) {
      if (e.day < from || e.day > today) continue;
      if (card?.walletId && e.tx.walletId !== card.walletId) continue;
      if (e.tx.kind === "income") inflow += e.base;
      else if (e.tx.kind === "expense") outflow += e.base;
    }
    return { inflow, outflow };
  }, [entries, today, card?.walletId]);
  if (!card) return null;

  return (
    <div className="mx-5 mt-3 flex items-center justify-between text-footnote">
      <span className="text-ink-3">{tr("В этом месяце")}</span>
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-positive">
          <ArrowDownLeft size={13} />
          <Money value={flow.inflow} currency={base} privacy />
        </span>
        <span className="flex items-center gap-1 text-ink-2">
          <ArrowUpRight size={13} />
          <Money value={flow.outflow} currency={base} privacy />
        </span>
      </span>
    </div>
  );
}

const ACTIONS: Array<{ id: string; label: string; icon: LucideIcon; run: () => void; accent?: boolean }> = [
  { id: "expense", label: tr("Расход"), icon: ArrowUpRight, run: () => nav.sheet("composer", { kind: "expense" }), accent: true },
  { id: "income", label: tr("Доход"), icon: ArrowDownLeft, run: () => nav.sheet("composer", { kind: "income" }) },
  { id: "transfer", label: tr("Перевод"), icon: ArrowLeftRight, run: () => nav.sheet("composer", { kind: "transfer" }) },
  { id: "more", label: tr("Ещё"), icon: LayoutGrid, run: () => nav.sheet("create") }
];

/** Four round actions under the cards, as in a banking app. */
function QuickActions() {
  return (
    <div className="mx-4 mt-5 grid grid-cols-4 gap-2">
      {ACTIONS.map((a, i) => (
        <motion.button
          key={a.id}
          type="button"
          onClick={() => {
            haptic();
            a.run();
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.35 }}
          whileTap={{ scale: 0.92 }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className={cn("grid h-[54px] w-[54px] place-items-center rounded-full", a.accent ? "fill-accent text-[var(--accent-on)]" : "tile text-ink")}>
            <a.icon size={21} />
          </span>
          <span className="text-caption font-medium text-ink-2">{a.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

/** Today, in one line: what can still be spent and the week so far. Tap for the day. */
function TodaySummary() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  const week = useMemo(() => {
    const from = startOfWeek(today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const spent = new Map<DayKey, number>();
    for (const e of entries) if (e.tx.kind === "expense" && e.day >= days[0] && e.day <= days[6]) spent.set(e.day, (spent.get(e.day) ?? 0) + e.base);
    return days.map((d) => ({ d, v: spent.get(d) ?? 0 }));
  }, [entries, today]);
  if (!s || s.allowance <= 0) return null;
  const over = s.today < 0;

  return (
    <motion.button
      type="button"
      aria-label={`${over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}: ${Math.abs(s.today) / 100} ${base}`}
      onClick={() => {
        haptic();
        nav.sheet("day");
      }}
      whileTap={{ scale: 0.98 }}
      transition={spring.press}
      className="panel mx-4 mt-5 flex w-[calc(100%-32px)] items-center gap-3 rounded-[18px] px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-ink-2">{over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}</span>
        <AnimatedMoney value={Math.abs(s.today)} currency={base} privacy className={cn("block text-headline font-semibold", over ? "text-negative" : "text-ink")} />
      </span>
      <span className="flex h-7 items-end gap-[3px]" aria-hidden="true">
        {week.map(({ d, v }) => (
          <span
            key={d}
            className="w-[5px] rounded-full"
            style={{
              height: d > today ? 3 : `${Math.max(12, Math.min(1, v / s.allowance) * 100)}%`,
              background: d > today ? "color-mix(in srgb, var(--ink) 12%, transparent)" : v === 0 ? "var(--positive)" : v > s.allowance ? "var(--accent)" : d === today ? "var(--ink)" : "var(--ink-3)"
            }}
          />
        ))}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-3" />
    </motion.button>
  );
}
