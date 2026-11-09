import { motion } from "framer-motion";
import { Check, ListChecks, Plus, Star } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { formatDate, pluralN } from "../../lib/dates";
import type { GoalInfo } from "../../lib/finance";
import type { GoalStatus } from "../../lib/goals";
import { goalStatusText } from "../../lib/goals";
import { formatMoney } from "../../lib/money";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import type { Goal } from "../../store/types";
import { nav } from "../../store/ui";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { tr } from "../../i18n/i18n";

const SEGMENTS = 24;

/**
 * A goal as a card in its own colour: the share saved in large figures,
 * progress as a row of segments, the deadline and the monthly amount, and
 * the open tasks of its list. Used in the list (tap to open) and, larger, on
 * the goal's own screen.
 */
export function GoalVisual({ goal, info, status, onOpen, big, delay = 0 }: { goal: Goal; info: GoalInfo; status: GoalStatus; onOpen?: () => void; big?: boolean; delay?: number }) {
  const color = info.done ? "#2e9d72" : goal.color ?? "#df0714";
  const st = goalStatusText(status, goal.currency);
  const tasks = useData((s) => s.tasks);
  const project = useData((s) => (goal.projectId ? s.projects.find((p) => p.id === goal.projectId) : undefined));
  const open = project ? tasks.filter((t) => t.projectId === project.id && !t.done) : [];
  const filled = Math.round(info.progress * SEGMENTS);

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
      className={cn("relative overflow-hidden rounded-[24px] text-white", onOpen && "cursor-pointer", big ? "px-5 pb-5 pt-5" : "px-[18px] pb-4 pt-4")}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(90% 70% at 100% 100%, rgba(0,0,0,0.35), transparent 70%), linear-gradient(150deg, ${color}, color-mix(in srgb, ${color} 34%, #050505))`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.12) inset, 0 24px 44px -26px color-mix(in srgb, ${color} 70%, transparent)`
      }}
    >
      {/* the goal's icon, large and faint, as a watermark */}
      <NamedIcon name={goal.icon} size={big ? 170 : 130} className="pointer-events-none absolute -bottom-6 -right-6 opacity-[0.12]" />
      <div className="relative flex items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate font-semibold", big ? "text-title-3" : "text-headline")}>{goal.name}</span>
        {goal.primary && <Star size={14} className="shrink-0 fill-current" />}
        <span className="shrink-0 rounded-full bg-black/25 px-2.5 py-0.5 text-caption font-semibold">{info.done ? tr("Достигнута") : st.tone === "warning" ? tr("отстаёт") : st.tone === "positive" ? tr("по плану") : tr("в пути")}</span>
      </div>
      <div className="relative mt-2.5 flex items-baseline justify-between gap-3">
        <span className={cn("num-display leading-none", big ? "text-[54px]" : "text-[40px]")}>
          {info.done ? <Check size={big ? 44 : 34} strokeWidth={2.4} /> : `${Math.floor(info.progress * 100)}%`}
        </span>
        <span className="text-right text-footnote text-white/80">
          <Money value={info.saved} currency={goal.currency} privacy className="font-semibold text-white" /> {tr("из")} <Money value={goal.target} currency={goal.currency} />
        </span>
      </div>
      <div className="relative mt-3 flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <motion.span
            key={i}
            className="h-[7px] flex-1 rounded-[2px]"
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.15 + i * 0.015 }}
            style={{ background: i < filled ? "#ffffff" : "rgba(255,255,255,0.2)" }}
          />
        ))}
      </div>
      <div className="relative mt-2.5 flex items-center justify-between text-caption text-white/80">
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
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[10px] bg-black/25 px-2.5 py-1.5 text-left text-caption"
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
              className="ml-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-footnote font-semibold text-black active:opacity-80"
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
