import { create } from "zustand";
import { addDays, todayKey, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { dayPlan, dueLabel } from "../../lib/tasks";
import { useData } from "../../store/store";
import type { ID, Task } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";

/* ------------------------------------------------------------------ */
/*  Just-ticked tasks stay in place for a moment                       */
/* ------------------------------------------------------------------ */

const useLingerStore = create<{ ids: ReadonlySet<ID> }>(() => ({ ids: new Set() }));

const LINGER_MS = 1100;

function linger(id: ID) {
  useLingerStore.setState((s) => ({ ids: new Set(s.ids).add(id) }));
  window.setTimeout(() => {
    useLingerStore.setState((s) => {
      const next = new Set(s.ids);
      next.delete(id);
      return { ids: next };
    });
  }, LINGER_MS);
}

export function useLingering(): ReadonlySet<ID> {
  return useLingerStore((s) => s.ids);
}

/** Shown as open: not done yet, or ticked a moment ago. */
export function useOpenFilter() {
  const ids = useLingering();
  return (t: Task) => !t.done || ids.has(t.id);
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

export function toggleDone(task: Task) {
  const st = useData.getState();
  if (task.done) {
    haptic("light");
    st.toggleTask(task.id);
    return;
  }
  haptic("success");
  linger(task.id);
  st.toggleTask(task.id);
  const today = todayKey();
  const after = useData.getState().tasks;
  const done = after.find((t) => t.id === task.id);
  const next = done?.nextId ? after.find((t) => t.id === done.nextId) : undefined;
  const plan = dayPlan(after, today);
  const wasForToday = task.due === today || task.focus === today;
  if (wasForToday && plan.total > 1 && plan.completed === plan.total) {
    nav.toast("Все дела на сегодня сделаны", { tone: "positive" });
  } else if (next?.due) {
    nav.toast(`Готово. Снова — ${dueLabel(next.due, today).toLowerCase()}`, { tone: "positive" });
  }
}

export function moveTasks(ids: ID[], due: DayKey | undefined, message?: string) {
  if (!ids.length) return;
  haptic();
  useData.getState().scheduleTasks(ids, due);
  if (message) nav.toast(message, { tone: "positive" });
}

export function moveToTomorrow(task: Task) {
  const today = todayKey();
  const base = task.due && task.due > today ? task.due : today;
  const due = addDays(base, 1);
  moveTasks([task.id], due, `Перенесено на ${dueLabel(due, today).toLowerCase()}`);
}

export function deleteTask(task: Task) {
  haptic("warning");
  undoable("Дело удалено", () => useData.getState().deleteTask(task.id));
}

export const MAX_FOCUS = 3;

/** Picks or unpicks a task as one of today's main things; there are at most three. */
export function toggleFocus(task: Task, today: DayKey = todayKey()): boolean {
  const st = useData.getState();
  if (task.focus === today) {
    haptic();
    st.setFocus(task.id, undefined);
    return true;
  }
  const count = st.tasks.filter((t) => t.focus === today && !t.done).length;
  if (count >= MAX_FOCUS) {
    haptic("warning");
    nav.toast("Главных дел не больше трёх — так их реально успеть", { tone: "warning" });
    return false;
  }
  haptic("success");
  st.setFocus(task.id, today);
  // A main thing of today happens today
  if (task.due !== today) st.updateTask(task.id, { due: today, time: undefined });
  return true;
}
