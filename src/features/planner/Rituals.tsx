import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { addDays, formatDate, pluralN, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { parseTask } from "../../lib/quickParse";
import { compareByDue, compareTasks, dayPlan, doneStreak, dueLabel, isInbox, projectName, quickDate } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Task } from "../../store/types";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { MAX_FOCUS, deleteTask, moveTasks, toggleFocus } from "./actions";
import { Enso } from "./Enso";

type Step = "overdue" | "inbox" | "focus" | "done";

/* ------------------------------------------------------------------ */
/*  Morning: plan the day                                              */
/* ------------------------------------------------------------------ */

/**
 * Three short steps: deal with what is left from previous days, sort the
 * inbox, pick up to three main things. Ends with «Начните с…».
 */
export function PlanDaySheet({ start }: { start?: Exclude<Step, "done"> }) {
  const { close } = useSheet();
  const today = useToday();
  const tasks = useData((s) => s.tasks);

  // Rows stay where they are while you sort them; the lists are fixed when the sheet opens.
  const [snap] = useState(() => {
    const all = useData.getState().tasks;
    return {
      overdue: all.filter((t) => !t.done && t.due && t.due < today && t.focus !== today).sort(compareByDue).map((t) => t.id),
      inbox: all.filter(isInbox).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => t.id)
    };
  });
  const steps = useMemo<Step[]>(() => {
    const all: Step[] = [];
    if (snap.overdue.length) all.push("overdue");
    if (snap.inbox.length) all.push("inbox");
    all.push("focus", "done");
    const from = start ? all.indexOf(start) : 0;
    return from > 0 ? all.slice(from) : all;
  }, [snap, start]);
  const [i, setI] = useState(0);
  const step = steps[i];
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    if (step === "done") useData.getState().updateSettings({ dayPlannedOn: today });
  }, [step, today]);

  const next = () => {
    haptic();
    if (i < steps.length - 1) setI(i + 1);
    else close();
  };

  const counted = steps.filter((s) => s !== "done");

  return (
    <Sheet
      tall
      ariaLabel="План на день"
      footer={
        step === "done" ? (
          <Button block onClick={close}>
            Начать день
          </Button>
        ) : (
          <Button block onClick={next}>
            {steps[i + 1] === "done" ? "Готово" : "Дальше"}
          </Button>
        )
      }
    >
      {step !== "done" && counted.length > 1 && (
        <div className="flex gap-1.5 px-5 pb-4" aria-label={`Шаг ${i + 1} из ${counted.length}`}>
          {counted.map((s, k) => (
            <motion.span key={s} className="h-[3px] flex-1 rounded-full" animate={{ background: k <= i ? "var(--accent)" : "var(--line-strong)" }} transition={{ duration: 0.25 }} />
          ))}
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
          {step === "overdue" && (
            <SortStep
              title="Хвосты с прошлых дней"
              text="Не успели — бывает. Решите, когда за них взяться, или отпустите."
              ids={snap.overdue}
              byId={byId}
              today={today}
              bulk={{ label: "Всё на сегодня", run: () => moveTasks(snap.overdue.filter((id) => byId.has(id)), today) }}
              options={["today", "tomorrow", "none"]}
            />
          )}
          {step === "inbox" && (
            <SortStep
              title="Входящие"
              text="Всё, что записано на бегу. Назначьте день — или оставьте на потом, если не к спеху."
              ids={snap.inbox}
              byId={byId}
              today={today}
              options={["today", "tomorrow", "weekend"]}
            />
          )}
          {step === "focus" && <FocusStep today={today} />}
          {step === "done" && <DoneStep today={today} />}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}

type SortOption = "today" | "tomorrow" | "weekend" | "none";

function SortStep({ title, text, ids, byId, today, bulk, options }: { title: string; text: string; ids: ID[]; byId: Map<ID, Task>; today: DayKey; bulk?: { label: string; run: () => void }; options: SortOption[] }) {
  const projects = useData((s) => s.projects);
  const rows = ids.map((id) => byId.get(id)).filter(Boolean) as Task[];
  const dayFor = (o: SortOption): DayKey | undefined => {
    if (o === "today") return today;
    if (o === "tomorrow") return addDays(today, 1);
    if (o === "weekend") return quickDate("weekend", today);
    return undefined;
  };
  const LABEL: Record<SortOption, string> = { today: "Сегодня", tomorrow: "Завтра", weekend: "Выходные", none: "Без даты" };

  return (
    <div>
      <StepHeader title={title} text={text} />
      {bulk && rows.length > 1 && (
        <div className="px-5 pb-3">
          <button type="button" onClick={bulk.run} className="text-subhead font-semibold text-accent-ink">
            {bulk.label}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2 px-4">
        <AnimatePresence initial={false}>
          {rows.map((t) => {
            const list = projectName(projects, t.projectId);
            return (
              <motion.div key={t.id} layout exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="panel overflow-hidden rounded-lg px-4 py-3">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => nav.sheet("task", { editId: t.id })} className="min-w-0 flex-1 text-left">
                    <div className="text-body text-ink">{t.title}</div>
                    {(t.due || list) && (
                      <div className="mt-0.5 text-footnote text-ink-3">
                        {[t.due && t.due < today ? `было на ${formatDate(t.due)}` : t.due ? dueLabel(t.due, today) : "", list].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </button>
                  <button type="button" aria-label={`Удалить: ${t.title}`} onClick={() => deleteTask(t)} className="-mr-2 -mt-1 grid h-8 w-8 place-items-center rounded-full text-ink-3 active:bg-surface-3">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  {options.map((o) => {
                    const d = dayFor(o);
                    const on = o === "none" ? !t.due : t.due === d;
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => moveTasks([t.id], d)}
                        className={cn("h-8 flex-1 rounded-full text-footnote font-semibold transition-colors", on ? "bg-ink text-ink-inverse" : "tile text-ink-2")}
                      >
                        {LABEL[o]}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!rows.length && <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-subhead text-ink-2">Всё разобрано</div>}
      </div>
    </div>
  );
}

function StepHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-5 pb-4">
      <h2 className="text-title-2 font-semibold">{title}</h2>
      <p className="mt-1.5 text-callout text-ink-2">{text}</p>
    </div>
  );
}

function FocusStep({ today }: { today: DayKey }) {
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const [draft, setDraft] = useState("");
  const todays = useMemo(() => tasks.filter((t) => !t.done && (t.due === today || t.focus === today)).sort((a, b) => Number(b.focus === today) - Number(a.focus === today) || compareTasks(a, b)), [tasks, today]);
  const others = useMemo(
    () =>
      tasks
        .filter((t) => !t.done && t.due !== today && t.focus !== today && (!t.due || t.due <= addDays(today, 7)))
        .sort((a, b) => b.priority - a.priority || compareByDue(a, b))
        .slice(0, 6),
    [tasks, today]
  );
  const picked = tasks.filter((t) => t.focus === today && !t.done).length;

  const add = () => {
    const p = parseTask(draft, today, { projects, defaultDue: today });
    if (!p.title) return;
    const id = useData.getState().addTask({ title: p.title, due: today, time: p.time, priority: p.priority ?? 0, repeat: p.repeat ?? "none", projectId: p.projectId, focus: picked < MAX_FOCUS ? today : undefined });
    haptic("success");
    setDraft("");
    return id;
  };

  return (
    <div>
      <StepHeader title="Главное на сегодня" text="Выберите до трёх дел. Если успеете только их — день прошёл не зря." />
      <div className="flex items-center gap-2 px-5 pb-3">
        {Array.from({ length: MAX_FOCUS }, (_, k) => (
          <motion.span key={k} className="grid h-7 w-7 place-items-center rounded-[8px] border-[1.5px]" style={{ rotate: -4 }} animate={{ borderColor: k < picked ? "rgba(0,0,0,0)" : "var(--line-strong)", background: k < picked ? "var(--accent)" : "rgba(0,0,0,0)" }} transition={spring.snappy}>
            {k < picked && <Check size={14} strokeWidth={3} className="text-[var(--accent-on)]" />}
          </motion.span>
        ))}
        <span className="ml-1 text-footnote text-ink-2">{picked ? `выбрано ${picked} из ${MAX_FOCUS}` : "пока ничего"}</span>
      </div>

      <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
        {todays.map((t) => (
          <PickRow key={t.id} task={t} on={t.focus === today} today={today} />
        ))}
        <div className="flex min-h-[52px] items-center gap-3 px-4">
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
            placeholder="Дело на сегодня"
            enterKeyHint="done"
            aria-label="Дело на сегодня"
            className="min-w-0 flex-1 bg-transparent py-3 text-body outline-none placeholder:text-ink-3"
          />
          {draft.trim() && (
            <button type="button" onClick={add} className="text-subhead font-semibold text-accent-ink">
              Добавить
            </button>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div className="mt-6">
          <div className="px-5 pb-2.5 text-subhead font-medium text-ink-2">Можно взять из других дней</div>
          <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
            {others.map((t) => (
              <PickRow key={t.id} task={t} on={false} today={today} showDue />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PickRow({ task, on, today, showDue }: { task: Task; on: boolean; today: DayKey; showDue?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => toggleFocus(task, today)} className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-press">
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border-[1.6px] transition-colors", on ? "fill-accent border-transparent text-[var(--accent-on)]" : "border-ink-3")} style={{ transform: "rotate(-4deg)" }}>
        {on && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-ink">{task.title}</span>
        {showDue && <span className="block text-footnote text-ink-3">{task.due ? dueLabel(task.due, today) : "без даты"}</span>}
      </span>
      {task.time && <span className="num text-subhead text-ink-2">{task.time}</span>}
    </button>
  );
}

function DoneStep({ today }: { today: DayKey }) {
  const tasks = useData((s) => s.tasks);
  const focus = tasks.filter((t) => t.focus === today && !t.done).sort(compareTasks);
  const plan = dayPlan(tasks, today);
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(1), 120);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center px-6 pt-4 text-center">
      <Enso value={drawn} complete={drawn === 1} size={132} />
      <h2 className="mt-5 text-title-2 font-semibold">План на день готов</h2>
      {focus.length ? (
        <>
          <p className="mt-2 max-w-[300px] text-callout text-ink-2">
            Начните с «{focus[0].title}». {focus.length > 1 ? "Потом — остальное главное." : ""}
          </p>
          <div className="mt-5 flex w-full flex-col gap-2">
            {focus.map((t, k) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + k * 0.08 }} className="panel flex items-center gap-3 rounded-lg px-4 py-3 text-left">
                <span className="fill-accent grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-caption font-bold text-[var(--accent-on)]" style={{ transform: "rotate(-4deg)" }}>
                  {k + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-body">{t.title}</span>
                {t.time && <span className="num text-subhead text-ink-2">{t.time}</span>}
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 max-w-[300px] text-callout text-ink-2">
          {plan.total ? `На сегодня ${pluralN(plan.total - plan.completed, ["дело", "дела", "дел"])}. Главное можно выбрать позже.` : "Свободный день. Запишите дела, когда появятся."}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Evening: review the day                                            */
/* ------------------------------------------------------------------ */

export function ReviewDaySheet() {
  const { close } = useSheet();
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const plan = useMemo(() => dayPlan(tasks, today), [tasks, today]);
  const streak = useMemo(() => doneStreak(tasks, today), [tasks, today]);
  const [left] = useState(() => {
    const all = useData.getState().tasks;
    return all.filter((t) => !t.done && (t.due === today || t.focus === today || (t.due && t.due < today))).sort(compareByDue).map((t) => t.id);
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const leftRows = left.map((id) => byId.get(id)).filter((t): t is Task => !!t && !t.done);
  const journal = useData((s) => s.notes.find((n) => n.journal === today));
  const [text, setText] = useState(journal?.body ?? "");
  const allDone = plan.total > 0 && plan.completed === plan.total;

  const finish = () => {
    const st = useData.getState();
    if (text.trim() !== (journal?.body ?? "").trim()) {
      const id = st.journalNote(today);
      st.updateNote(id, { body: text.trim() });
    }
    st.updateSettings({ dayReviewedOn: today });
    haptic("success");
    nav.toast("День закрыт. До завтра", { tone: "positive" });
    close();
  };

  return (
    <Sheet
      tall
      ariaLabel="Итоги дня"
      footer={
        <Button block onClick={finish}>
          Завершить день
        </Button>
      }
    >
      <div className="flex flex-col items-center px-6 pt-2 text-center">
        <Enso value={plan.total ? plan.completed / plan.total : 0} complete={allDone} size={124}>
          <div className="flex items-baseline">
            <span className="num-display text-[34px] leading-none">{plan.completed}</span>
            <span className="num text-callout text-ink-3">/{plan.total}</span>
          </div>
        </Enso>
        <h2 className="mt-4 text-title-2 font-semibold">Итоги дня</h2>
        <p className="mt-1.5 max-w-[300px] text-callout text-ink-2">
          {plan.total === 0
            ? "Сегодня без отмеченных дел. Завтра попробуйте начать с плана."
            : allDone
              ? "Всё, что планировали, — сделано."
              : `Сделано ${plan.completed} из ${plan.total}.`}
          {streak > 1 ? ` ${pluralN(streak, ["день", "дня", "дней"])} подряд с отмеченными делами.` : ""}
        </p>
      </div>

      {plan.done.length > 0 && (
        <div className="mt-6">
          <div className="px-5 pb-2.5 text-subhead font-medium text-ink-2">Сделано</div>
          <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
            {plan.done.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="fill-positive grid h-5 w-5 shrink-0 place-items-center rounded-full text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate text-subhead text-ink-2">{t.title}</span>
              </div>
            ))}
            {plan.done.length > 8 && <div className="px-4 py-2.5 text-footnote text-ink-3">и ещё {plan.done.length - 8}</div>}
          </div>
        </div>
      )}

      {leftRows.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between px-5 pb-2.5">
            <span className="text-subhead font-medium text-ink-2">Не успели</span>
            <button type="button" onClick={() => moveTasks(leftRows.map((t) => t.id), addDays(today, 1), "Перенесено на завтра")} className="text-subhead font-semibold text-accent-ink">
              Всё на завтра
            </button>
          </div>
          <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
            <AnimatePresence initial={false}>
              {leftRows.map((t) => {
                const tomorrow = addDays(today, 1);
                return (
                  <motion.div key={t.id} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-body">{t.title}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" aria-pressed={t.due === tomorrow} onClick={() => moveTasks([t.id], tomorrow)} className={cn("h-8 rounded-full px-3 text-footnote font-semibold", t.due === tomorrow ? "bg-ink text-ink-inverse" : "tile text-ink-2")}>
                        Завтра
                      </button>
                      <button type="button" aria-pressed={!t.due} onClick={() => moveTasks([t.id], undefined)} className={cn("h-8 rounded-full px-3 text-footnote font-semibold", !t.due ? "bg-ink text-ink-inverse" : "tile text-ink-2")}>
                        Позже
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="mt-6 px-4">
        <div className="px-1 pb-2.5 text-subhead font-medium text-ink-2">Пара строк о дне</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Что получилось? Что мешало? Что важно завтра?"
          className="panel w-full resize-none rounded-lg px-4 py-3 text-body leading-[23px] outline-none placeholder:text-ink-3"
        />
        <p className="px-1 pt-2 text-footnote text-ink-3">Сохранится в дневник — его видно в «Заметках».</p>
      </div>
    </Sheet>
  );
}
