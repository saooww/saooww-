import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import type { Task } from "../../store/types";
import { Heading } from "./bits";
import { tr } from "../../i18n/i18n";

const HOUR = 38; // px per hour
const SNAP = 15; // minutes
const BLOCK = 36; // height of a task, px

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * «Расписание»: today's tasks with a time, on an hour grid. Drag a task up or
 * down to move it — it snaps to a quarter of an hour; tap to open it.
 */
export function Schedule() {
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const timed = useMemo(() => tasks.filter((t) => t.due === today && t.time).sort((a, b) => a.time!.localeCompare(b.time!)), [tasks, today]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!timed.length) return null;

  const first = toMin(timed[0].time!);
  const last = toMin(timed[timed.length - 1].time!);
  const from = Math.max(0, Math.min(Math.floor(first / 60) - 1, 8)) * 60;
  const to = Math.min(24, Math.max(Math.ceil(last / 60) + 2, Math.floor(from / 60) + 7)) * 60;
  const y = (min: number) => ((min - from) / 60) * HOUR;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // tasks that would overlap share the width
  const cols = new Map<string, { col: number; of: number }>();
  let group: Task[] = [];
  const flush = () => group.forEach((t, i) => cols.set(t.id, { col: i, of: group.length }));
  for (const t of timed) {
    if (group.length && toMin(t.time!) - toMin(group[group.length - 1].time!) >= (BLOCK / HOUR) * 60) {
      flush();
      group = [];
    }
    group.push(t);
  }
  flush();

  return (
    <section>
      <Heading title={tr("Расписание")} aside={tr("перетащите, чтобы перенести")} />
      <div className="panel relative mx-4 overflow-hidden rounded-[20px]" style={{ height: y(to) + 12 }}>
        {Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from / 60 + i).map((h) => (
          <div key={h} className="absolute inset-x-0 flex items-center gap-2 pl-3 pr-3" style={{ top: y(h * 60) + 6 }}>
            <span className="w-8 -translate-y-[1px] text-[10.5px] font-medium tabular-nums text-ink-3">{String(h % 24).padStart(2, "0")}:00</span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
        ))}
        {nowMin >= from && nowMin <= to && (
          <div className="pointer-events-none absolute left-11 right-3 z-10 flex items-center" style={{ top: y(nowMin) + 6 }}>
            <span className="h-2 w-2 -translate-x-1 rounded-full bg-accent" />
            <span className="h-[1.5px] flex-1 bg-accent" />
          </div>
        )}
        {timed.map((t) => (
          <Block key={t.id} task={t} top={y(toMin(t.time!)) + 6} from={from} to={to} slot={cols.get(t.id)!} now={!t.done && nowMin >= toMin(t.time!) && nowMin < toMin(t.time!) + 60} />
        ))}
      </div>
    </section>
  );
}

function Block({ task, top, from, to, slot, now }: { task: Task; top: number; from: number; to: number; slot: { col: number; of: number }; /** Happening now: filled with the accent */ now?: boolean }) {
  const dy = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  // a drag ends with a click event too; it must not open the task
  const moved = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const at = toMin(task.time!);
  const shift = (offset: number) => Math.max(from, Math.min(to - SNAP, Math.round((at + (offset / HOUR) * 60) / SNAP) * SNAP));

  return (
    <motion.button
      type="button"
      aria-label={tr("{0}, {1}", task.title, task.time!)}
      drag="y"
      dragMomentum={false}
      dragElastic={0}
      style={{ y: dy, top, left: `calc(56px + (100% - 68px) * ${slot.col / slot.of})`, width: `calc((100% - 68px) / ${slot.of} - 4px)`, height: BLOCK - 4 }}
      onDragStart={() => {
        moved.current = true;
        setDragging(true);
        haptic();
      }}
      onDrag={(_, info) => setPreview(toTime(shift(info.offset.y)))}
      onDragEnd={(_, info) => {
        const next = shift(info.offset.y);
        setDragging(false);
        setPreview(null);
        if (toTime(next) !== task.time) {
          useData.getState().updateTask(task.id, { time: toTime(next) });
          haptic("success");
        }
        dy.set(0);
      }}
      onClick={() => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        nav.sheet("task", { editId: task.id });
      }}
      whileDrag={{ scale: 1.03, zIndex: 20 }}
      className={cn(
        "absolute z-[5] flex touch-none flex-col justify-center overflow-hidden rounded-[12px] pl-3 pr-2 text-left",
        task.done ? "bg-[var(--chart-grid)] opacity-60" : now ? "fill-accent text-[var(--accent-on)]" : "bg-accent-soft",
        dragging && "shadow-pop"
      )}
    >
      {!now && <span className="absolute inset-y-1.5 left-1 w-[3px] rounded-full bg-accent" />}
      <span className={cn("truncate text-subhead font-semibold", now ? "text-white" : "text-ink", task.done && "line-through")}>{task.title}</span>
      <span className={cn("text-caption tabular-nums", now ? "text-white/85" : "text-ink-2")}>{preview ?? task.time}</span>
    </motion.button>
  );
}
