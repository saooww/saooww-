import { memo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { AlignLeft, CalendarDays, ListChecks, Repeat, Sunrise, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { dueLabel } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Task } from "../../store/types";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { deleteTask, moveToTomorrow, toggleDone } from "./actions";

/* ------------------------------------------------------------------ */
/*  The check: a circle, or a square seal for the day's main things     */
/* ------------------------------------------------------------------ */

export function TaskCheck({ task, seal, size = 24, onToggle }: { task: Task; seal?: boolean; size?: number; onToggle?: () => void }) {
  const done = task.done;
  const urgent = task.priority === 2;
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Вернуть: ${task.title}` : `Сделано: ${task.title}`}
      whileTap={{ scale: 0.82 }}
      transition={spring.press}
      onClick={(e) => {
        e.stopPropagation();
        (onToggle ?? (() => toggleDone(task)))();
      }}
      className="relative -m-2 grid shrink-0 place-items-center p-2"
    >
      <span
        className={cn(
          "grid place-items-center border-[1.6px] transition-[background,border-color,box-shadow] duration-200",
          seal ? "rounded-[7px]" : "rounded-full",
          done ? (seal ? "fill-accent border-transparent" : "fill-positive border-transparent") : seal || urgent ? "border-accent" : task.priority === 1 ? "border-warning" : "border-ink-3"
        )}
        style={{ width: size, height: size, transform: seal ? "rotate(-4deg)" : undefined }}
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.svg key="tick" viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="white" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  Row                                                                */
/* ------------------------------------------------------------------ */

const ACTION_W = 78;

export interface TaskRowProps {
  task: Task;
  /** Show the due date (off inside a day's own list) */
  showDate?: boolean;
  /** Show the list name (off inside the list itself) */
  showList?: boolean;
  seal?: boolean;
  /** Swipe left for «Завтра» and «Удалить» */
  swipe?: boolean;
  onOpen?: (t: Task) => void;
}

export const TaskRow = memo(function TaskRow({ task, showDate = true, showList = true, seal, swipe = true, onOpen }: TaskRowProps) {
  const today = useToday();
  const project = useData((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId) : undefined));
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);
  const actions = task.done ? 1 : 2;
  const reveal = ACTION_W * actions;
  const actionsOpacity = useTransform(x, [-reveal, -24, 0], [1, 0.3, 0]);

  const settle = (to: number) => {
    setOpen(to !== 0);
    animate(x, to, spring.snappy);
  };

  const overdue = !task.done && !!task.due && task.due < today;
  const subs = task.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;
  const showDue = showDate && task.due && !(task.due === today && !overdue);
  const meta = showDue || (showList && project) || subs.length > 0 || task.repeat !== "none" || !!task.note;

  const body = (
    <div className={cn("flex min-h-[58px] w-full items-center gap-3 px-4", meta ? "py-2.5" : "py-2")}>
      <TaskCheck task={task} seal={seal} />
      <button
        type="button"
        onClick={() => {
          if (dragged.current) return;
          if (open) settle(0);
          else (onOpen ?? ((t: Task) => nav.sheet("task", { editId: t.id })))(task);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block text-body transition-colors duration-300", task.done ? "text-ink-3 line-through decoration-ink-3" : "text-ink")}>
            {task.priority > 0 && !task.done && <span className={cn("mr-1 font-semibold", task.priority === 2 ? "text-accent-ink" : "text-warning")}>{task.priority === 2 ? "!!" : "!"}</span>}
            {task.title}
          </span>
          {meta && !task.done && (
            <span className="mt-1 flex min-w-0 items-center gap-2.5 overflow-hidden text-footnote text-ink-2">
              {showDue && (
                <span className={cn("flex shrink-0 items-center gap-1", overdue && "text-negative")}>
                  <CalendarDays size={12} strokeWidth={2.1} />
                  {dueLabel(task.due!, today)}
                </span>
              )}
              {showList && project && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: project.color }} />
                  <span className="truncate">{project.name}</span>
                </span>
              )}
              {subs.length > 0 && (
                <span className="flex shrink-0 items-center gap-1 tnum">
                  <ListChecks size={12} strokeWidth={2.1} />
                  {subsDone}/{subs.length}
                </span>
              )}
              {task.repeat !== "none" && <Repeat size={12} strokeWidth={2.1} className="shrink-0" aria-label="Повторяется" />}
              {task.note && <AlignLeft size={12} strokeWidth={2.1} className="shrink-0" aria-label="Есть заметка" />}
            </span>
          )}
        </span>
        {task.time && !task.done && <span className={cn("num shrink-0 text-subhead", overdue ? "text-negative" : "text-ink-2")}>{task.time}</span>}
      </button>
    </div>
  );

  const row = !swipe ? (
    body
  ) : (
    <div className="relative overflow-hidden">
      <motion.div className="absolute inset-y-0 right-0 flex" style={{ opacity: actionsOpacity }}>
        {!task.done && (
          <button
            type="button"
            aria-label="Перенести на завтра"
            onClick={() => {
              settle(0);
              moveToTomorrow(task);
            }}
            className="flex flex-col items-center justify-center gap-1 bg-warning text-white"
            style={{ width: ACTION_W }}
          >
            <Sunrise size={18} />
            <span className="text-caption font-semibold">Завтра</span>
          </button>
        )}
        <button
          type="button"
          aria-label="Удалить дело"
          onClick={() => {
            settle(0);
            deleteTask(task);
          }}
          className="flex flex-col items-center justify-center gap-1 bg-negative text-white"
          style={{ width: ACTION_W }}
        >
          <Trash2 size={18} />
          <span className="text-caption font-semibold">Удалить</span>
        </button>
      </motion.div>
      <motion.div
        className="relative"
        style={{ x, touchAction: "pan-y", background: "var(--surface)" }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -reveal, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.04 }}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          settle(info.offset.x < -reveal / 2.5 || info.velocity.x < -400 ? -reveal : 0);
          window.setTimeout(() => (dragged.current = false), 80);
        }}
      >
        {body}
      </motion.div>
    </div>
  );

  return (
    <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }} transition={spring.smooth} className="overflow-hidden">
      {row}
    </motion.div>
  );
});

/** A rounded panel of task rows that animates rows in and out. */
export function TaskList({ tasks, empty, ...rowProps }: { tasks: Task[]; empty?: React.ReactNode } & Omit<TaskRowProps, "task">) {
  if (!tasks.length) return empty ? <>{empty}</> : null;
  return (
    <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} {...rowProps} />
        ))}
      </AnimatePresence>
    </div>
  );
}
