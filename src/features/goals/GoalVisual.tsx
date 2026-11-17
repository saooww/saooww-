import { motion } from "framer-motion";
import { Check, ListChecks, Plus, Star } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { formatDate, pluralN } from "../../lib/dates";
import type { GoalInfo } from "../../lib/finance";
import type { GoalStatus } from "../../lib/goals";
import { goalStatusText } from "../../lib/goals";
import { formatMoney } from "../../lib/money";
import { ProgressBar } from "../../ui/primitives";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import type { Goal } from "../../store/types";
import { nav } from "../../store/ui";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { tr } from "../../i18n/i18n";

/**
 * A goal as a card in its own colour: the share saved in large figures,
 * a progress bar, the deadline and the monthly amount, and
 * the open tasks of its list. Used in the list (tap to open) and, larger, on
 * the goal's own screen.
 */
export function GoalVisual({ goal, info, status, onOpen, big, delay = 0 }: { goal: Goal; info: GoalInfo; status: GoalStatus; onOpen?: () => void; big?: boolean; delay?: number }) {
  const color = info.done ? "var(--positive)" : goal.color ?? "var(--accent-ink)";
  const st = goalStatusText(status, goal.currency);
  const tasks = useData((s) => s.tasks);
  const project = useData((s) => (goal.projectId ? s.projects.find((p) => p.id === goal.projectId) : undefined));
  const open = project ? tasks.filter((t) => t.projectId === project.id && !t.done) : [];

  return (
    <motion.div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && onOpen()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 30 }}
      whileTap={onOpen ? { scale: 0.985 } : undefined}
      className={cn("panel rounded-[22px] text-ink", onOpen && "cursor-pointer", big ? "p-5" : "p-4")}
    >
      <div className="relative flex items-center gap-2">
        <NamedIcon name={goal.icon} size={19} className="shrink-0 text-ink-2" />
        <span className={cn("min-w-0 flex-1 truncate font-semibold", big ? "text-title-3" : "text-headline")}>{goal.name}</span>
        {goal.primary && <Star size={14} className="shrink-0 fill-current" />}
        <span className="shrink-0 rounded-full tile px-2.5 py-0.5 text-caption font-semibold">{info.done ? tr("Достигнута") : st.tone === "warning" ? tr("отстаёт") : st.tone === "positive" ? tr("по плану") : tr("в пути")}</span>
      </div>
      <div className="relative mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={cn("num-display leading-none", big ? "text-[54px]" : "text-[40px]")}>
          {info.done ? <Check size={big ? 44 : 34} strokeWidth={2.4} /> : `${Math.floor(info.progress * 100)}%`}
        </span>
        <span className="min-w-0 text-right text-footnote text-ink-2">
          <Money value={info.saved} currency={goal.currency} privacy className="font-semibold text-ink" /> {tr("из")} <Money value={goal.target} currency={goal.currency} />
        </span>
      </div>
      <ProgressBar value={info.progress} color={color} className="mt-3" />
      <div className="relative mt-2.5 flex items-center justify-between text-caption text-ink-2">
        <span>{goal.deadline ? tr("до {0}", formatDate(goal.deadline, { year: "auto" })) : tr("Без срока")}</span>
        <span className="num">{!info.done && info.monthly ? tr("{0} в месяц", formatMoney(info.monthly, { currency: goal.currency })) : st.text}</span>
      </div>
      {(open.length > 0 || (onOpen && !info.done)) && (
        <div className="relative mt-3 flex items-center gap-2">
          {open.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic();
                nav.push("project", { id: project!.id }, "planner");
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[8px] tile px-2.5 py-1.5 text-left text-caption"
            >
              <ListChecks size={13} className="shrink-0" />
              <span className="truncate">
                {pluralN(open.length, ["дело", "дела", "дел"])}: {open.slice(0, 3).map((t) => t.title.toLowerCase()).join(", ")}
              </span>
            </button>
          )}
          {onOpen && !info.done && (
            <button
              type="button"
              aria-label={tr("Пополнить «{0}»", goal.name)}
              onClick={(e) => {
                e.stopPropagation();
                haptic();
                nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" });
              }}
              className="ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-[12px] fill-accent px-3 text-footnote font-semibold text-[var(--accent-on)] active:opacity-80"
            >
              <Plus size={14} strokeWidth={2.4} />
              {tr("Пополнить")}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
