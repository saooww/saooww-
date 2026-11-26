import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "../../ui/glyphs";
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
  const [open, setOpen] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<DayKey, string[]>();
    for (const t of tasks) if (t.due && !t.done) m.set(t.due, [...(m.get(t.due) ?? []), t.title]);
    return m;
  }, [tasks]);
  const counts = useMemo(() => new Map([...byDay].map(([d, l]) => [d, l.length])), [byDay]);
  const days = useMemo(() => {
    if (!open) {
      const w = startOfWeek(today);
      return Array.from({ length: 7 }, (_, i) => addDays(w, i));
    }
    const from = startOfWeek(month);
    const to = addDays(startOfWeek(endOfMonth(month)), 6);
    const out: DayKey[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month, open, today]);
  const list = useMemo(() => (picked ? tasks.filter((t) => t.due === picked && !t.done).sort(compareTasks) : []), [tasks, picked]);
  const m = parseDay(month);

  return (
    <section className="px-4">
      <div className="panel rounded-[22px] px-3 pb-2 pt-2.5">
        <div className="flex items-center justify-between px-1">
          {open ? (
            <button type="button" aria-label={tr("Предыдущий месяц")} onClick={() => setMonth((x) => addMonths(x, -1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press">
              <ChevronLeft size={18} />
            </button>
          ) : (
            <span className="h-8 w-8" />
          )}
          <button type="button" onClick={() => setMonth(startOfMonth(today))} className="text-headline font-semibold">
            {capitalize(MONTHS_NOM[m.getMonth()])} {m.getFullYear() !== parseDay(today).getFullYear() ? m.getFullYear() : ""}
          </button>
          {open ? (
            <button type="button" aria-label={tr("Следующий месяц")} onClick={() => setMonth((x) => addMonths(x, 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press">
              <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" aria-label={tr("Показать месяц")} aria-expanded={false} onClick={() => setOpen(true)} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press">
              <ChevronDown size={18} />
            </button>
          )}
        </div>
        <div className={cn("mt-1.5 grid grid-cols-7 text-center", open && "lg:gap-1.5")}>
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
            const names = byDay.get(d) ?? [];
            return (
              <button
                key={d}
                type="button"
                aria-label={tr("{0}: {1} дел", formatDayHeading(d), n)}
                onClick={() => {
                  haptic();
                  setPicked((p) => (p === d ? null : d));
                }}
                className={cn("relative grid place-items-center", open ? "h-10 lg:block lg:h-[92px] lg:rounded-[14px] lg:p-2 lg:text-left" : "h-10")}
                style={open ? ({ ["--tp" as string]: isToday ? "var(--pastel-pink)" : n > 0 ? "var(--pastel-lilac)" : undefined } as React.CSSProperties) : undefined}
              >
                {open && <span aria-hidden className={cn("absolute inset-0 hidden rounded-[14px] lg:block", isToday || n > 0 ? "tile-pastel" : "tile", isPicked && "ring-1 ring-[var(--plan)]", !inMonth && "opacity-40")} style={{ ["--tp" as string]: isToday ? "var(--pastel-pink)" : n > 0 ? "var(--pastel-lilac)" : undefined }} />}
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-callout tabular-nums transition-colors",
                    open && "lg:relative lg:h-6 lg:w-auto lg:place-items-start lg:justify-start lg:text-[15px] lg:font-semibold",
                    isToday ? "bg-[var(--plan)] font-bold text-white shadow-[0_6px_16px_-6px_var(--plan)] lg:bg-transparent lg:text-[var(--pastel-ink)] lg:shadow-none" : isPicked ? "bg-[color-mix(in_srgb,var(--ink)_14%,transparent)] font-semibold" : "",
                    !inMonth && "opacity-30",
                    d < today && !isToday && inMonth && "text-ink-2"
                  )}
                >
                  {parseDay(d).getDate()}
                </span>
                {open && names.length > 0 && (
                  <span className="relative mt-1 hidden min-w-0 flex-col gap-0.5 lg:flex">
                    {names.slice(0, 2).map((x, k) => (
                      <span key={k} className="truncate rounded-[6px] bg-[color-mix(in_srgb,var(--pastel-ink)_10%,transparent)] px-1.5 py-[1px] text-[11px] leading-[15px]">{x}</span>
                    ))}
                    {names.length > 2 && <span className="px-1 text-[11px] text-[var(--pastel-ink-2)]">+{names.length - 2}</span>}
                  </span>
                )}
                {n > 0 && !isToday && <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--plan)]", open && "lg:hidden")} />}
              </button>
            );
          })}
        </div>
        {open && (
          <button type="button" aria-label={tr("Свернуть месяц")} onClick={() => { setOpen(false); setMonth(startOfMonth(today)); }} className="mx-auto mt-1 grid h-6 w-12 place-items-center rounded-full text-ink-3 active:bg-surface-press">
            <ChevronDown size={16} className="rotate-180" />
          </button>
        )}
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
