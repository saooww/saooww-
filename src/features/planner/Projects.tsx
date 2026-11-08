import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, CheckCheck, ChevronDown, Inbox, NotebookPen, Pencil, Plus, Sunrise, Trash2 } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_GEN, WEEKDAYS_LONG, addDays, capitalize, dayOf, formatDate, formatDayHeading, parseDay, pluralN, todayKey, weekdayIndex, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { PROJECT_ICONS, compareByDue, compareTasks, isInbox, projectStats } from "../../lib/tasks";
import { CHART_COLORS } from "../../store/catalog";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Project, Task } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { spring } from "../../ui/motion";
import { NamedIcon } from "../../ui/icons";
import { Button, EmptyState, FormRow, Group, IconButton, IconChip, Row, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { useOpenFilter } from "./actions";
import { Heading, Invite, InviteButton } from "./bits";
import { TaskList } from "./TaskRow";

/* ------------------------------------------------------------------ */
/*  One list                                                           */
/* ------------------------------------------------------------------ */

export function ProjectScreen({ id }: { id: ID }) {
  const project = useData((s) => s.projects.find((p) => p.id === id));
  const tasks = useData((s) => s.tasks);
  const notes = useData((s) => s.notes);
  const today = useToday();
  const isOpen = useOpenFilter();
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const own = tasks.filter((t) => t.projectId === id);
    const open = own.filter(isOpen);
    return {
      overdue: open.filter((t) => t.due && t.due < today).sort(compareByDue),
      dated: open.filter((t) => t.due && t.due >= today).sort(compareByDue),
      someday: open.filter((t) => !t.due).sort(compareTasks),
      done: own.filter((t) => t.done && !isOpen(t)).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))
    };
  }, [tasks, id, today, isOpen]);

  if (!project) {
    return (
      <Screen title="Список">
        <EmptyState icon={Inbox} title="Список удалён" />
      </Screen>
    );
  }

  const st = projectStats(project, tasks, today);
  const linked = notes.filter((n) => n.links.some((l) => l.type === "project" && l.id === id));
  const total = st.open + st.done;

  return (
    <Screen title={project.name} ownTitle actions={<IconButton icon={Pencil} label="Изменить список" onClick={() => nav.sheet("project", { editId: id })} />}>
      <div className="px-5 pb-5">
        <IconChip name={project.icon} color={project.color} size={52} />
        <h1 className="mt-3 text-title-1 font-display">{project.name}</h1>
        {project.note && <p className="mt-1 text-callout text-ink-2">{project.note}</p>}
        <div className="mt-2 text-footnote text-ink-2">
          {total ? `Сделано ${st.done} из ${total}` : "Пока пусто"}
          {project.deadline ? `, срок — ${formatDate(project.deadline, { long: true })}` : ""}
          {project.archived ? ". В архиве" : ""}
        </div>
        {total > 0 && (
          <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
            <motion.div className="h-full rounded-full" style={{ background: project.color, boxShadow: `0 0 12px -2px ${project.color}` }} initial={{ width: 0 }} animate={{ width: `${st.progress * 100}%` }} transition={spring.smooth} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-4">
          <button
            type="button"
            onClick={() => nav.sheet("quickAdd", { projectId: id })}
            className="flex h-12 w-full items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 text-left text-body text-ink-2 active:bg-surface-3"
          >
            <Plus size={18} className="text-ink-3" />
            Дело в «{project.name}»
          </button>
        </div>

        {groups.overdue.length > 0 && (
          <section>
            <Heading title="Просрочено" tone="negative" aside={groups.overdue.length} />
            <TaskList tasks={groups.overdue} showList={false} />
          </section>
        )}
        {groups.dated.length > 0 && (
          <section>
            <Heading title="По датам" aside={groups.dated.length} />
            <TaskList tasks={groups.dated} showList={false} />
          </section>
        )}
        {groups.someday.length > 0 && (
          <section>
            <Heading title="Без даты" aside={groups.someday.length} />
            <TaskList tasks={groups.someday} showList={false} />
          </section>
        )}

        {groups.done.length > 0 && (
          <section>
            <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex items-center gap-1.5 px-5 pb-2.5 text-subhead font-medium text-ink-2">
              Сделано <span className="num text-ink-3">{groups.done.length}</span>
              <ChevronDown size={15} className={cn("transition-transform duration-200", showDone && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="overflow-hidden">
                  <TaskList tasks={groups.done.slice(0, 50)} showList={false} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        <section>
          <Heading title="Заметки" aside={linked.length || undefined} />
          <Group>
            {linked.map((n) => (
              <Row key={n.id} icon={NotebookPen} title={n.title || "Без названия"} subtitle={n.body.slice(0, 80) || undefined} chevron onClick={() => nav.push("note", { id: n.id })} />
            ))}
            <Row
              icon={Plus}
              title="Новая заметка"
              onClick={() => {
                const nid = useData.getState().addNote({ links: [{ type: "project", id }] });
                nav.push("note", { id: nid, isNew: true });
              }}
            />
          </Group>
        </section>
      </div>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Create / edit a list                                               */
/* ------------------------------------------------------------------ */

export function ProjectSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.projects.find((p) => p.id === editId) : undefined));
  const taskCount = useData((s) => (editId ? s.tasks.filter((t) => t.projectId === editId).length : 0));
  const count = useData((s) => s.projects.length);
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? PROJECT_ICONS[(count + 9) % PROJECT_ICONS.length]);
  const [color, setColor] = useState(existing?.color ?? CHART_COLORS[(count * 5) % CHART_COLORS.length]);
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ?? addDays(todayKey(), 30));
  const [note, setNote] = useState(existing?.note ?? "");
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const fields: Omit<Project, "id" | "createdAt"> = { name: name.trim(), icon, color, deadline: hasDeadline ? deadline : undefined, note: note.trim() || undefined, archived: existing?.archived };
    const st = useData.getState();
    haptic("success");
    if (existing) {
      st.updateProject(existing.id, fields);
      close();
    } else {
      const id = st.addProject(fields);
      close();
      window.setTimeout(() => nav.push("project", { id }), 120);
    }
  };

  return (
    <Sheet title={existing ? "Список" : "Новый список"} left={<SheetAction onClick={close}>Отмена</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        <div className="flex flex-col items-center gap-3 px-4">
          <motion.span key={icon + color} initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={spring.snappy}>
            <IconChip name={icon} color={color} size={64} />
          </motion.span>
          <input
            autoFocus={!existing}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Например, «Ремонт кухни»"
            maxLength={40}
            aria-label="Название списка"
            className={cn(inputCls, "panel h-12 rounded-lg px-4 text-center text-headline font-semibold")}
          />
        </div>

        <Group header="Цвет">
          <div className="grid grid-cols-6 gap-3 p-4">
            {CHART_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Цвет ${c}`}
                aria-pressed={color === c}
                onClick={() => {
                  haptic();
                  setColor(c);
                }}
                className="mx-auto grid h-9 w-9 place-items-center rounded-full"
                style={{ background: c, boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : "inset 0 0 0 0.5px rgba(0,0,0,0.2)" }}
              />
            ))}
          </div>
        </Group>

        <Group header="Значок">
          <div className="grid grid-cols-6 gap-2 p-3">
            {PROJECT_ICONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n}
                aria-pressed={icon === n}
                onClick={() => {
                  haptic();
                  setIcon(n);
                }}
                className={cn("mx-auto grid h-11 w-11 place-items-center rounded-[14px] transition-colors", icon === n ? "text-white" : "text-ink-2 active:bg-surface-3")}
                style={icon === n ? { background: color } : undefined}
              >
                <NamedIcon name={n} size={20} strokeWidth={1.9} />
              </button>
            ))}
          </div>
        </Group>

        <Group footer="Срок подходит проектам с результатом: «Переезд», «Подготовка к экзамену».">
          <FormRow label="Срок">
            <Toggle checked={hasDeadline} onChange={setHasDeadline} label="Срок" />
          </FormRow>
          {hasDeadline && (
            <FormRow label="До">
              <input type="date" value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} className={cn(inputCls, "text-right")} />
            </FormRow>
          )}
          <div className="px-4 py-3">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Зачем этот список, какой результат нужен" rows={2} className={cn(inputCls, "resize-none")} />
          </div>
        </Group>

        {existing && (
          <div className="flex flex-col gap-2 px-4">
            <Button
              variant="secondary"
              block
              icon={existing.archived ? ArchiveRestore : Archive}
              onClick={() => {
                useData.getState().updateProject(existing.id, { archived: !existing.archived });
                nav.toast(existing.archived ? "Список возвращён" : "Список в архиве", { tone: "positive" });
                close();
              }}
            >
              {existing.archived ? "Вернуть из архива" : "Убрать в архив"}
            </Button>
            <Button
              variant="danger"
              block
              icon={Trash2}
              onClick={() =>
                confirmDelete({
                  title: `Удалить «${existing.name}»?`,
                  message: taskCount ? `Вместе со списком удалятся ${pluralN(taskCount, ["дело", "дела", "дел"])}. Чтобы сохранить их, уберите список в архив.` : undefined,
                  confirmLabel: "Удалить список",
                  onConfirm: () => {
                    close();
                    useUI.getState().popToRoot();
                    window.setTimeout(() => undoable("Список удалён", () => useData.getState().deleteProject(existing.id)), 380);
                  }
                })
              }
            >
              Удалить список
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Smart lists                                                        */
/* ------------------------------------------------------------------ */

type ListKind = "inbox" | "upcoming" | "all" | "done";

const TITLES: Record<ListKind, string> = { inbox: "Входящие", upcoming: "Скоро", all: "Все дела", done: "Сделано" };

export function TaskListScreen({ kind }: { kind: ListKind }) {
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const today = useToday();
  const isOpen = useOpenFilter();

  const sections = useMemo((): Array<{ key: string; title: string; tasks: Task[]; tone?: "negative" }> => {
    if (kind === "inbox") {
      const list = tasks.filter((t) => isInbox(t) || (isOpen(t) && t.done && !t.projectId && !t.due)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return [{ key: "inbox", title: "", tasks: list }];
    }
    if (kind === "upcoming") {
      const open = tasks.filter((t) => isOpen(t) && t.due && t.due > today).sort(compareByDue);
      const out: Array<{ key: string; title: string; tasks: Task[] }> = [];
      const horizon = addDays(today, 14);
      const byDay = new Map<DayKey, Task[]>();
      const later: Task[] = [];
      for (const t of open) {
        if (t.due! <= horizon) byDay.set(t.due!, [...(byDay.get(t.due!) ?? []), t]);
        else later.push(t);
      }
      for (const [d, list] of byDay) out.push({ key: d, title: formatDayHeading(d), tasks: list });
      if (later.length) out.push({ key: "later", title: "Позже", tasks: later });
      return out;
    }
    if (kind === "all") {
      const open = tasks.filter(isOpen);
      const out = [{ key: "none", title: "Без списка", tasks: open.filter((t) => !t.projectId).sort(compareByDue) }];
      for (const p of projects.filter((x) => !x.archived)) out.push({ key: p.id, title: p.name, tasks: open.filter((t) => t.projectId === p.id).sort(compareByDue) });
      return out.filter((s) => s.tasks.length);
    }
    // done: by the day they were done, newest first
    const done = tasks.filter((t) => t.done && t.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!)).slice(0, 150);
    const byDay = new Map<DayKey, Task[]>();
    for (const t of done) byDay.set(dayOf(t.doneAt!), [...(byDay.get(dayOf(t.doneAt!)) ?? []), t]);
    return [...byDay].map(([d, list]) => {
      const dd = parseDay(d);
      const title = d === today ? "Сегодня" : d === addDays(today, -1) ? "Вчера" : `${capitalize(WEEKDAYS_LONG[weekdayIndex(d)])}, ${dd.getDate()} ${MONTHS_GEN[dd.getMonth()]}`;
      return { key: d, title, tasks: list };
    });
  }, [kind, tasks, projects, today, isOpen]);

  const count = sections.reduce((a, s) => a + s.tasks.length, 0);

  return (
    <Screen title={TITLES[kind]} large actions={kind !== "done" ? <IconButton icon={Plus} label="Новое дело" onClick={() => nav.sheet("quickAdd", {})} /> : undefined}>
      {kind === "inbox" && (
        <div className="mx-4 mb-5 rounded-lg border border-line px-4 py-3.5">
          <p className="text-subhead text-ink-2">Сюда попадает всё, что записано на бегу, без даты и списка. Раз в день решайте, когда за это взяться — так ничего не потеряется.</p>
          {count > 0 && (
            <Button size="sm" variant="tinted" icon={Sunrise} className="mt-3" onClick={() => nav.sheet("planDay", { start: "inbox" })}>
              Разобрать
            </Button>
          )}
        </div>
      )}
      {count === 0 ? (
        kind === "inbox" ? (
          <Invite text="Входящие пусты — голова свободна" action={<InviteButton onClick={() => nav.sheet("quickAdd", {})}>Записать</InviteButton>} />
        ) : (
          <EmptyState icon={kind === "done" ? CheckCheck : Inbox} title={kind === "done" ? "Пока ничего не сделано" : "Здесь пусто"} text={kind === "upcoming" ? "Дела с датой после сегодняшнего дня появятся здесь." : undefined} />
        )
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((s) => (
            <section key={s.key}>
              {s.title && <Heading title={s.title} aside={s.tasks.length} />}
              <TaskList tasks={s.tasks} showDate={kind !== "upcoming" || s.key === "later"} showList={kind !== "all"} />
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}
