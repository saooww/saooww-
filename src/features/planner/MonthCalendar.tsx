import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_NOM, WEEKDAYS_SHORT, addDays, addMonths, capitalize, endOfMonth, formatDayHeading, parseDay, startOfMonth, startOfWeek, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { compareTasks } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { TaskList } from "./TaskRow";
import { tr } from "../../i18n/i18n";

/**
 * The month on one card: today in a red circle, a dot under every day with
 * tasks. Tap a day to see its tasks right below.
 */
export function MonthCalendar() {
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const [month, setMonth] = useState(startOfMonth(today));
  const [picked, setPicked] = useState<DayKey | null>(null);

  const counts = useMemo(() => {
    const m = new Map<DayKey, number>();
    for (const t of tasks) if (t.due && !t.done) m.set(t.due, (m.get(t.due) ?? 0) + 1);
    return m;
  }, [tasks]);
  const days = useMemo(() => {
    const from = startOfWeek(month);
    const to = addDays(startOfWeek(endOfMonth(month)), 6);
    const out: DayKey[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);
  const list = useMemo(() => (picked ? tasks.filter((t) => t.due === picked && !t.done).sort(compareTasks) : []), [tasks, picked]);
  const m = parseDay(month);

  return (
    <section className="px-4">
      <div className="panel rounded-[24px] px-3 pb-3 pt-3">
        <div className="flex items-center justify-between px-1">
          <button type="button" aria-label={tr("Предыдущий месяц")} onClick={() => setMonth((x) => addMonths(x, -1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setMonth(startOfMonth(today))} className="text-headline font-semibold">
            {capitalize(MONTHS_NOM[m.getMonth()])} {m.getFullYear() !== parseDay(today).getFullYear() ? m.getFullYear() : ""}
          </button>
          <button type="button" aria-label={tr("Следующий месяц")} onClick={() => setMonth((x) => addMonths(x, 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center">
          {WEEKDAYS_SHORT.map((w) => (
            <span key={w} className="pb-1 text-[11px] font-medium capitalize text-ink-3">
              {w}
            </span>
          ))}
          {days.map((d) => {
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const isToday = d === today;
            const isPicked = d === picked;
            const n = counts.get(d) ?? 0;
            return (
              <button
                key={d}
                type="button"
                aria-label={tr("{0}: {1} дел", formatDayHeading(d), n)}
                onClick={() => {
                  haptic();
                  setPicked((p) => (p === d ? null : d));
                }}
                className="relative grid h-10 place-items-center"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-callout tabular-nums transition-colors",
                    isToday ? "fill-accent font-bold text-[var(--accent-on)]" : isPicked ? "bg-[color-mix(in_srgb,var(--ink)_14%,transparent)] font-semibold" : "",
                    !inMonth && "opacity-30",
                    d < today && !isToday && inMonth && "text-ink-2"
                  )}
                >
                  {parseDay(d).getDate()}
                </span>
                {n > 0 && !isToday && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {picked && (
          <motion.div key={picked} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="-mx-4 overflow-hidden">
            <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
              <span className="text-headline font-semibold">{capitalize(formatDayHeading(picked))}</span>
              <button type="button" onClick={() => nav.sheet("quickAdd", { due: picked })} className="text-footnote font-medium text-accent-ink">
                {tr("Записать дело")}
              </button>
            </div>
            <TaskList tasks={list} empty={<div className="mx-4 rounded-lg px-4 py-3 text-footnote text-ink-2">{tr("В этот день дел нет")}</div>} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
