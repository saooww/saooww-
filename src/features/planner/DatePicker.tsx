import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays, addMonths, endOfMonth, formatDayHeading, monthTitle, parseDay, startOfMonth, startOfWeek, WEEKDAYS_SHORT, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { QUICK_DATE_LABEL, quickDate, type QuickDate } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { Chip, FormRow, Group, IconButton, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

export interface DatePickerProps {
  title?: string;
  value?: DayKey;
  time?: string;
  /** Offer a time too; then «Готово» confirms */
  withTime?: boolean;
  /** Offer «Без даты» */
  allowNone?: boolean;
  onPick: (due: DayKey | undefined, time?: string) => void;
}

export function DatePickerSheet({ title = "Когда", value, time: time0, withTime, allowNone = true, onPick }: DatePickerProps) {
  const { close } = useSheet();
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const [day, setDay] = useState<DayKey | undefined>(value);
  const [hasTime, setHasTime] = useState(!!time0);
  const [time, setTime] = useState(time0 ?? "09:00");
  const [month, setMonth] = useState(startOfMonth(value ?? today));
  const [dir, setDir] = useState(1);

  const commit = (d: DayKey | undefined) => {
    haptic();
    if (withTime) {
      setDay(d);
      if (d) setMonth(startOfMonth(d));
      return;
    }
    onPick(d);
    close();
  };

  const load = new Map<DayKey, number>();
  for (const t of tasks) if (!t.done && t.due) load.set(t.due, (load.get(t.due) ?? 0) + 1);

  const from = startOfWeek(month);
  const to = addDays(startOfWeek(endOfMonth(month)), 6);
  const days: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  return (
    <Sheet
      title={title}
      left={withTime ? <SheetAction onClick={close}>Отмена</SheetAction> : undefined}
      right={
        withTime ? (
          <SheetAction
            strong
            onClick={() => {
              onPick(day, day && hasTime ? time : undefined);
              close();
            }}
          >
            Готово
          </SheetAction>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div className="scroll-x flex gap-2 px-4">
          {(["today", "tomorrow", "weekend", "nextweek"] as QuickDate[]).map((k) => {
            const d = quickDate(k, today);
            return (
              <Chip key={k} selected={day === d} onClick={() => commit(d)}>
                {QUICK_DATE_LABEL[k]}
              </Chip>
            );
          })}
          {allowNone && (
            <Chip selected={!day} onClick={() => commit(undefined)}>
              Без даты
            </Chip>
          )}
        </div>

        <div className="mx-4 panel rounded-xl p-3">
          <div className="flex items-center justify-between px-1">
            <IconButton icon={ChevronLeft} label="Предыдущий месяц" variant="plain" onClick={() => { setDir(-1); setMonth(addMonths(month, -1, 1)); }} />
            <div className="text-headline font-semibold">{monthTitle(month)}</div>
            <IconButton icon={ChevronRight} label="Следующий месяц" variant="plain" onClick={() => { setDir(1); setMonth(addMonths(month, 1, 1)); }} />
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-caption font-medium text-ink-3">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={month}
              initial={{ opacity: 0, x: dir * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -36 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-7 gap-y-1"
            >
              {days.map((d) => {
                const inMonth = d.slice(0, 7) === month.slice(0, 7);
                const sel = d === day;
                const past = d < today;
                const n = load.get(d) ?? 0;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    onClick={() => commit(d)}
                    aria-label={`${formatDayHeading(d)}${n ? `, дел: ${n}` : ""}`}
                    aria-pressed={sel}
                    className="flex h-11 flex-col items-center justify-center gap-[3px] disabled:opacity-30"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-full text-callout tnum transition-colors", sel ? "bg-ink font-semibold text-ink-inverse" : d === today ? "font-semibold text-accent-ink" : inMonth ? "text-ink" : "text-ink-4")}>
                      {parseDay(d).getDate()}
                    </span>
                    <span className="flex h-1 gap-[2px]">
                      {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                        <span key={i} className="h-1 w-1 rounded-full bg-ink-3" />
                      ))}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {withTime && (
          <Group footer={day ? undefined : "Время можно указать, когда выбран день."}>
            <FormRow label="Время">
              <Toggle checked={hasTime && !!day} disabled={!day} onChange={setHasTime} label="Время" />
            </FormRow>
            {hasTime && day && (
              <FormRow label="Во сколько">
                <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={cn(inputCls, "num text-right")} />
              </FormRow>
            )}
          </Group>
        )}
      </div>
    </Sheet>
  );
}
