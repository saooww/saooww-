import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { MONTHS_SHORT_NOM, startOfMonth } from "../../lib/dates";
import { formatCompact } from "../../lib/money";
import { haptic } from "../../lib/haptics";
import { useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { tr } from "../../i18n/i18n";

/**
 * Months as stories, the way social apps show them: a row of rings, this
 * month first in the accent colour. Each opens the full-screen «Итоги».
 */
export function StoryRow() {
  const { entries } = useLedger();
  const today = useToday();
  const months = useMemo(() => {
    const net = new Map<string, number>();
    for (const e of entries) {
      if (e.tx.kind !== "expense" && e.tx.kind !== "income") continue;
      const m = startOfMonth(e.day);
      net.set(m, (net.get(m) ?? 0) + (e.tx.kind === "income" ? e.base : -e.base));
    }
    return [...net.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 8);
  }, [entries]);
  if (!months.length) return null;
  const current = startOfMonth(today);

  return (
    <div className="scroll-x -mt-1 mb-4 flex gap-3.5 px-4 pb-1" role="list" aria-label={tr("Истории месяцев")}>
      {months.map(([m, net], i) => {
        const fresh = m === current;
        const month = Number(m.slice(5, 7)) - 1;
        return (
          <motion.button
            key={m}
            role="listitem"
            type="button"
            aria-label={tr("Итоги: {0}", `${MONTHS_SHORT_NOM[month]} ${m.slice(0, 4)}`)}
            onClick={() => {
              haptic();
              nav.story(m);
            }}
            whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 420, damping: 26 }}
            className="flex w-[64px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className={cn("grid h-[62px] w-[62px] place-items-center rounded-full p-[2.5px]", fresh ? "bg-accent" : "bg-[var(--line-strong)]")}>
              <span className="grid h-full w-full place-items-center rounded-full border-[2.5px] border-[var(--bg)] bg-surface">
                <span className="text-callout font-semibold capitalize text-ink">{MONTHS_SHORT_NOM[month]}</span>
              </span>
            </span>
            <span className={cn("num text-caption", net >= 0 ? "text-positive" : "text-ink-2")}>
              {net >= 0 ? "+" : "−"}
              {formatCompact(Math.abs(net))}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
