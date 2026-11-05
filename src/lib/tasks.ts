import type { ID, Project, Task, TaskRepeat } from "../store/types";
import { addDays, addMonths, dayOf, diffDays, eachDay, plural, weekdayIndex, type DayKey } from "./dates";

/* ------------------------------------------------------------------ */
/*  Repeats                                                            */
/* ------------------------------------------------------------------ */

/** The date after `date` on which a repeating task comes back. */
export function nextRepeatDate(date: DayKey, repeat: Exclude<TaskRepeat, "none">): DayKey {
  switch (repeat) {
    case "day":
      return addDays(date, 1);
    case "weekdays": {
      let d = addDays(date, 1);
      while (weekdayIndex(d) > 4) d = addDays(d, 1);
      return d;
    }
    case "week":
      return addDays(date, 7);
    case "month":
      return addMonths(date, 1);
    case "year":
      return addMonths(date, 12);
  }
}

/** Next occurrence after completing: never in the past. */
export function nextOccurrence(task: Pick<Task, "due" | "repeat">, today: DayKey): DayKey | undefined {
  if (task.repeat === "none") return undefined;
  let next = nextRepeatDate(task.due ?? today, task.repeat);
  let guard = 0;
  while (next <= today && guard++ < 1000) next = nextRepeatDate(next, task.repeat);
  return next;
}

export const REPEAT_LABEL: Record<TaskRepeat, string> = {
  none: "Не повторять",
  day: "Каждый день",
  weekdays: "По будням",
  week: "Каждую неделю",
  month: "Каждый месяц",
  year: "Каждый год"
};

/* ------------------------------------------------------------------ */
/*  Where a task belongs                                               */
/* ------------------------------------------------------------------ */

export const isInbox = (t: Task) => !t.done && !t.projectId && !t.due;
export const isOverdue = (t: Task, today: DayKey) => !t.done && !!t.due && t.due < today;
/** Open and meant for today: due today or picked as one of today's main things. */
export const isForToday = (t: Task, today: DayKey) => !t.done && (t.due === today || t.focus === today);
export const isFocus = (t: Task, today: DayKey) => t.focus === today && (!t.done || doneOn(t) === today);
export const doneOn = (t: Task): DayKey | undefined => (t.done && t.doneAt ? dayOf(t.doneAt) : undefined);

/** Order inside a day: timed first by time, then by priority, then oldest first. */
export function compareTasks(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time) || b.priority - a.priority;
  if (a.time) return -1;
  if (b.time) return 1;
  return b.priority - a.priority || a.createdAt.localeCompare(b.createdAt);
}

/** Order across days: by date, then as inside a day; tasks without a date last. */
export function compareByDue(a: Task, b: Task): number {
  return (a.due ?? "9999").localeCompare(b.due ?? "9999") || compareTasks(a, b);
}

export interface DayPlan {
  /** Up to three main things (open, or done today) */
  focus: Task[];
  /** Other open tasks for today */
  rest: Task[];
  overdue: Task[];
  /** Completed today */
  done: Task[];
  /** Done today out of everything planned for today */
  total: number;
  completed: number;
}

/**
 * Today at a glance. `keep` holds tasks just ticked off: they stay where
 * they were for a moment, so the tick can be seen before the row leaves.
 */
export function dayPlan(tasks: Task[], today: DayKey, keep?: ReadonlySet<ID>): DayPlan {
  const open = (t: Task) => !t.done || !!keep?.has(t.id);
  const focus = tasks.filter((t) => t.focus === today && (open(t) || doneOn(t) === today)).sort((a, b) => Number(a.done) - Number(b.done) || compareTasks(a, b));
  const focusIds = new Set(focus.map((t) => t.id));
  const rest = tasks.filter((t) => open(t) && (t.due === today || t.focus === today) && !focusIds.has(t.id)).sort(compareTasks);
  const overdue = tasks.filter((t) => open(t) && !!t.due && t.due < today && !focusIds.has(t.id)).sort(compareByDue);
  const done = tasks.filter((t) => doneOn(t) === today).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const pending = tasks.filter((t) => !t.done && (t.due === today || t.focus === today)).length;
  return { focus, rest, overdue, done, total: pending + done.length, completed: done.length };
}

/** Days in a row (ending today or yesterday) with at least one completed task. */
export function doneStreak(tasks: Task[], today: DayKey): number {
  const days = new Set(tasks.map(doneOn).filter(Boolean) as DayKey[]);
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d) && n < 3650) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Completed tasks per day for the last `days` days, oldest first. */
export function doneByDay(tasks: Task[], today: DayKey, days = 7): Array<{ day: DayKey; count: number }> {
  const counts = new Map<DayKey, number>();
  for (const t of tasks) {
    const d = doneOn(t);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return eachDay(addDays(today, -(days - 1)), today).map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

export interface ProjectStats {
  open: number;
  done: number;
  overdue: number;
  progress: number;
  next?: Task;
}

export function projectStats(project: Project, tasks: Task[], today: DayKey): ProjectStats {
  const own = tasks.filter((t) => t.projectId === project.id);
  const open = own.filter((t) => !t.done);
  const done = own.length - open.length;
  return {
    open: open.length,
    done,
    overdue: open.filter((t) => isOverdue(t, today)).length,
    progress: own.length ? done / own.length : 0,
    next: [...open].sort(compareByDue)[0]
  };
}

/* ------------------------------------------------------------------ */
/*  Rescheduling                                                       */
/* ------------------------------------------------------------------ */

export type QuickDate = "today" | "tomorrow" | "weekend" | "nextweek";

export function quickDate(kind: QuickDate, today: DayKey): DayKey {
  switch (kind) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "weekend": {
      const wd = weekdayIndex(today);
      return wd >= 5 ? today : addDays(today, 5 - wd);
    }
    case "nextweek":
      return addDays(today, 7 - weekdayIndex(today));
  }
}

export const QUICK_DATE_LABEL: Record<QuickDate, string> = { today: "Сегодня", tomorrow: "Завтра", weekend: "На выходных", nextweek: "След. неделя" };

/** "Сегодня" · "Завтра" · "Пт" (this week) · "12 ноя" · "3 дня назад" */
export function dueLabel(due: DayKey, today: DayKey): string {
  const delta = diffDays(due, today);
  if (delta === 0) return "Сегодня";
  if (delta === 1) return "Завтра";
  if (delta === -1) return "Вчера";
  if (delta < 0) return `${-delta} ${plural(-delta, ["день", "дня", "дней"])} назад`;
  if (delta < 7) return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][weekdayIndex(due)];
  return shortDate(due);
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function shortDate(d: DayKey): string {
  const [y, m, day] = d.split("-").map(Number);
  const year = y !== new Date().getFullYear() ? ` ${y}` : "";
  return `${day} ${MONTHS[m - 1]}${year}`;
}

/* ------------------------------------------------------------------ */
/*  Lists                                                              */
/* ------------------------------------------------------------------ */

export const PROJECT_ICONS = [
  "User",
  "BriefcaseBusiness",
  "House",
  "HeartPulse",
  "GraduationCap",
  "Wallet",
  "ShoppingBasket",
  "Dumbbell",
  "Plane",
  "Car",
  "Baby",
  "PawPrint",
  "Hammer",
  "Lightbulb",
  "BookOpen",
  "Music",
  "Gift",
  "Leaf",
  "Laptop",
  "Users",
  "Rocket",
  "Palette",
  "Camera",
  "Star"
];

/** Life areas offered when the planner is opened for the first time. */
export const AREA_PRESETS: Array<{ name: string; icon: string; color: string }> = [
  { name: "Личное", icon: "User", color: "#8E7CE3" },
  { name: "Работа", icon: "BriefcaseBusiness", color: "#4E9FD1" },
  { name: "Дом", icon: "House", color: "#5DB98A" },
  { name: "Здоровье", icon: "HeartPulse", color: "#D06AA2" },
  { name: "Учёба", icon: "GraduationCap", color: "#E9A23B" },
  { name: "Финансы", icon: "Wallet", color: "#C8B25A" },
  { name: "Покупки", icon: "ShoppingBasket", color: "#FF6A3D" },
  { name: "Спорт", icon: "Dumbbell", color: "#45B3A8" }
];

export function projectName(projects: Project[], id: ID | undefined): string | undefined {
  return id ? projects.find((p) => p.id === id)?.name : undefined;
}
