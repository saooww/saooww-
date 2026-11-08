import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, Clock, Flag, Hash, Inbox, Repeat, X, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays, pluralN, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { parseTask, splitLines, type TokenKind } from "../../lib/quickParse";
import { REPEAT_LABEL, dueLabel } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, TaskRepeat } from "../../store/types";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

export interface QuickAddProps {
  /** Day the new tasks go to unless the text says otherwise */
  due?: DayKey;
  projectId?: ID;
  /** Pick the new task as one of today's main things */
  focus?: boolean;
}

interface Manual {
  /** null — explicitly without a date */
  due?: DayKey | null;
  time?: string;
  projectId?: ID | null;
  priority?: 0 | 1 | 2;
}

interface Draft {
  title: string;
  due?: DayKey;
  time?: string;
  repeat: TaskRepeat;
  priority: 0 | 1 | 2;
  projectId?: ID;
  /** where each value came from: the text, or a chip/context */
  from: Partial<Record<TokenKind, "text" | "pick">>;
}

/**
 * One line, no forms: «Позвонить маме завтра в 18:00 #личное». Date, time,
 * repeat, list and priority are recognised while typing and shown as chips.
 * The sheet stays open, so a whole head of thoughts can be emptied in one go.
 */
export function QuickAddSheet({ due: ctxDue, projectId: ctxProject, focus }: QuickAddProps) {
  const { close } = useSheet();
  const today = useToday();
  const projects = useData((s) => s.projects);
  const live = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const [text, setText] = useState("");
  const [ignore, setIgnore] = useState<Set<TokenKind>>(new Set());
  const [manual, setManual] = useState<Manual>({});
  const [added, setAdded] = useState<Array<{ id: ID; title: string; sub: string }>>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(160, Math.max(30, el.scrollHeight))}px`;
  }, [text]);

  const lines = useMemo(() => (text.includes("\n") ? splitLines(text) : [text.trim()].filter(Boolean)), [text]);

  const draftOf = (line: string): Draft => {
    const p = parseTask(line, today, { projects: live, ignore, defaultDue: manual.due ?? ctxDue });
    const from: Draft["from"] = {};
    let due: DayKey | undefined;
    if (p.due) {
      due = p.due;
      from.date = "text";
    } else if (manual.due !== undefined) {
      due = manual.due ?? undefined;
      if (due) from.date = "pick";
    } else if (ctxDue) {
      due = ctxDue;
      from.date = "pick";
    }
    let time = p.time;
    if (time) from.time = "text";
    else if (manual.time && due) {
      time = manual.time;
      from.time = "pick";
    }
    if (time && !due) due = today;
    let projectId = p.projectId;
    if (projectId) from.project = "text";
    else if (manual.projectId !== undefined) {
      projectId = manual.projectId ?? undefined;
      if (projectId) from.project = "pick";
    } else if (ctxProject) {
      projectId = ctxProject;
      from.project = "pick";
    }
    const priority = p.priority ?? manual.priority ?? 0;
    if (p.priority) from.priority = "text";
    else if (manual.priority) from.priority = "pick";
    if (p.repeat) from.repeat = "text";
    return { title: p.title, due, time, repeat: p.repeat ?? "none", priority, projectId, from };
  };

  const drafts = lines.map(draftOf).filter((d) => d.title);
  const single = lines.length <= 1 ? draftOf(lines[0] ?? "") : null;
  const preview: Draft = single ?? drafts[0] ?? draftOf("");

  const submit = () => {
    if (!drafts.length) return;
    const st = useData.getState();
    const made: typeof added = [];
    for (const d of drafts) {
      const id = st.addTask({
        title: d.title,
        due: d.due,
        time: d.due ? d.time : undefined,
        repeat: d.repeat,
        priority: d.priority,
        projectId: d.projectId,
        focus: focus && d.due === today ? today : undefined
      });
      made.push({ id, title: d.title, sub: whereLabel(d) });
    }
    haptic("success");
    setAdded((a) => [...made.reverse(), ...a].slice(0, 6));
    setText("");
    setIgnore(new Set());
    setManual({});
    input.current?.focus();
  };

  const whereLabel = (d: Draft) => {
    const parts: string[] = [];
    if (d.due) parts.push(dueLabel(d.due, today) + (d.time ? `, ${d.time}` : ""));
    const p = d.projectId ? live.find((x) => x.id === d.projectId) : undefined;
    if (p) parts.push(p.name);
    if (!parts.length) parts.push("Входящие");
    return parts.join(", ");
  };

  /** Removes the words a token was read from (when the value is replaced by hand). */
  const strip = (kind: TokenKind) => {
    if (!single) return;
    const p = parseTask(text, today, { projects: live, ignore });
    let t = text;
    for (const tok of p.tokens) if (tok.kind === kind && tok.text) t = t.replace(tok.text, " ");
    setText(t.replace(/\s{2,}/g, " ").trimStart());
  };

  const pickDate = () =>
    nav.sheet("pickDate", {
      value: preview.due,
      time: preview.time,
      withTime: true,
      onPick: (d: DayKey | undefined, t?: string) => {
        strip("date");
        strip("time");
        setManual((m) => ({ ...m, due: d ?? null, time: t }));
      }
    });

  const pickList = () =>
    nav.sheet("picker", {
      title: "Список",
      value: preview.projectId ?? "",
      options: [{ value: "", label: "Входящие", sub: "Без списка — разберёте потом" }, ...live.map((p) => ({ value: p.id, label: p.name, iconName: p.icon }))],
      onSelect: (v: string) => {
        strip("project");
        setManual((m) => ({ ...m, projectId: v || null }));
      }
    });

  const drop = (kind: TokenKind) => {
    haptic();
    if (preview.from[kind] === "text") setIgnore((s) => new Set(s).add(kind));
    else if (kind === "date") setManual((m) => ({ ...m, due: null, time: undefined }));
    else if (kind === "time") setManual((m) => ({ ...m, time: undefined }));
    else if (kind === "project") setManual((m) => ({ ...m, projectId: null }));
    else if (kind === "priority") setManual((m) => ({ ...m, priority: 0 }));
  };

  const project = preview.projectId ? live.find((p) => p.id === preview.projectId) : undefined;
  const chips: Array<{ kind: TokenKind; icon: LucideIcon; label: string; color?: string; onTap?: () => void }> = [];
  if (preview.due) chips.push({ kind: "date", icon: CalendarDays, label: dueLabel(preview.due, today), onTap: pickDate });
  if (preview.time) chips.push({ kind: "time", icon: Clock, label: preview.time, onTap: pickDate });
  if (preview.repeat !== "none") chips.push({ kind: "repeat", icon: Repeat, label: REPEAT_LABEL[preview.repeat] });
  if (project) chips.push({ kind: "project", icon: Hash, label: project.name, color: project.color, onTap: pickList });
  if (preview.priority) chips.push({ kind: "priority", icon: Flag, label: preview.priority === 2 ? "Срочно" : "Важно" });

  const multi = drafts.length > 1;

  return (
    <Sheet
      title="Новое дело"
      left={added.length ? undefined : <SheetAction onClick={close}>Отмена</SheetAction>}
      right={added.length ? <SheetAction strong onClick={close}>Готово</SheetAction> : undefined}
      footer={
        <Button block disabled={!drafts.length} onClick={submit}>
          {multi ? `Добавить ${pluralN(drafts.length, ["дело", "дела", "дел"])}` : "Добавить"}
        </Button>
      }
    >
      <div className="px-4 pt-1">
        <div className="panel rounded-lg px-4 py-3.5">
          <textarea
            ref={input}
            autoFocus
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value.trim()) setIgnore(new Set());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Что нужно сделать?"
            enterKeyHint="send"
            aria-label="Новое дело"
            className="block w-full resize-none bg-transparent text-headline leading-[24px] text-ink outline-none placeholder:text-ink-3"
          />
          {single && single.title && single.title.toLowerCase() !== text.trim().toLowerCase() && (
            <div className="mt-1.5 truncate text-footnote text-ink-3">
              Запишется как <span className="text-ink-2">«{single.title}»</span>
            </div>
          )}
          <motion.div layout className="mt-3 flex flex-wrap gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.span
                  key={c.kind}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={spring.snappy}
                  className="inline-flex h-8 items-center rounded-full bg-accent-soft pl-2.5 text-subhead font-medium text-accent-ink"
                >
                  <button type="button" onClick={c.onTap} disabled={!c.onTap} className="flex items-center gap-1.5">
                    {c.color ? <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> : <c.icon size={14} strokeWidth={2.2} />}
                    {c.label}
                  </button>
                  <button type="button" aria-label={`Убрать: ${c.label}`} onClick={() => drop(c.kind)} className="grid h-8 w-8 place-items-center rounded-full opacity-70">
                    <X size={13} strokeWidth={2.6} />
                  </button>
                </motion.span>
              ))}
              {!preview.due && (
                <motion.span key="add-today" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AddChip onClick={() => setManual((m) => ({ ...m, due: today }))}>Сегодня</AddChip>
                </motion.span>
              )}
              {!preview.due && (
                <motion.span key="add-tomorrow" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AddChip onClick={() => setManual((m) => ({ ...m, due: addDays(today, 1) }))}>Завтра</AddChip>
                </motion.span>
              )}
              {!preview.time && (
                <motion.span key="add-date" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AddChip icon={CalendarDays} onClick={pickDate}>
                    {preview.due ? "Время" : "Дата"}
                  </AddChip>
                </motion.span>
              )}
              {!project && live.length > 0 && (
                <motion.span key="add-list" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AddChip icon={Hash} onClick={pickList}>
                    Список
                  </AddChip>
                </motion.span>
              )}
              {!preview.priority && (
                <motion.span key="add-prio" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AddChip icon={Flag} onClick={() => setManual((m) => ({ ...m, priority: 1 }))}>
                    Важно
                  </AddChip>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {!text && !added.length && (
          <p className="px-1 pt-3 text-footnote text-ink-3">
            Пишите как обычно: «Позвонить маме завтра в 18:00», «отчёт к пятнице #работа !!». Дата, время, повтор и список распознаются сами. Несколько строк — несколько дел.
          </p>
        )}
        {multi && <p className="px-1 pt-3 text-footnote text-ink-2">Каждая строка станет отдельным делом.</p>}
        {!preview.due && !project && text.trim() && !multi && (
          <p className="flex items-center gap-1.5 px-1 pt-3 text-footnote text-ink-3">
            <Inbox size={13} /> Попадёт во «Входящие» — разберёте при планировании дня
          </p>
        )}

        {added.length > 0 && (
          <div className="mt-5">
            <div className="px-1 pb-2 text-footnote font-medium text-ink-2">Добавлено</div>
            <div className="overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
              <AnimatePresence initial={false}>
                {added.map((a) => (
                  <motion.button
                    key={a.id}
                    type="button"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={spring.smooth}
                    onClick={() => nav.sheet("task", { editId: a.id })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-subhead text-ink">{a.title}</span>
                      <span className="block truncate text-caption text-ink-3">{a.sub}</span>
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function AddChip({ children, onClick, icon: Icon }: { children: string; onClick: () => void; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic();
        onClick();
      }}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-subhead text-ink-2 active:bg-surface-3")}
    >
      {Icon && <Icon size={14} strokeWidth={2} />}
      {children}
    </button>
  );
}
