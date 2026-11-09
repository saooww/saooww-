import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronRight, CircleCheckBig, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { dayPlan } from "../../lib/tasks";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { useLingering } from "../planner/actions";
import { tr } from "../../i18n/i18n";

/**
 * The day at a glance, the way Apple's own apps show a number: one large
 * figure — what can still be spent today — a bar of how much of today's
 * norm is left (green, amber when it runs low, red once it's over), and two
 * tiles under it: spent today and the day's tasks.
 */
export function DayHero() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const keep = useLingering();
  const base = data.settings.baseCurrency;

  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  const plan = useMemo(() => dayPlan(tasks, today, keep), [tasks, today, keep]);

  const allowance = s?.allowance ?? 0;
  const left = s?.today ?? 0;
  const over = left < 0;
  const empty = !s || allowance <= 0;
  const share = empty ? 0 : over ? 1 : Math.max(0, Math.min(1, left / allowance));
  const tone = over ? "var(--negative)" : share < 0.3 ? "var(--warning)" : "var(--positive)";

  return (
    <div className="px-4">
      <motion.button
        type="button"
        aria-label={empty ? tr("Сфера дня") : `${over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}: ${Math.abs(left) / 100} ${base}`}
        onClick={() => {
          haptic();
          nav.sheet("day");
        }}
        whileTap={{ scale: 0.985 }}
        transition={spring.press}
        className="panel block w-full rounded-[22px] px-5 pb-5 pt-4 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-footnote font-semibold text-ink-2">{empty ? tr("Сегодня") : over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}</span>
          <ChevronRight size={16} className="text-ink-3" />
        </div>
        {empty ? (
          <div className="mt-2 text-title-3 font-semibold text-ink">{tr("Добавьте остатки — посчитаю сумму на день")}</div>
        ) : (
          <>
            <AnimatedMoney value={Math.abs(left)} currency={base} variant="hero" privacy className={cn("mt-1 block text-[54px] leading-[1.08]", over ? "text-negative" : "text-ink")} />
            <div className="mt-4 h-[8px] overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--ink) 10%, transparent)" }}>
              <motion.div className="h-full rounded-full" style={{ background: tone }} initial={false} animate={{ width: `${Math.max(over ? 100 : 2, share * 100)}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-footnote text-ink-2">
              <span>
                {tr("Норма")} <Money value={allowance} currency={base} privacy /> {tr("на день")}
              </span>
              {s && <span>{tr("До конца месяца {0} дн.", s.daysLeft)}</span>}
            </div>
          </>
        )}
      </motion.button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile icon={ArrowUpRight} label={tr("Потрачено")} onClick={() => nav.tab("transactions")}>
          <Money value={s?.spentToday ?? 0} currency={base} privacy className="text-title-3 font-semibold text-ink" />
        </Tile>
        <Tile icon={CircleCheckBig} label={tr("Дела")} onClick={() => nav.planner("today")}>
          <span className="text-title-3 font-semibold text-ink tnum">
            {plan.total ? tr("{0} из {1}", plan.completed, plan.total) : tr("Дел нет")}
          </span>
          {plan.total > 0 && (
            <div className="mt-2 h-[4px] overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--ink) 10%, transparent)" }}>
              <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${(plan.completed / plan.total) * 100}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} />
            </div>
          )}
        </Tile>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, onClick, children }: { icon: LucideIcon; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        haptic();
        onClick();
      }}
      whileTap={{ scale: 0.97 }}
      transition={spring.press}
      className="panel flex min-h-[92px] flex-col rounded-[22px] px-4 py-3.5 text-left"
    >
      <span className="flex items-center gap-1.5 text-footnote font-semibold text-ink-2">
        <Icon size={15} />
        {label}
      </span>
      <span className="mt-auto block pt-2">{children}</span>
    </motion.button>
  );
}
