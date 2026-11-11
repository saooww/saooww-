import { useMemo, useState } from "react";
import { Check, TriangleAlert } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { monthTitle, pluralN } from "../../lib/dates";
import type { GoalInfo } from "../../lib/finance";
import { goalPace, goalWhatIf, whatIfSteps } from "../../lib/goals";
import { haptic } from "../../lib/haptics";
import { formatMoney } from "../../lib/money";
import { useAppData, useBalances, useToday } from "../../store/hooks";
import type { Goal } from "../../store/types";
import { Chip } from "../../ui/primitives";
import { tr } from "../../i18n/i18n";

/**
 * «А если откладывать больше?» — pick an extra monthly amount and see the
 * date the goal is reached and whether the deadline is kept. Only a
 * calculation: nothing is saved or changed.
 */
export function GoalWhatIf({ goal, info }: { goal: Goal; info: GoalInfo }) {
  const data = useAppData();
  const balances = useBalances();
  const today = useToday();
  const [extra, setExtra] = useState(0);
  const pace = useMemo(() => goalPace(goal, data, balances, today), [goal, data, balances, today]);
  const steps = useMemo(() => whatIfSteps(goal.target), [goal.target]);
  const fmt = (v: number) => formatMoney(v, { currency: goal.currency });
  const base = goalWhatIf(goal, info, pace, 0, today);
  const now = goalWhatIf(goal, info, pace, extra, today);
  if (info.done) return null;

  const when = (eta: string | null) => (eta ? monthTitle(eta, "always") : null);
  return (
    <section className="panel mx-4 mt-3 rounded-[22px] px-4 py-4" aria-label={tr("А если откладывать больше?")}>
      <h2 className="text-headline font-semibold">{tr("А если откладывать больше?")}</h2>
      <p className="mt-0.5 text-footnote text-ink-2">
        {pace > 0 ? tr("Сейчас вы откладываете {0} в месяц", fmt(Math.round(pace / 100) * 100)) : tr("Пополнений за последние 3 месяца не было")}
      </p>
      <div className="scroll-x mt-3 flex gap-2">
        <Chip selected={extra === 0} onClick={() => setExtra(0)}>
          {tr("Как сейчас")}
        </Chip>
        {steps.map((v) => (
          <Chip
            key={v}
            selected={extra === v}
            onClick={() => {
              haptic();
              setExtra(v);
            }}
          >
            +{fmt(v)}
          </Chip>
        ))}
      </div>

      <div className="mt-3.5 flex items-baseline justify-between gap-3">
        <span className="text-subhead text-ink-2">{tr("{0} в месяц", fmt(Math.round(now.monthly / 100) * 100))}</span>
        <span className="num-display text-[22px] leading-none">{when(now.eta) ?? "—"}</span>
      </div>
      <div className="mt-1 text-caption text-ink-2">
        {now.eta === null
          ? tr("Без пополнений цель не будет достигнута")
          : extra > 0 && base.eta && now.earlierBy
            ? tr("на {0} раньше, чем при текущем темпе ({1})", pluralN(now.earlierBy, ["месяц", "месяца", "месяцев"]), when(base.eta) ?? "")
            : base.eta
              ? tr("при текущем темпе")
              : tr("с такой добавкой")}
      </div>

      {goal.deadline && now.eta && (
        <div className={cn("mt-3 flex items-start gap-2 rounded-[14px] px-3 py-2 text-footnote", now.meetsDeadline ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")}>
          {now.meetsDeadline ? <Check size={15} className="mt-0.5 shrink-0" strokeWidth={2.4} /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
          <span>
            {now.meetsDeadline
              ? tr("Успеваете к сроку — {0}", monthTitle(goal.deadline, "always"))
              : tr("Позже срока на {0}", pluralN(now.lateBy, ["месяц", "месяца", "месяцев"]))}
          </span>
        </div>
      )}
    </section>
  );
}
