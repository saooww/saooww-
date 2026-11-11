import { useMemo } from "react";
import { motion } from "framer-motion";
import { addDays, diffDays, formatDate } from "../../lib/dates";
import type { GoalInfo } from "../../lib/finance";
import { goalHistory, goalPace } from "../../lib/goals";
import { formatCompact, formatMoney } from "../../lib/money";
import { useAppData, useBalances, useToday } from "../../store/hooks";
import type { Goal } from "../../store/types";
import { tr } from "../../i18n/i18n";

const W = 320;
const H = 132;

/**
 * Where the goal is going: the line of what has been saved, then two dashed
 * ways on — the one that reaches the target on the deadline, and the one the
 * current pace leads along. Where they part is the gap to close.
 */
export function GoalPaceChart({ goal, info }: { goal: Goal; info: GoalInfo }) {
  const data = useAppData();
  const balances = useBalances();
  const today = useToday();
  const hist = useMemo(() => goalHistory(goal, data, balances, today), [goal, data, balances, today]);
  const pace = useMemo(() => goalPace(goal, data, balances, today), [goal, data, balances, today]);

  const start = hist[0]?.day ?? addDays(today, -60);
  const end = goal.deadline && goal.deadline > today ? goal.deadline : addDays(today, 180);
  const span = Math.max(1, diffDays(end, start));
  const months = Math.max(0, diffDays(end, today) / 30.44);
  const top = Math.max(goal.target, info.saved, 1);
  const paceEnd = Math.min(top, Math.max(0, info.saved + pace * months));
  const x = (d: string) => (diffDays(d, start) / span) * (W - 14);
  const y = (v: number) => 10 + (1 - v / top) * (H - 26);
  const actual = hist.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(Math.max(0, p.value)).toFixed(1)}`).join(" ");
  const nowX = x(today);
  const nowY = y(info.saved);
  const needMonthly = info.monthly;
  const behind = needMonthly !== null && pace < needMonthly * 0.9;

  return (
    <div className="relative" role="img" aria-label={tr("Темп накоплений")}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[132px] w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <filter id="gp-glow" x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <line x1="0" x2={W - 14} y1={y(goal.target)} y2={y(goal.target)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        {!info.done && (
          <>
            <path d={`M${nowX} ${nowY} L${W - 14} ${y(goal.target)}`} fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
            <path d={`M${nowX} ${nowY} L${W - 14} ${y(paceEnd)}`} fill="none" stroke="#ffd27a" strokeWidth="1.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          </>
        )}
        <path d={actual} fill="none" stroke="currentColor" strokeWidth="5" opacity="0.5" filter="url(#gp-glow)" />
        <motion.path d={actual} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
        <circle cx={nowX} cy={nowY} r="4.5" fill="currentColor" />
        <circle cx={W - 14} cy={y(goal.target)} r="4.5" fill="currentColor" />
      </svg>
      {!info.done && (
        <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-caption opacity-80">
          {needMonthly !== null && <span>{tr("нужно {0} в мес", formatCompact(needMonthly, goal.currency))}</span>}
          <span style={{ color: behind ? "#ffd27a" : undefined }}>{pace > 0 ? tr("сейчас {0} в мес", formatCompact(Math.round(pace / 100) * 100, goal.currency)) : tr("пополнений нет")}</span>
        </div>
      )}
      <div className="mt-0.5 flex justify-between text-caption opacity-60">
        <span>{formatDate(start, { year: "auto" })}</span>
        <span>{goal.deadline ? formatDate(goal.deadline, { year: "auto" }) : formatMoney(goal.target, { currency: goal.currency })}</span>
      </div>
    </div>
  );
}
