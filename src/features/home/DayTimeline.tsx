import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { formatMoney } from "../../lib/money";
import { haptic } from "../../lib/haptics";
import { useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { tr } from "../../i18n/i18n";

const START = 6; // the strip runs from 6:00 …
const END = 24; // … to midnight, wider if something happened outside

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

interface Mark {
  id: string;
  at: number; // minutes since midnight
  kind: "expense" | "income" | "task";
  done?: boolean;
  label: string;
  size: number;
}

/**
 * «Лента дня»: today from morning to night on one line. Spending and income
 * sit above it — the bigger the amount, the bigger the dot — and tasks with
 * a time sit below, filled once done. A red tick marks now. Tap a mark to
 * open it.
 */
export function DayTimeline() {
  const today = useToday();
  const { entries } = useLedger();
  const tasks = useData((s) => s.tasks);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const marks = useMemo(() => {
    const out: Mark[] = [];
    const money = entries.filter((e) => e.day === today && (e.tx.kind === "expense" || e.tx.kind === "income"));
    const max = Math.max(1, ...money.map((e) => e.base));
    for (const e of money) {
      out.push({
        id: e.tx.id,
        at: minutesOf(e.tx.date.slice(11, 16) || "12:00"),
        kind: e.tx.kind as "expense" | "income",
        label: `${e.tx.note || (e.tx.kind === "income" ? tr("Доход") : tr("Расход"))} · ${formatMoney(e.base)}`,
        size: 4 + Math.sqrt(e.base / max) * 5
      });
    }
    for (const t of tasks) {
      if (t.due !== today || !t.time) continue;
      out.push({ id: t.id, at: minutesOf(t.time), kind: "task", done: t.done, label: `${t.title} · ${t.time}`, size: 5 });
    }
    return out;
  }, [entries, tasks, today]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const from = Math.min(START * 60, ...marks.map((m) => Math.floor(m.at / 60) * 60), Math.floor(nowMin / 60) * 60);
  const to = END * 60;
  const pos = (m: number) => `${((Math.max(from, Math.min(to, m)) - from) / (to - from)) * 100}%`;
  const hours: number[] = [];
  for (let h = Math.ceil(from / 60); h <= END; h += 3) hours.push(h);

  return (
    <section aria-label={tr("Лента дня")} className="mx-4 mt-6">
      <div className="flex items-baseline justify-between px-1 pb-2">
        <span className="section-label">{tr("Лента дня")}</span>
        <span className="text-caption text-ink-3">
          {marks.length ? tr("Событий: {0}", marks.length) : tr("Пока пусто — запишите первое")}
        </span>
      </div>
      <div className="panel relative h-[92px] rounded-[20px] px-4">
        <div className="absolute inset-x-4 top-[42px]">
          {/* passed part of the day solid, the rest dashed */}
          <div className="absolute inset-x-0 h-px border-t border-dashed border-[var(--line-strong)]" />
          <div className="absolute left-0 h-[2px] -translate-y-[0.5px] rounded-full bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]" style={{ width: pos(nowMin) }} />
          {/* now */}
          <div className="absolute -top-[9px] h-[18px] w-[2px] -translate-x-1/2 rounded-full bg-accent" style={{ left: pos(nowMin) }} />
          {marks.map((m, i) => (
            <motion.button
              key={m.id}
              type="button"
              aria-label={m.label}
              onClick={() => {
                haptic();
                if (m.kind === "task") nav.sheet("task", { editId: m.id });
                else nav.sheet("tx", { id: m.id });
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.04, type: "spring", stiffness: 420, damping: 22 }}
              className="absolute grid h-7 w-7 -translate-x-1/2 place-items-center"
              style={{ left: pos(m.at), top: m.kind === "task" ? 4 : -32 }}
            >
              <span
                className={cn("block", m.kind === "task" ? "rounded-[4px]" : "rounded-full")}
                style={{
                  width: m.size * 2,
                  height: m.size * 2,
                  background: m.kind === "expense" ? "var(--accent)" : m.kind === "income" ? "var(--positive)" : m.done ? "var(--ink)" : "transparent",
                  boxShadow: m.kind === "task" && !m.done ? "inset 0 0 0 1.5px var(--ink-2)" : undefined
                }}
              />
            </motion.button>
          ))}
        </div>
        {/* hours */}
        <div className="absolute inset-x-4 bottom-2.5 h-3">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 text-[10px] font-medium tabular-nums text-ink-3" style={{ left: pos(h * 60) }}>
              {String(h % 24).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
