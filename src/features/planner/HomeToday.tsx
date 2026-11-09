import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Plus, Sunrise } from "../../ui/glyphs";
import { pluralN } from "../../lib/dates";
import { dayPlan } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { useLingering } from "./actions";
import { Enso } from "./Enso";
import { TaskCheck } from "./TaskRow";
import { tr } from "../../i18n/i18n";

/** «Дела на сегодня» on the home screen: progress, the next three tasks, one tap to add. */
export function HomeToday() {
  const tasks = useData((s) => s.tasks);
  const planned = useData((s) => s.settings.dayPlannedOn);
  const keep = useLingering();
  const today = useToday();
  const plan = useMemo(() => dayPlan(tasks, today, keep), [tasks, today, keep]);
  const next = [...plan.focus.filter((t) => !t.done || keep.has(t.id)), ...plan.rest].slice(0, 3);
  const more = plan.total - plan.completed - next.filter((t) => !t.done).length;
  const allDone = plan.total > 0 && plan.completed === plan.total;

  return (
    <div className="panel mx-5 mt-3 overflow-hidden rounded-[20px]">
      <button type="button" onClick={() => nav.planner("today")} className="flex w-full items-center gap-3 px-3.5 pb-2 pt-3 text-left" aria-label={tr("Открыть дела на сегодня")}>
        <Enso value={plan.total ? plan.completed / plan.total : 0} complete={allDone} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-callout font-semibold text-ink">{tr("Дела на сегодня")}</span>
          <span className="block text-footnote text-ink-2">
            {plan.total === 0 ? tr("Пока ничего не запланировано") : allDone ? tr("Всё сделано") : tr("Сделано {0} из {1}", plan.completed, plan.total)}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-3" />
      </button>

      {next.length > 0 && (
        <div className="px-1">
          <AnimatePresence initial={false}>
            {next.map((t) => (
              <motion.div key={t.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="flex items-center gap-3 px-3 py-2">
                <TaskCheck task={t} seal={t.focus === today} size={22} />
                <button type="button" onClick={() => nav.sheet("task", { editId: t.id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={t.done ? "min-w-0 flex-1 truncate text-subhead text-ink-3 line-through" : "min-w-0 flex-1 truncate text-subhead text-ink"}>{t.title}</span>
                  {t.time && !t.done && <span className="num text-footnote text-ink-2">{t.time}</span>}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <button type="button" onClick={() => nav.sheet("quickAdd", { due: today })} className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-footnote font-semibold text-accent-ink active:bg-surface-3">
          <Plus size={15} strokeWidth={2.4} />{tr("Записать дело")}</button>
        {planned !== today && plan.total - plan.completed === 0 ? (
          <button type="button" onClick={() => nav.sheet("planDay", {})} className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-2.5 text-footnote font-medium text-ink-2 active:bg-surface-3">
            <Sunrise size={15} />{tr("Спланировать день")}</button>
        ) : more > 0 ? (
          <button type="button" onClick={() => nav.planner("today")} className="ml-auto h-9 rounded-full px-2.5 text-footnote font-medium text-ink-2 active:bg-surface-3">{tr("ещё")}{" "}{pluralN(more, ["дело", "дела", "дел"])}
          </button>
        ) : null}
      </div>
    </div>
  );
}
