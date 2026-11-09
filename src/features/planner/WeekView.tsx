import { useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Plus } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_GEN, WEEKDAYS_LONG, WEEKDAYS_SHORT, addDays, capitalize, parseDay, startOfWeek, weekdayIndex, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { compareTasks } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Task } from "../../store/types";
import { nav } from "../../store/ui";
import { Group, IconButton } from "../../ui/primitives";
import { EventRow, useEvents, type CalEvent } from "../plans/Plans";
import { useLingering } from "./actions";
import { TaskList } from "./TaskRow";
import { tr } from "../../i18n/i18n";

function rangeTitle(from: DayKey, to: DayKey): string {
  const a = parseDay(from);
  const b = parseDay(to);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]}`;
}

export function WeekView() {
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const keep = useLingering();
  const [offset, setOffset] = useState(0);
  const from = addDays(startOfWeek(today), offset * 7);
  const to = addDays(from, 6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const events = useEvents(from, to);

  const byDay = useMemo(() => {
    const m = new Map<DayKey, { open: Task[]; done: Task[]; money: CalEvent[] }>();
    for (const d of days) m.set(d, { open: [], done: [], money: [] });
    for (const t of tasks) {
      if (!t.due) continue;
      const slot = m.get(t.due);
      if (!slot) continue;
      if (!t.done || keep.has(t.id)) slot.open.push(t);
      else slot.done.push(t);
    }
    for (const e of events) if (e.kind !== "task") m.get(e.date)?.money.push(e);
    for (const v of m.values()) v.open.sort(compareTasks);
    return m;
  }, [tasks, keep, days, events]);

  const label = offset === 0 ? tr("Эта неделя") : offset === 1 ? tr("Следующая неделя") : offset === -1 ? tr("Прошлая неделя") : "";
  const max = Math.max(1, ...days.map((d) => byDay.get(d)!.open.length + byDay.get(d)!.done.length));

  const jump = (d: DayKey) => {
    haptic();
    document.getElementById(`wk-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <div className="flex items-center justify-between px-3">
        <IconButton icon={ChevronLeft} label={tr("Предыдущая неделя")} variant="plain" onClick={() => setOffset((o) => o - 1)} />
        <button type="button" onClick={() => setOffset(0)} className="text-center" aria-label={tr("К этой неделе")}>
          <div className="text-headline font-semibold">{rangeTitle(from, to)}</div>
          <div className="h-4 text-caption text-ink-3">{label}</div>
        </button>
        <IconButton icon={ChevronRight} label={tr("Следующая неделя")} variant="plain" onClick={() => setOffset((o) => o + 1)} />
      </div>

      {/* load of each day */}
      <div className="mt-3 grid grid-cols-7 gap-1.5 px-4">
        {days.map((d, i) => {
          const slot = byDay.get(d)!;
          const n = slot.open.length + slot.done.length;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => jump(d)}
              aria-label={tr("{0}: {1} дел", capitalize(WEEKDAYS_LONG[i]), n)}
              className={cn("flex flex-col items-center gap-1.5 rounded-[14px] pb-2 pt-2 transition-colors", isToday ? "tile" : "active:bg-surface-3")}
            >
              <span className={cn("text-caption font-medium", isToday ? "text-accent-ink" : "text-ink-3")}>{WEEKDAYS_SHORT[i]}</span>
              <span className={cn("num text-headline", d < today ? "text-ink-3" : "text-ink")}>{parseDay(d).getDate()}</span>
              <span className="flex h-7 w-2 flex-col justify-end overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                <span className="w-full rounded-full transition-[height] duration-300" style={{ height: `${(n / max) * 100}%`, background: slot.open.length ? "var(--ink-2)" : "var(--positive)" }} />
              </span>
            </button>
          );
        })}
      </div>

      {/* past weeks and the one now ending can be looked back on */}
      {from <= today && (
        <div className="mt-3 px-4">
          <button type="button" onClick={() => nav.sheet("weekReview", { from })} className="tile flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-subhead font-semibold text-ink active:opacity-80">
            <CalendarCheck size={17} strokeWidth={2} className="text-accent-ink" />{tr("Итоги недели")}</button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {days.map((d) => {
          const slot = byDay.get(d)!;
          const past = d < today;
          const isToday = d === today;
          const dd = parseDay(d);
          return (
            <section key={d} id={`wk-${d}`} style={{ scrollMarginTop: "calc(var(--safe-top) + 64px)" }}>
              <div className="flex items-center justify-between px-5 pb-2.5">
                <h3 className={cn("text-headline font-semibold", past && "text-ink-2")}>
                  {isToday ? tr("Сегодня") : capitalize(WEEKDAYS_LONG[weekdayIndex(d)])}
                  <span className="ml-1.5 font-normal text-ink-3">
                    {dd.getDate()} {MONTHS_GEN[dd.getMonth()]}
                  </span>
                </h3>
                {!past && (
                  <IconButton icon={Plus} label={tr("Дело на {0} {1}", dd.getDate(), MONTHS_GEN[dd.getMonth()])} size={30} onClick={() => nav.sheet("quickAdd", { due: d })} />
                )}
              </div>
              {slot.open.length + slot.done.length === 0 ? (
                <div className="mx-4 rounded-lg border border-dashed border-line px-4 py-3 text-subhead text-ink-3">{past ? tr("Ничего не было") : tr("Свободно")}</div>
              ) : (
                <TaskList tasks={[...slot.open, ...slot.done]} showDate={false} />
              )}
              {slot.money.length > 0 && (
                <Group className="mt-2">
                  {slot.money.map((e) => (
                    <EventRow key={e.key} e={e} hideDate />
                  ))}
                </Group>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
