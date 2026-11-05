import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ListChecks, ListPlus, NotebookPen, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { MONTHS_GEN, WEEKDAYS_LONG, capitalize, dayOf, formatDate, formatDayHeading, parseDay, pluralN, timeOf, todayKey, weekdayIndex } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { EntityLink, ID, LinkType, Note } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { spring } from "../../ui/motion";
import { EmptyState, IconButton, Button, IconChip } from "../../ui/primitives";
import { TagInput } from "../../ui/TagInput";
import { Sheet, useSheet } from "../../ui/Sheet";
import { Checklist } from "../planner/TaskSheet";

function stamp(iso: string) {
  const d = dayOf(iso);
  return d === todayKey() ? timeOf(iso) : formatDate(d);
}

function journalTitle(day: string): string {
  const d = parseDay(day);
  return `${capitalize(WEEKDAYS_LONG[weekdayIndex(day)])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** Creates an empty note and opens it. */
export function createNote(init?: Partial<Note>) {
  const id = useData.getState().addNote(init);
  nav.push("note", { id, isNew: true });
}

/** Opens the diary entry of a day, creating it if needed. */
export function openJournal(day: string) {
  const existed = useData.getState().notes.some((n) => n.journal === day);
  const id = useData.getState().journalNote(day);
  nav.push("note", { id, isNew: !existed });
}

type Filter = { kind: "all" } | { kind: "journal" } | { kind: "tag"; tag: string };

/** Notes as cards in two columns, with search, the diary and tags. */
export function NotesView() {
  const notes = useData((s) => s.notes);
  const today = useToday();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const hasJournal = notes.some((n) => n.journal);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return notes
      .filter((n) => (filter.kind === "journal" ? !!n.journal : filter.kind === "tag" ? n.tags.includes(filter.tag) : true))
      .filter((n) => !query || `${n.title} ${n.body} ${n.tags.join(" ")} ${(n.checklist ?? []).map((c) => c.title).join(" ")}`.toLowerCase().includes(query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, q, filter]);
  const todayEntry = notes.find((n) => n.journal === today);

  return (
    <div>
      <div className="px-4">
        <label className="flex h-10 items-center gap-2 rounded-sm tile px-3">
          <Search size={17} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по заметкам" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3" />
          {q && (
            <button type="button" aria-label="Очистить" onClick={() => setQ("")} className="grid h-6 w-6 place-items-center rounded-full bg-ink-4 text-ink-inverse">
              <X size={13} strokeWidth={3} />
            </button>
          )}
        </label>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={spring.press}
        onClick={() => openJournal(today)}
        className="panel mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3 rounded-lg px-3.5 py-3 text-left"
      >
        <IconChip icon={BookOpen} tone="accent" size={36} />
        <span className="min-w-0 flex-1">
          <span className="block text-callout font-semibold">Дневник</span>
          <span className="block truncate text-footnote text-ink-2">{todayEntry?.body ? todayEntry.body.split("\n")[0] : "Пара строк о сегодняшнем дне"}</span>
        </span>
      </motion.button>

      {(tags.length > 0 || hasJournal) && (
        <div className="scroll-x mt-3 flex gap-2 px-4">
          <FilterChip on={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })}>
            Все
          </FilterChip>
          {hasJournal && (
            <FilterChip on={filter.kind === "journal"} onClick={() => setFilter({ kind: "journal" })}>
              Дневник
            </FilterChip>
          )}
          {tags.map((t) => (
            <FilterChip key={t} on={filter.kind === "tag" && filter.tag === t} onClick={() => setFilter(filter.kind === "tag" && filter.tag === t ? { kind: "all" } : { kind: "tag", tag: t })}>
              #{t}
            </FilterChip>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Записывайте, чтобы не держать в голове"
          text="Идеи, списки покупок, договорённости, планы на поездку. Пункты чек-листа превращаются в дела одной кнопкой."
          action={
            <Button size="md" icon={Plus} onClick={() => createNote()}>
              Новая заметка
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Ничего не найдено" />
      ) : (
        <div className="mt-4 columns-2 gap-2.5 px-4">
          {filtered.map((n, i) => (
            <NoteCard key={n.id} note={n} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("h-8 shrink-0 rounded-full px-3 text-subhead font-medium transition-colors", on ? "bg-ink text-ink-inverse" : "tile text-ink-2")}>
      {children}
    </button>
  );
}

function NoteCard({ note: n, index }: { note: Note; index: number }) {
  const list = n.checklist ?? [];
  const done = list.filter((c) => c.done).length;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.025, duration: 0.24 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => nav.push("note", { id: n.id })}
      className="panel mb-2.5 block w-full break-inside-avoid rounded-[18px] p-3.5 text-left"
    >
      {n.journal && (
        <div className="mb-1 flex items-center gap-1.5 text-caption font-medium text-accent-ink">
          <BookOpen size={12} strokeWidth={2.2} /> Дневник
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <span className="line-clamp-2 min-w-0 flex-1 text-callout font-semibold text-ink">{n.journal ? journalTitle(n.journal) : n.title || "Без названия"}</span>
        {n.pinned && <Pin size={13} className="mt-0.5 shrink-0 fill-current text-accent-ink" />}
      </div>
      {n.body && <p className="mt-1 line-clamp-6 whitespace-pre-line text-footnote text-ink-2">{n.body}</p>}
      {list.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {list.slice(0, 4).map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-footnote">
              <span className={cn("h-3 w-3 shrink-0 rounded-[4px] border", c.done ? "border-positive bg-positive" : "border-ink-3")} />
              <span className={cn("truncate", c.done ? "text-ink-3 line-through" : "text-ink-2")}>{c.title}</span>
            </div>
          ))}
          {list.length > 4 && <div className="text-caption text-ink-3">и ещё {list.length - 4}</div>}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2 text-caption text-ink-3">
        <span>{stamp(n.updatedAt)}</span>
        {list.length > 0 && (
          <span className="flex items-center gap-1">
            <ListChecks size={11} />
            {done}/{list.length}
          </span>
        )}
        {n.tags.slice(0, 2).map((t) => (
          <span key={t} className="truncate">
            #{t}
          </span>
        ))}
      </div>
    </motion.button>
  );
}

/** Kept for the «Ещё» stack and old links. */
export function NotesScreen() {
  return (
    <Screen title="Заметки" large actions={<IconButton icon={Plus} label="Новая заметка" onClick={() => createNote()} />}>
      <NotesView />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor                                                             */
/* ------------------------------------------------------------------ */

function useLinkLabel() {
  const goals = useData((s) => s.goals);
  const tasks = useData((s) => s.tasks);
  const plans = useData((s) => s.plans);
  const debts = useData((s) => s.debts);
  const projects = useData((s) => s.projects);
  return (l: EntityLink): string | null => {
    if (l.type === "goal") return goals.find((x) => x.id === l.id)?.name ?? null;
    if (l.type === "task") return tasks.find((x) => x.id === l.id)?.title ?? null;
    if (l.type === "plan") return plans.find((x) => x.id === l.id)?.title ?? null;
    if (l.type === "project") return projects.find((x) => x.id === l.id)?.name ?? null;
    return debts.find((x) => x.id === l.id)?.counterparty ?? null;
  };
}

const LINK_KIND: Record<LinkType, string> = { project: "Список", task: "Дело", goal: "Цель", plan: "План", debt: "Долг" };

export function NoteEditor({ id, isNew }: { id: ID; isNew?: boolean }) {
  const note = useData((s) => s.notes.find((n) => n.id === id));
  const projects = useData((s) => s.projects);
  const label = useLinkLabel();
  const allTags = useData((s) => [...new Set(s.notes.flatMap((n) => n.tags))]);
  const body = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the text area
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(note?.checklist ? 80 : 200, el.scrollHeight)}px`;
  }, [note?.body, note?.checklist]);

  // Discard empty new notes when leaving
  useEffect(
    () => () => {
      const n = useData.getState().notes.find((x) => x.id === id);
      if (n && isNew && !n.title.trim() && !n.body.trim() && !(n.checklist ?? []).some((c) => c.title.trim())) useData.getState().deleteNote(id);
    },
    [id, isNew]
  );

  if (!note) {
    return (
      <Screen title="Заметка">
        <EmptyState icon={NotebookPen} title="Заметка удалена" />
      </Screen>
    );
  }

  const update = (patch: Partial<Note>) => useData.getState().updateNote(id, patch);
  const openLink = (l: EntityLink) => {
    if (l.type === "goal") nav.push("goal", { id: l.id });
    else if (l.type === "debt") nav.push("debt", { id: l.id });
    else if (l.type === "project") nav.push("project", { id: l.id });
    else if (l.type === "task") nav.sheet("task", { editId: l.id });
    else nav.sheet("planActions", { id: l.id });
  };

  const openItems = (note.checklist ?? []).filter((c) => !c.done && c.title.trim());

  const toTasks = () => {
    const linkedProject = note.links.find((l) => l.type === "project")?.id;
    nav.sheet("picker", {
      title: "Куда добавить дела",
      value: linkedProject ?? "",
      options: [{ value: "", label: "Входящие", sub: "Разберёте при планировании дня" }, ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name, iconName: p.icon }))],
      onSelect: (v: string) => {
        const st = useData.getState();
        const ids = openItems.map((c) => st.addTask({ title: c.title.trim(), priority: 0, repeat: "none", projectId: v || undefined }));
        const fresh = useData.getState().notes.find((n) => n.id === id);
        if (!fresh) return;
        st.updateNote(id, {
          checklist: (fresh.checklist ?? []).filter((c) => !openItems.some((o) => o.id === c.id)),
          links: [...fresh.links, ...ids.map((tid) => ({ type: "task" as const, id: tid }))]
        });
        haptic("success");
        nav.toast(`${pluralN(ids.length, ["дело создано", "дела созданы", "дел создано"])}`, { tone: "positive" });
      }
    });
  };

  return (
    <Screen
      title=""
      actions={
        <>
          <IconButton icon={note.pinned ? PinOff : Pin} label={note.pinned ? "Открепить" : "Закрепить"} onClick={() => { haptic(); update({ pinned: !note.pinned }); }} />
          <IconButton
            icon={Trash2}
            label="Удалить"
            onClick={() => {
              nav.pop();
              setTimeout(() => undoable("Заметка удалена", () => useData.getState().deleteNote(id)), 380);
            }}
          />
        </>
      }
    >
      <div className="px-5">
        {note.journal ? (
          <>
            <div className="flex items-center gap-1.5 text-footnote font-medium text-accent-ink">
              <BookOpen size={14} /> Дневник
            </div>
            <h1 className="mt-1 text-title-2 font-semibold">{formatDayHeading(note.journal) === "Сегодня" ? `Сегодня, ${parseDay(note.journal).getDate()} ${MONTHS_GEN[parseDay(note.journal).getMonth()]}` : journalTitle(note.journal)}</h1>
          </>
        ) : (
          <>
            <div className="text-caption text-ink-3">
              {formatDayHeading(dayOf(note.updatedAt))}, {timeOf(note.updatedAt)}
            </div>
            <input
              autoFocus={isNew}
              value={note.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Заголовок"
              className="mt-1 w-full bg-transparent text-title-2 font-semibold outline-none placeholder:text-ink-4"
            />
          </>
        )}
        <textarea
          ref={body}
          autoFocus={isNew && !!note.journal}
          value={note.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder={note.journal ? "Что получилось? Что мешало? Что важно завтра?" : "Текст заметки"}
          className="mt-3 w-full resize-none bg-transparent text-body leading-[24px] outline-none placeholder:text-ink-4"
        />
      </div>

      <div className="mt-2 flex flex-col gap-5">
        {note.checklist ? (
          <div>
            <Checklist header="Чек-лист" items={note.checklist} onChange={(checklist) => update({ checklist })} />
            {openItems.length > 0 && (
              <div className="px-4 pt-2">
                <Button size="sm" variant="tinted" icon={ListPlus} onClick={toTasks}>
                  {openItems.length === 1 ? "Сделать делом" : `Сделать делами: ${openItems.length}`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4">
            <Button size="sm" variant="secondary" icon={ListChecks} onClick={() => update({ checklist: [] })}>
              Добавить чек-лист
            </Button>
          </div>
        )}

        <section className="mx-4 panel rounded-lg px-4 py-3">
          <div className="pb-2 text-footnote font-medium text-ink-2">Теги</div>
          <TagInput value={note.tags} onChange={(tags) => update({ tags })} suggestions={allTags} />
        </section>
        <section className="mx-4 panel rounded-lg">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <span className="text-footnote font-medium text-ink-2">Связи</span>
            <button type="button" onClick={() => nav.sheet("linkPicker", { noteId: id })} className="text-subhead font-semibold text-accent-ink">
              Добавить
            </button>
          </div>
          {note.links.length === 0 ? (
            <div className="px-4 pb-3 text-subhead text-ink-3">Привяжите список, дело, цель, план или долг</div>
          ) : (
            note.links.map((l) => {
              const name = label(l);
              if (!name) return null;
              return (
                <div key={`${l.type}-${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hairline-t">
                  <button type="button" onClick={() => openLink(l)} className="min-w-0 flex-1 text-left">
                    <div className="text-caption text-ink-3">{LINK_KIND[l.type]}</div>
                    <div className="truncate text-body">{name}</div>
                  </button>
                  <button type="button" aria-label="Убрать связь" onClick={() => update({ links: note.links.filter((x) => !(x.type === l.type && x.id === l.id)) })} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 active:bg-surface-3">
                    <X size={16} />
                  </button>
                </div>
              );
            })
          )}
        </section>
      </div>
    </Screen>
  );
}

export function LinkPickerSheet({ noteId }: { noteId: ID }) {
  const { close } = useSheet();
  const note = useData((s) => s.notes.find((n) => n.id === noteId));
  const goals = useData((s) => s.goals);
  const tasks = useData((s) => s.tasks);
  const plans = useData((s) => s.plans);
  const debts = useData((s) => s.debts);
  const projects = useData((s) => s.projects);
  const [type, setType] = useState<LinkType>("project");
  if (!note) return null;
  const items: Array<{ id: ID; title: string }> =
    type === "project"
      ? projects.filter((p) => !p.archived).map((p) => ({ id: p.id, title: p.name }))
      : type === "goal"
        ? goals.filter((g) => !g.archived).map((g) => ({ id: g.id, title: g.name }))
        : type === "task"
          ? tasks.filter((t) => !t.done).map((t) => ({ id: t.id, title: t.title }))
          : type === "plan"
            ? plans.filter((p) => p.status === "planned").map((p) => ({ id: p.id, title: p.title }))
            : debts.map((d) => ({ id: d.id, title: d.counterparty }));
  const has = (id: ID) => note.links.some((l) => l.type === type && l.id === id);

  return (
    <Sheet title="Связать с…">
      <div className="scroll-x flex gap-2 px-4 pb-3">
        {(["project", "task", "goal", "plan", "debt"] as LinkType[]).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={cn("h-8 shrink-0 rounded-full px-3.5 text-subhead font-medium", type === t ? "bg-ink text-ink-inverse" : "tile")}>
            {LINK_KIND[t]}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-callout text-ink-2">Здесь пока пусто</div>
      ) : (
        <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
          {items.map((it) => (
            <motion.button
              key={it.id}
              type="button"
              whileTap={{ scale: 0.99 }}
              transition={spring.press}
              disabled={has(it.id)}
              onClick={() => {
                haptic();
                useData.getState().updateNote(noteId, { links: [...note.links, { type, id: it.id }] });
                close();
              }}
              className="flex min-h-[50px] w-full items-center px-4 text-left text-body disabled:text-ink-3"
            >
              <span className="truncate">{it.title}</span>
              {has(it.id) && <span className="ml-auto text-footnote">уже связано</span>}
            </motion.button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
