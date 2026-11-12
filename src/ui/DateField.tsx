import { CalendarDays } from "./glyphs";
import { cn } from "../lib/cn";
import { formatDate, WEEKDAYS_SHORT, weekdayIndex, type DayKey } from "../lib/dates";

/**
 * A date that reads like a date — «8 ноя, пн» — and opens the system picker
 * on tap. The native input lies over the label, invisible, so the phone's own
 * wheel or calendar is used and keyboard / screen readers keep working.
 */
export function DateField({ value, onChange, label, min, max, className }: { value: DayKey; onChange: (d: DayKey) => void; label: string; min?: DayKey; max?: DayKey; className?: string }) {
  return (
    <span className={cn("relative flex h-9 min-w-0 items-center gap-1.5 rounded-[12px] px-2.5 tile", className)}>
      <CalendarDays size={15} className="shrink-0 text-ink-3" />
      <span className="min-w-0 truncate text-subhead font-semibold">
        {value ? `${formatDate(value, { year: "auto" })}, ${WEEKDAYS_SHORT[weekdayIndex(value)]}` : "—"}
      </span>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
