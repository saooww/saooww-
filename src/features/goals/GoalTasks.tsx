import { useMemo } from "react";
import { ListPlus, Plus } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { compareTasks } from "../../lib/tasks";
import { useData } from "../../store/store";
import type { Goal } from "../../store/types";
import { nav } from "../../store/ui";
import { Button } from "../../ui/primitives";
import { TaskList } from "../planner/TaskRow";
import { tr } from "../../i18n/i18n";

/**
 * The tasks that go with a goal — money and the things to do side by side.
 * Without a list yet, one tap makes a list named after the goal.
 */
export function GoalTasks({ goal }: { goal: Goal }) {
  const tasks = useData((s) => s.tasks);
  const project = useData((s) => (goal.projectId ? s.projects.find((p) => p.id === goal.projectId) : undefined));
  const list = useMemo(() => (project ? tasks.filter((t) => t.projectId === project.id && !t.done).sort(compareTasks) : []), [tasks, project]);

  if (!project) {
    return (
      <section className="mx-4 rounded-[20px] border border-dashed border-line-strong px-4 py-4">
        <div className="text-subhead font-semibold">{tr("Дела к цели")}</div>
        <p className="mt-1 text-footnote text-ink-2">{tr("Запланируйте, что сделать ради цели — список будет рядом с деньгами.")}</p>
        <Button
          size="sm"
          variant="secondary"
          icon={ListPlus}
          className="mt-3"
          onClick={() => {
            haptic("success");
            const st = useData.getState();
            const id = st.addProject({ name: goal.name, icon: goal.icon, color: goal.color ?? "#df0714", deadline: goal.deadline });
            st.updateGoal(goal.id, { projectId: id });
            nav.sheet("quickAdd", { projectId: id });
          }}
        >
          {tr("Создать список дел")}
        </Button>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between px-5 pb-2.5">
        <h2 className="section-label">{tr("Дела к цели")}</h2>
        <button type="button" onClick={() => nav.push("project", { id: project.id }, "planner")} className="text-footnote font-medium text-accent-ink">
          {tr("Весь список")}
        </button>
      </div>
      <TaskList tasks={list} empty={<div className="mx-4 rounded-lg px-4 py-3 text-footnote text-ink-2">{tr("Все дела сделаны")}</div>} />
      <div className="mt-2 px-4">
        <button type="button" onClick={() => nav.sheet("quickAdd", { projectId: project.id })} className="flex h-10 items-center gap-1.5 px-1 text-subhead font-medium text-accent-ink">
          <Plus size={16} /> {tr("Добавить дело")}
        </button>
      </div>
    </section>
  );
}
