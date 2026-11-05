import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CalendarPlus, Hash, NotebookPen, Plus, Repeat, Stamp, Trash2, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDateTime, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { openInCalendar } from "../../lib/ics";
import { uid } from "../../lib/id";
import { QUICK_DATE_LABEL, REPEAT_LABEL, dueLabel, quickDate, type QuickDate } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Subtask, Task, TaskRepeat } from "../../store/types";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button, Chip, FormRow, Group, IconChip, Row, Segmented, Toggle } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { deleteTask, toggleFocus } from "./actions";
import { QuickAddSheet } from "./QuickAdd";
import { TaskCheck } from "./TaskRow";

function useAutosize(ref: React.RefObject<HTMLTextAreaElement>, value: string, min = 24) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(min, el.scrollHeight)}px`;
  }, [ref, value, min]);
}

/** Details of a task. Changes are saved as you make them. */
export function TaskSheet({ editId, due, projectId }: { editId?: ID; due?: DayKey; projectId?: ID }) {
  const task = useData((s) => (editId ? s.tasks.find((t) => t.id === editId) : undefined));
  if (!editId) return <QuickAddSheet due={due} projectId={projectId} />;
  if (!task) return <GoneSheet />;
  return <TaskDetails task={task} />;
}

function GoneSheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Дело">
      <div className="px-6 py-8 text-center text-callout text-ink-2">Это дело удалено.</div>
      <div className="px-4">
        <Button variant="secondary" block onClick={close}>
          Закрыть
        </Button>
      </div>
    </Sheet>
  );
}

function TaskDetails({ task }: { task: Task }) {
  const { close } = useSheet();
  const today = useToday();
  const projects = useData((s) => s.projects);
  const notes = useData((s) => s.notes);
  const focusCount = useData((s) => s.tasks.filter((t) => t.focus === today && !t.done && t.id !== task.id).length);
  const [title, setTitle] = useState(task.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(titleRef, title, 28);
  useAutosize(noteRef, task.note ?? "", 22);

  const update = (patch: Partial<Task>) => useData.getState().updateTask(task.id, patch);
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const linked = notes.filter((n) => n.links.some((l) => l.type === "task" && l.id === task.id));
  const subs = task.subtasks ?? [];

  const pickDate = () =>
    nav.sheet("pickDate", {
      value: task.due,
      time: task.time,
      withTime: true,
      onPick: (d: DayKey | undefined, t?: string) => useData.getState().updateTask(task.id, { due: d, time: d ? t : undefined, focus: task.focus && task.focus === d ? task.focus : undefined })
    });

  const pickRepeat = () =>
    nav.sheet("picker", {
      title: "Повтор",
      value: task.repeat,
      options: (["none", "day", "weekdays", "week", "month", "year"] as TaskRepeat[]).map((r) => ({ value: r, label: REPEAT_LABEL[r] })),
      onSelect: (v: string) => update({ repeat: v as TaskRepeat, due: v !== "none" && !task.due ? today : task.due })
    });

  const pickList = () =>
    nav.sheet("picker", {
      title: "Список",
      value: task.projectId ?? "",
      options: [{ value: "", label: "Входящие", sub: "Без списка" }, ...projects.filter((p) => !p.archived || p.id === task.projectId).map((p) => ({ value: p.id, label: p.name, iconName: p.icon }))],
      onSelect: (v: string) => update({ projectId: v || undefined })
    });

  const newNote = () => {
    const id = useData.getState().addNote({ links: [{ type: "task", id: task.id }] });
    close();
    window.setTimeout(() => nav.push("note", { id, isNew: true }), 120);
  };

  return (
    <Sheet ariaLabel="Дело" left={<span />} right={<SheetAction strong onClick={close}>Готово</SheetAction>} title="Дело">
      <div className="flex flex-col gap-5 pt-1">
        <div className="mx-4 panel rounded-lg px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="pt-[3px]">
              <TaskCheck task={task} seal={task.focus === today} size={26} />
            </div>
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => {
                const v = e.target.value.replace(/\n/g, " ");
                setTitle(v);
                if (v.trim()) update({ title: v.trim() });
              }}
              onBlur={() => !title.trim() && setTitle(task.title)}
              aria-label="Название"
              className={cn("min-w-0 flex-1 resize-none bg-transparent text-title-3 font-semibold outline-none", task.done && "text-ink-2 line-through decoration-ink-3")}
            />
          </div>
          <textarea
            ref={noteRef}
            rows={1}
            value={task.note ?? ""}
            onChange={(e) => update({ note: e.target.value || undefined })}
            placeholder="Заметка: детали, ссылки, адрес"
            className="mt-2 w-full resize-none bg-transparent pl-[38px] text-callout leading-[22px] text-ink-2 outline-none placeholder:text-ink-3"
          />
        </div>

        <Checklist items={subs} onChange={(subtasks) => update({ subtasks })} />

        <Group header="Когда">
          <Row icon={CalendarDays} iconTone={task.due && task.due < today && !task.done ? "negative" : undefined} title="Дата" value={task.due ? `${dueLabel(task.due, today)}${task.time ? `, ${task.time}` : ""}` : "Без даты"} chevron onClick={pickDate} />
          <div className="scroll-x flex gap-2 px-4 py-3">
            {(["today", "tomorrow", "weekend", "nextweek"] as QuickDate[]).map((k) => {
              const d = quickDate(k, today);
              return (
                <Chip key={k} selected={task.due === d} onClick={() => useData.getState().scheduleTasks([task.id], d)}>
                  {QUICK_DATE_LABEL[k]}
                </Chip>
              );
            })}
          </div>
          <Row icon={Repeat} title="Повтор" value={task.repeat === "none" ? "Нет" : REPEAT_LABEL[task.repeat]} chevron onClick={pickRepeat} />
        </Group>

        <Group>
          <Row leading={project ? <IconChip name={project.icon} color={project.color} size={30} /> : <IconChip icon={Hash} size={30} />} title="Список" value={project?.name ?? "Входящие"} chevron onClick={pickList} />
          <div className="px-4 py-3">
            <div className="pb-2 text-footnote text-ink-2">Приоритет</div>
            <Segmented
              value={String(task.priority) as "0" | "1" | "2"}
              onChange={(v) => update({ priority: Number(v) as 0 | 1 | 2 })}
              options={[
                { value: "0", label: "Обычный" },
                { value: "1", label: "Важно" },
                { value: "2", label: "Срочно" }
              ]}
            />
          </div>
          {!task.done && (
            <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Stamp} tone="accent" size={30} />Главное на сегодня</span>}>
              <Toggle checked={task.focus === today} disabled={task.focus !== today && focusCount >= 3} onChange={() => toggleFocus(task, today)} label="Главное на сегодня" />
            </FormRow>
          )}
        </Group>

        <Group header="Заметки">
          {linked.map((n) => (
            <Row key={n.id} icon={NotebookPen} title={n.title || "Без названия"} subtitle={n.body.slice(0, 80) || undefined} chevron onClick={() => { close(); window.setTimeout(() => nav.push("note", { id: n.id }), 120); }} />
          ))}
          <Row icon={Plus} title="Новая заметка к делу" onClick={newNote} />
        </Group>

        <div className="flex flex-col gap-2 px-4">
          {task.due && (
            <Button
              variant="secondary"
              block
              icon={CalendarPlus}
              onClick={() => {
                const ok = openInCalendar(task, project?.name);
                if (!ok) nav.toast("Не получилось открыть Календарь", { tone: "warning" });
              }}
            >
              Добавить в Календарь
            </Button>
          )}
          <Button
            variant="danger"
            block
            icon={Trash2}
            onClick={() => {
              close();
              deleteTask(task);
            }}
          >
            Удалить дело
          </Button>
          <p className="px-4 pt-1 text-center text-footnote text-ink-3">
            {task.due ? "Календарь телефона сам напомнит о деле, даже если приложение закрыто. " : ""}
            Создано {formatDate(dayOf(task.createdAt))}
            {task.done && task.doneAt ? `, сделано ${formatDateTime(task.doneAt)}` : ""}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Checklist — used by tasks and notes                                */
/* ------------------------------------------------------------------ */

export function Checklist({ items, onChange, header = "Пункты", placeholder = "Добавить пункт" }: { items: Subtask[]; onChange: (items: Subtask[]) => void; header?: string; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    haptic();
    onChange([...items, { id: uid("s-"), title: t, done: false }]);
    setDraft("");
  };
  const done = items.filter((i) => i.done).length;
  return (
    <section className="mx-4">
      <div className="flex items-baseline justify-between px-1 pb-2.5">
        <span className="label-caps">{header}</span>
        {items.length > 0 && <span className="num text-footnote text-ink-3">{done} из {items.length}</span>}
      </div>
      <div className="panel overflow-hidden rounded-lg [&>*+*]:hairline-t">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div key={it.id} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="flex min-h-[48px] items-center gap-3 px-4">
              <motion.button
                type="button"
                role="checkbox"
                aria-checked={it.done}
                aria-label={it.title}
                whileTap={{ scale: 0.8 }}
                onClick={() => {
                  haptic(it.done ? "light" : "success");
                  onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
                }}
                className={cn("grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors", it.done ? "fill-positive border-transparent text-white" : "border-ink-3")}
              >
                {it.done && (
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </motion.button>
              <input
                value={it.title}
                onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x)))}
                onBlur={(e) => !e.target.value.trim() && onChange(items.filter((x) => x.id !== it.id))}
                aria-label="Пункт"
                className={cn("min-w-0 flex-1 bg-transparent py-2.5 text-body outline-none", it.done && "text-ink-3 line-through decoration-ink-3")}
              />
              <button type="button" aria-label={`Удалить пункт: ${it.title}`} onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 active:bg-surface-3">
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="flex min-h-[48px] items-center gap-3 px-4">
          <Plus size={18} className="shrink-0 text-ink-3" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={placeholder}
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-body outline-none placeholder:text-ink-3"
          />
        </div>
      </div>
    </section>
  );
}
