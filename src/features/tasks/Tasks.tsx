import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ListTodo, Plus, Repeat, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { addDays, capitalize, formatDate, formatRelative, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { freqLabel } from "../../lib/recurrence";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Frequency, ID, Task } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { spring } from "../../ui/motion";
import { Button, Chip, EmptyState, FormRow, Group, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

export function TasksScreen() {
  const tasks = useData((s) => s.tasks);
  const today = useToday();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);

  const sections = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const byDue = (a: Task, b: Task) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priority - a.priority;
    return {
      overdue: open.filter((t) => t.due && t.due < today).sort(byDue),
      today: open.filter((t) => t.due === today).sort((a, b) => b.priority - a.priority),
      soon: open.filter((t) => t.due && t.due > today).sort(byDue),
      someday: open.filter((t) => !t.due).sort((a, b) => b.priority - a.priority),
      done: tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
    };
  }, [tasks, today]);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    useData.getState().addTask({ title, priority: 0, repeat: "none" });
    haptic();
    setDraft("");
  };

  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <Screen title="Задачи" large>
      <div className="px-4">
        <div className="flex h-12 items-center gap-2 rounded-lg bg-surface pl-4 pr-1.5">
          <Plus size={18} className="shrink-0 text-ink-3" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Новая задача — например, оплатить интернет"
            enterKeyHint="done"
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
          />
          {draft && (
            <Button size="sm" onClick={add}>
              Добавить
            </Button>
          )}
        </div>
      </div>

      {openCount === 0 && sections.done.length === 0 ? (
        <EmptyState icon={ListTodo} title="Список дел пуст" text="Финансовые дела не потеряются: сроки, повторы и приоритеты — всё здесь." />
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <TaskGroup title="Просрочено" tone="text-negative" tasks={sections.overdue} />
          <TaskGroup title="Сегодня" tasks={sections.today} />
          <TaskGroup title="Скоро" tasks={sections.soon} />
          <TaskGroup title="Без срока" tasks={sections.someday} />
          {openCount === 0 && <div className="px-5 text-callout text-ink-2">Все дела сделаны. Отличная работа.</div>}
          {sections.done.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 px-5 pb-2 text-footnote font-medium text-ink-2">
                Выполнено · {sections.done.length}
                <ChevronDown size={15} className={cn("transition-transform", showDone && "rotate-180")} />
              </button>
              {showDone && <TaskGroup tasks={sections.done.slice(0, 30)} />}
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}

function TaskGroup({ title, tasks, tone }: { title?: string; tasks: Task[]; tone?: string }) {
  if (!tasks.length) return null;
  return (
    <section>
      {title && <h2 className={cn("px-5 pb-1.5 text-footnote font-semibold", tone ?? "text-ink-2")}>{title}</h2>}
      <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const today = useToday();
  const overdue = !task.done && task.due && task.due < today;
  return (
    <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="flex items-center gap-3 px-4">
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? "Отметить невыполненной" : "Отметить выполненной"}
        whileTap={{ scale: 0.85 }}
        onClick={() => {
          haptic(task.done ? "light" : "success");
          useData.getState().toggleTask(task.id);
          if (!task.done && task.repeat !== "none") nav.toast("Готово. Следующая — по расписанию", { tone: "positive" });
        }}
        className={cn("grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors", task.done ? "border-positive bg-positive text-white" : task.priority === 2 ? "border-accent" : "border-ink-3")}
      >
        <AnimatePresence>{task.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.snappy}><Check size={15} strokeWidth={3} /></motion.span>}</AnimatePresence>
      </motion.button>
      <button type="button" onClick={() => nav.sheet("task", { editId: task.id })} className="flex min-h-[56px] min-w-0 flex-1 flex-col justify-center py-2.5 text-left">
        <span className={cn("text-body", task.done ? "text-ink-3 line-through decoration-ink-3" : "text-ink")}>
          {task.priority > 0 && !task.done && <span className="mr-1 font-semibold text-accent-ink">{task.priority === 2 ? "!!" : "!"}</span>}
          {task.title}
        </span>
        {(task.due || task.repeat !== "none" || task.note) && !task.done && (
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-footnote text-ink-2">
            {task.due && <span className={overdue ? "text-negative" : ""}>{capitalize(formatRelative(task.due))}</span>}
            {task.repeat !== "none" && <Repeat size={12} />}
            {task.note && <span className="truncate text-ink-3">{task.note}</span>}
          </span>
        )}
      </button>
    </motion.div>
  );
}

export function TaskSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.tasks.find((t) => t.id === editId) : undefined));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [hasDue, setHasDue] = useState(!!existing?.due);
  const [due, setDue] = useState(existing?.due ?? todayKey());
  const [priority, setPriority] = useState<"0" | "1" | "2">(String(existing?.priority ?? 0) as "0" | "1" | "2");
  const [repeat, setRepeat] = useState<"none" | Frequency>(existing?.repeat ?? "none");
  const valid = title.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const fields = { title: title.trim(), note: note.trim() || undefined, due: hasDue ? due : undefined, priority: Number(priority) as 0 | 1 | 2, repeat };
    const st = useData.getState();
    if (existing) st.updateTask(existing.id, fields);
    else st.addTask(fields);
    haptic("success");
    close();
  };

  return (
    <Sheet title={existing ? "Задача" : "Новая задача"} left={<SheetAction onClick={close}>Отмена</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <Group>
          <div className="px-4 py-3">
            <input autoFocus={!existing} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что сделать" maxLength={80} className={cn(inputCls, "text-headline")} />
          </div>
          <div className="px-4 py-3">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка" rows={2} className={cn(inputCls, "resize-none")} />
          </div>
        </Group>
        <Group>
          <FormRow label="Срок">
            <Toggle checked={hasDue} onChange={setHasDue} label="Срок" />
          </FormRow>
          {hasDue && (
            <>
              <FormRow label="Дата">
                <input type="date" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} className={cn(inputCls, "text-right")} />
              </FormRow>
              <div className="flex gap-2 px-4 pb-3">
                <Chip selected={due === todayKey()} onClick={() => setDue(todayKey())}>Сегодня</Chip>
                <Chip selected={due === addDays(todayKey(), 1)} onClick={() => setDue(addDays(todayKey(), 1))}>Завтра</Chip>
                <Chip selected={due === addDays(todayKey(), 7)} onClick={() => setDue(addDays(todayKey(), 7))}>Через неделю</Chip>
              </div>
            </>
          )}
        </Group>
        <Group header="Приоритет">
          <div className="p-3">
            <Segmented value={priority} onChange={setPriority} options={[{ value: "0", label: "Обычный" }, { value: "1", label: "Важно" }, { value: "2", label: "Срочно" }]} />
          </div>
        </Group>
        <Group header="Повтор" footer={repeat !== "none" ? `${freqLabel(repeat)} — после отметки появится следующая${hasDue ? ` (после ${formatDate(due)})` : ""}.` : undefined}>
          <div className="p-3">
            <Segmented value={repeat} onChange={setRepeat} options={[{ value: "none", label: "Нет" }, { value: "week", label: "Неделя" }, { value: "month", label: "Месяц" }, { value: "year", label: "Год" }]} />
          </div>
        </Group>
        {existing && (
          <div className="px-4">
            <Button
              variant="danger"
              block
              icon={Trash2}
              onClick={() => {
                undoable("Задача удалена", () => useData.getState().deleteTask(existing.id));
                close();
              }}
            >
              Удалить задачу
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
