import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link2, NotebookPen, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDayHeading, timeOf, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import type { EntityLink, ID, LinkType, Note } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { spring } from "../../ui/motion";
import { EmptyState, IconButton, Button } from "../../ui/primitives";
import { TagInput } from "../../ui/TagInput";
import { Sheet, useSheet } from "../../ui/Sheet";

function stamp(iso: string) {
  const d = dayOf(iso);
  return d === todayKey() ? timeOf(iso) : formatDate(d);
}

export function NotesScreen() {
  const notes = useData((s) => s.notes);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return notes
      .filter((n) => (!tag || n.tags.includes(tag)) && (!query || `${n.title} ${n.body} ${n.tags.join(" ")}`.toLowerCase().includes(query)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, q, tag]);
  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  const create = () => {
    const id = useData.getState().addNote({ tags: tag ? [tag] : [] });
    nav.push("note", { id, isNew: true });
  };

  return (
    <Screen title="Заметки" large actions={<IconButton icon={Plus} label="Новая заметка" onClick={create} />}>
      <div className="px-4">
        <label className="flex h-10 items-center gap-2 rounded-sm bg-surface-3 px-3">
          <Search size={17} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3" />
          {q && (
            <button type="button" aria-label="Очистить" onClick={() => setQ("")} className="grid h-6 w-6 place-items-center rounded-full bg-ink-4 text-ink-inverse">
              <X size={13} strokeWidth={3} />
            </button>
          )}
        </label>
      </div>
      {tags.length > 0 && (
        <div className="scroll-x mt-3 flex gap-2 px-4">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} className={cn("h-8 shrink-0 rounded-full px-3 text-subhead font-medium", tag === t ? "bg-ink text-ink-inverse" : "bg-surface-3")}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Здесь будут ваши заметки" text="Идеи по экономии, сметы поездок, договорённости — привязывайте их к целям, планам и задачам." action={<Button size="md" icon={Plus} onClick={create}>Новая заметка</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Ничего не найдено" />
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {pinned.length > 0 && <NoteList title="Закреплённые" notes={pinned} />}
          {rest.length > 0 && <NoteList title={pinned.length ? "Остальные" : undefined} notes={rest} />}
        </div>
      )}
    </Screen>
  );
}

function NoteList({ title, notes }: { title?: string; notes: Note[] }) {
  return (
    <section>
      {title && <h2 className="px-5 pb-1.5 text-footnote font-semibold text-ink-2">{title}</h2>}
      <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
        {notes.map((n, i) => (
          <motion.button
            key={n.id}
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            onClick={() => nav.push("note", { id: n.id })}
            className="block w-full px-4 py-3 text-left active:bg-surface-press"
          >
            <div className="flex items-center gap-2">
              {n.pinned && <Pin size={13} className="shrink-0 fill-current text-accent-ink" />}
              <span className="truncate text-body font-semibold">{n.title || "Без названия"}</span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-subhead text-ink-2">
              <span className="text-ink-3">{stamp(n.updatedAt)}</span> {n.body || "Нет текста"}
            </div>
            {(n.tags.length > 0 || n.links.length > 0) && (
              <div className="mt-1.5 flex items-center gap-2 text-caption text-ink-3">
                {n.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
                {n.links.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Link2 size={12} />
                    {n.links.length}
                  </span>
                )}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function useLinkLabel() {
  const goals = useData((s) => s.goals);
  const tasks = useData((s) => s.tasks);
  const plans = useData((s) => s.plans);
  const debts = useData((s) => s.debts);
  return (l: EntityLink): string | null => {
    if (l.type === "goal") return goals.find((x) => x.id === l.id)?.name ?? null;
    if (l.type === "task") return tasks.find((x) => x.id === l.id)?.title ?? null;
    if (l.type === "plan") return plans.find((x) => x.id === l.id)?.title ?? null;
    return debts.find((x) => x.id === l.id)?.counterparty ?? null;
  };
}

const LINK_KIND: Record<LinkType, string> = { goal: "Цель", task: "Задача", plan: "План", debt: "Долг" };

export function NoteEditor({ id, isNew }: { id: ID; isNew?: boolean }) {
  const note = useData((s) => s.notes.find((n) => n.id === id));
  const label = useLinkLabel();
  const allTags = useData((s) => [...new Set(s.notes.flatMap((n) => n.tags))]);
  const body = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the text area
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(220, el.scrollHeight)}px`;
  }, [note?.body]);

  // Discard empty new notes when leaving
  useEffect(
    () => () => {
      const n = useData.getState().notes.find((x) => x.id === id);
      if (n && !n.title.trim() && !n.body.trim() && isNew) useData.getState().deleteNote(id);
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
    else if (l.type === "task") nav.sheet("task", { editId: l.id });
    else nav.sheet("planActions", { id: l.id });
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
        <div className="text-caption text-ink-3">{formatDayHeading(dayOf(note.updatedAt))}, {timeOf(note.updatedAt)}</div>
        <input
          autoFocus={isNew}
          value={note.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Заголовок"
          className="mt-1 w-full bg-transparent text-title-2 font-semibold outline-none placeholder:text-ink-4"
        />
        <textarea
          ref={body}
          value={note.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Текст заметки"
          className="mt-3 w-full resize-none bg-transparent text-body leading-[24px] outline-none placeholder:text-ink-4"
        />
      </div>

      <div className="mt-4 flex flex-col gap-5">
        <section className="mx-4 rounded-lg bg-surface px-4 py-3">
          <div className="pb-2 text-footnote font-medium text-ink-2">Теги</div>
          <TagInput value={note.tags} onChange={(tags) => update({ tags })} suggestions={allTags} />
        </section>
        <section className="mx-4 rounded-lg bg-surface">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <span className="text-footnote font-medium text-ink-2">Связи</span>
            <button type="button" onClick={() => nav.sheet("linkPicker", { noteId: id })} className="text-subhead font-semibold text-accent-ink">
              Добавить
            </button>
          </div>
          {note.links.length === 0 ? (
            <div className="px-4 pb-3 text-subhead text-ink-3">Привяжите цель, задачу, план или долг</div>
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
  const goals = useData((s) => s.goals.filter((g) => !g.archived));
  const tasks = useData((s) => s.tasks.filter((t) => !t.done));
  const plans = useData((s) => s.plans.filter((p) => p.status === "planned"));
  const debts = useData((s) => s.debts);
  const [type, setType] = useState<LinkType>("goal");
  if (!note) return null;
  const items: Array<{ id: ID; title: string }> =
    type === "goal" ? goals.map((g) => ({ id: g.id, title: g.name })) : type === "task" ? tasks.map((t) => ({ id: t.id, title: t.title })) : type === "plan" ? plans.map((p) => ({ id: p.id, title: p.title })) : debts.map((d) => ({ id: d.id, title: d.counterparty }));
  const has = (id: ID) => note.links.some((l) => l.type === type && l.id === id);

  return (
    <Sheet title="Связать с…">
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          {(["goal", "task", "plan", "debt"] as LinkType[]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn("h-8 flex-1 rounded-full text-subhead font-medium", type === t ? "bg-ink text-ink-inverse" : "bg-surface-3")}>
              {LINK_KIND[t]}
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-callout text-ink-2">Здесь пока пусто</div>
      ) : (
        <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
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
