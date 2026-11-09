import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { WEEKDAYS_SHORT, addDays, startOfWeek, type DayKey } from "../../lib/dates";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { materialOf } from "../../store/catalog";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { BrandMark } from "../../ui/Brand";
import { HeroCard } from "../../ui/HeroCard";
import { AnimatedMoney, Money } from "../../ui/Money";
import { tr } from "../../i18n/i18n";

/**
 * «Карта дня» — the first thing on the home screen: a card in Ardessa red
 * with what can still be spent today, a bar of today's norm and the days
 * left. Over the norm it turns to bordeaux; with no balances yet — graphite.
 * Under it, the week: one chip per day with its spending against the norm.
 */
export function DayCard() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);

  const allowance = s?.allowance ?? 0;
  const left = s?.today ?? 0;
  const over = left < 0;
  const empty = !s || allowance <= 0;
  const share = empty ? 0 : over ? 1 : Math.max(0, Math.min(1, left / allowance));
  const material = materialOf(empty ? "graphite" : over ? "bordeaux" : "ardessa");

  return (
    <div>
      <HeroCard
        material={material}
        ariaLabel={empty ? tr("Карта дня") : `${over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}: ${Math.abs(left) / 100} ${base}`}
        onClick={() => {
          haptic();
          nav.sheet("day");
        }}
      >
        <div className="flex min-h-[208px] flex-col px-[22px] pb-5 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: material.inkMuted }}>
              {empty ? tr("Сегодня") : over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}
            </span>
            <span style={{ opacity: 0.8 }}>
              <BrandMark size={16} color={material.ink} />
            </span>
          </div>
          {empty ? (
            <div className="mt-4 max-w-[240px] text-title-3 font-semibold">{tr("Добавьте остатки — посчитаю сумму на день")}</div>
          ) : (
            <AnimatedMoney value={Math.abs(left)} currency={base} variant="hero" privacy className="mt-3 block text-[56px] leading-none" />
          )}
          {!empty && (
            <div className="mt-auto pt-6">
              <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.25)" }}>
                <motion.div className="h-full rounded-full" style={{ background: material.ink }} initial={{ width: 0 }} animate={{ width: `${over ? 100 : Math.max(2, share * 100)}%` }} transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.3 }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-footnote" style={{ color: material.inkMuted }}>
                <span>
                  {tr("Норма")} <Money value={allowance} currency={base} privacy /> {tr("на день")}
                </span>
                {s && <span>{tr("До конца месяца {0} дн.", s.daysLeft)}</span>}
              </div>
            </div>
          )}
        </div>
      </HeroCard>
      {!empty && <WeekStrip norm={allowance} today={today} />}
    </div>
  );
}

/** This week, Monday to Sunday: each day's spending as a small bar against the norm. */
function WeekStrip({ norm, today }: { norm: number; today: DayKey }) {
  const { entries } = useLedger();
  const days = useMemo(() => {
    const from = startOfWeek(today);
    const list = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const spent = new Map<DayKey, number>();
    for (const e of entries) if (e.tx.kind === "expense" && e.day >= list[0] && e.day <= list[6]) spent.set(e.day, (spent.get(e.day) ?? 0) + e.base);
    return list.map((d) => ({ d, v: spent.get(d) ?? 0 }));
  }, [entries, today]);

  return (
    <div className="mx-4 mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
      {days.map(({ d, v }, i) => {
        const future = d > today;
        const share = norm > 0 ? Math.min(1, v / norm) : 0;
        const color = future ? "transparent" : v === 0 ? "var(--positive)" : norm > 0 && v > norm ? "var(--accent)" : "var(--ink-2)";
        return (
          <div key={d} className={cn("panel flex flex-col items-center gap-1.5 rounded-[14px] pb-2 pt-2", d === today && "!shadow-[inset_0_0_0_1.5px_var(--ink)]")}>
            <span className={cn("text-[11px] font-medium", d === today ? "text-ink" : "text-ink-3")}>{WEEKDAYS_SHORT[i]}</span>
            <span className="flex h-[30px] w-[6px] items-end overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}>
              <motion.span className="w-full rounded-full" style={{ background: color }} initial={{ height: 0 }} animate={{ height: future ? 0 : `${v === 0 ? 18 : Math.max(10, share * 100)}%` }} transition={{ delay: 0.35 + i * 0.05, type: "spring", stiffness: 120, damping: 18 }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
