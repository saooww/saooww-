import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { eachDay, formatDayHeading, parseDay, weekdayIndex, WEEKDAYS_SHORT, type DayKey } from "../../lib/dates";
import type { LedgerEntry } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { formatMoney } from "../../lib/money";
import type { Category, ID } from "../../store/types";

/**
 * A month of spending at a glance: each day a square, deeper accent for
 * bigger days. Tap a day for its total and main categories.
 */
export function SpendingCalendar({ entries, from, to, today, categories, currency }: { entries: LedgerEntry[]; from: DayKey; to: DayKey; today: DayKey; categories: Map<ID, Category>; currency: string }) {
  const [selected, setSelected] = useState<DayKey | null>(null);
  const { days, max, byDay } = useMemo(() => {
    const sums = new Map<DayKey, number>();
    const cats = new Map<DayKey, Map<string, number>>();
    for (const e of entries) {
      if (e.tx.kind !== "expense" || e.day < from || e.day > to) continue;
      sums.set(e.day, (sums.get(e.day) ?? 0) + e.base);
      const m = cats.get(e.day) ?? new Map<string, number>();
      const k = e.tx.categoryId ?? "none";
      m.set(k, (m.get(k) ?? 0) + e.base);
      cats.set(e.day, m);
    }
    return { days: eachDay(from, to), max: Math.max(1, ...sums.values()), byDay: { sums, cats } };
  }, [entries, from, to]);

  const lead = weekdayIndex(from);
  const sel = selected ?? (today >= from && today <= to ? today : null);
  const selSum = sel ? byDay.sums.get(sel) ?? 0 : 0;
  const selCats = sel
    ? [...(byDay.cats.get(sel) ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => categories.get(id)?.name ?? "Без категории")
    : [];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-center text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-3">
            {w}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {days.map((d, i) => {
          const v = byDay.sums.get(d) ?? 0;
          const future = d > today;
          const k = v ? Math.sqrt(v / max) : 0;
          const strong = k > 0.55;
          return (
            <motion.button
              key={d}
              type="button"
              aria-label={`${formatDayHeading(d)}: ${v ? formatMoney(v, { currency }) : "без трат"}`}
              aria-pressed={sel === d}
              disabled={future}
              onClick={() => {
                haptic();
                setSelected(d);
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(0.5, i * 0.012), duration: 0.3 }}
              className={cn("num relative grid aspect-square place-items-center rounded-[9px] text-[12px] font-medium", future ? "text-ink-4" : strong ? "text-[var(--accent-on)]" : "text-ink-2")}
              style={{
                background: future ? "transparent" : v ? `color-mix(in srgb, var(--accent) ${Math.round(14 + 78 * k)}%, transparent)` : "color-mix(in srgb, var(--ink) 4.5%, transparent)",
                outline: sel === d ? "2px solid var(--ink)" : d === today ? "1px solid var(--ink-3)" : undefined,
                outlineOffset: sel === d ? 1.5 : 0
              }}
            >
              {parseDay(d).getDate()}
            </motion.button>
          );
        })}
      </div>
      <div className="mt-3 flex min-h-[40px] items-center justify-between gap-3">
        <div className="min-w-0 text-footnote">
          {sel ? (
            <>
              <div className="font-medium text-ink">{formatDayHeading(sel)}</div>
              <div className="truncate text-ink-2">{selSum ? `${formatMoney(selSum, { currency })} · ${selCats.join(", ")}` : "Без трат"}</div>
            </>
          ) : (
            <span className="text-ink-3">Коснитесь дня</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[10.5px] text-ink-3" aria-hidden="true">
          меньше
          {[0.2, 0.45, 0.7, 1].map((k) => (
            <span key={k} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(14 + 78 * k)}%, transparent)` }} />
          ))}
          больше
        </div>
      </div>
    </div>
  );
}
