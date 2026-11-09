import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Archive, CalendarRange, CheckCheck, Inbox, Layers, Plus, Sun, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { WEEKDAYS_SHORT, formatDate, plural, pluralN, weekdayIndex } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { AREA_PRESETS, dayPlan, doneByDay, doneStreak, isInbox, projectStats } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Project } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button, Group, IconChip, Row } from "../../ui/primitives";
import { Heading } from "./bits";
import { tr } from "../../i18n/i18n";

export function ListsView() {
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const today = useToday();
  const [showArchived, setShowArchived] = useState(false);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    const plan = dayPlan(tasks, today);
    return {
      inbox: open.filter(isInbox).length,
      today: plan.total - plan.completed,
      upcoming: open.filter((t) => t.due && t.due > today).length,
      all: open.length,
      doneWeek: doneByDay(tasks, today, 7).reduce((a, d) => a + d.count, 0)
    };
  }, [tasks, today]);

  const live = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <Tile icon={Inbox} tone="accent" label={tr("Входящие")} count={counts.inbox} onClick={() => nav.push("taskList", { kind: "inbox" })} />
        <Tile icon={Sun} tone="warning" label={tr("Сегодня")} count={counts.today} onClick={() => useUI.getState().setPlannerView("today")} />
        <Tile icon={CalendarRange} tone="positive" label={tr("Скоро")} count={counts.upcoming} onClick={() => nav.push("taskList", { kind: "upcoming" })} />
        <Tile icon={Layers} label={tr("Все дела")} count={counts.all} onClick={() => nav.push("taskList", { kind: "all" })} />
      </div>

      <section>
        <Heading title={tr("Списки")} action={{ label: tr("Новый"), onClick: () => nav.sheet("project", {}) }} />
        {live.length ? (
          <Group>
            {live.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </Group>
        ) : (
          <AreaStarter />
        )}
        {archived.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1.5 px-5 pb-2 text-footnote font-medium text-ink-2">
              <Archive size={14} />{tr("В архиве:")}{" "}{archived.length}
            </button>
            {showArchived && (
              <Group>
                {archived.map((p) => (
                  <ProjectRow key={p.id} project={p} />
                ))}
              </Group>
            )}
          </div>
        )}
      </section>

      <Group>
        <Row icon={CheckCheck} iconTone="positive" title={tr("Сделано")} subtitle={counts.doneWeek ? tr("{0} за 7 дней", pluralN(counts.doneWeek, ["дело", "дела", "дел"])) : tr("Здесь будет история")} chevron onClick={() => nav.push("taskList", { kind: "done" })} />
      </Group>

      <WeekStats />
    </div>
  );
}

function Tile({ icon, label, count, onClick, tone }: { icon: LucideIcon; label: string; count: number; onClick: () => void; tone?: "accent" | "positive" | "warning" }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.96 }} transition={spring.press} onClick={onClick} className="panel flex flex-col gap-3 rounded-[20px] p-3.5 text-left" aria-label={`${label}: ${count}`}>
      <div className="flex w-full items-center justify-between">
        <IconChip icon={icon} tone={tone} size={34} />
        <span className={cn("num-display text-[26px] leading-none", count ? "text-ink" : "text-ink-4")}>{count}</span>
      </div>
      <span className="text-subhead font-semibold text-ink">{label}</span>
    </motion.button>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const tasks = useData((s) => s.tasks);
  const today = useToday();
  const st = projectStats(project, tasks, today);
  const sub = [
    st.open ? pluralN(st.open, ["дело", "дела", "дел"]) : st.done ? tr("всё сделано") : tr("пусто"),
    st.overdue ? `${st.overdue} ${plural(st.overdue, ["просрочено", "просрочены", "просрочено"])}` : "",
    project.deadline ? tr("до {0}", formatDate(project.deadline)) : ""
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button type="button" onClick={() => nav.push("project", { id: project.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-press">
      <IconChip name={project.icon} color={project.color} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body text-ink">{project.name}</div>
        <div className={cn("truncate text-footnote", st.overdue ? "text-negative" : "text-ink-2")}>{sub}</div>
        {st.open + st.done > 0 && (
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
            <motion.div className="h-full rounded-full" style={{ background: project.color }} initial={{ width: 0 }} animate={{ width: `${st.progress * 100}%` }} transition={spring.smooth} />
          </div>
        )}
      </div>
    </button>
  );
}

/** First lists in one tap: areas of life. */
export function AreaStarter({ onDone }: { onDone?: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set([tr("Личное"), tr("Работа"), tr("Дом"), tr("Здоровье")]));
  return (
    <div className="mx-4 panel rounded-lg p-4">
      <div className="text-callout font-semibold">{tr("Разложите дела по сферам жизни")}</div>
      <p className="mt-1 text-footnote text-ink-2">{tr("Так видно, где всё под контролем, а где копятся хвосты. Списки можно переименовать и добавить свои.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {AREA_PRESETS.map((a) => {
          const on = picked.has(a.name);
          return (
            <button
              key={a.name}
              type="button"
              aria-pressed={on}
              onClick={() => {
                haptic();
                setPicked((s) => {
                  const n = new Set(s);
                  if (on) n.delete(a.name);
                  else n.add(a.name);
                  return n;
                });
              }}
              className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-subhead font-medium transition-colors", on ? "bg-ink text-ink-inverse" : "tile text-ink-2")}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              {a.name}
            </button>
          );
        })}
      </div>
      <Button
        size="md"
        className="mt-4"
        disabled={!picked.size}
        icon={Plus}
        onClick={() => {
          createAreas([...picked]);
          onDone?.();
        }}
      >{tr("Создать")}{" "}{pluralN(picked.size, ["список", "списка", "списков"])}
      </Button>
    </div>
  );
}

export function createAreas(names: string[]) {
  const st = useData.getState();
  const have = new Set(st.projects.map((p) => p.name.toLowerCase()));
  for (const a of AREA_PRESETS) if (names.includes(a.name) && !have.has(a.name.toLowerCase())) st.addProject({ name: a.name, icon: a.icon, color: a.color });
  haptic("success");
}

function WeekStats() {
  const tasks = useData((s) => s.tasks);
  const today = useToday();
  const days = useMemo(() => doneByDay(tasks, today, 7), [tasks, today]);
  const streak = useMemo(() => doneStreak(tasks, today), [tasks, today]);
  const total = days.reduce((a, d) => a + d.count, 0);
  const max = Math.max(1, ...days.map((d) => d.count));
  if (!total) return null;
  return (
    <section>
      <Heading title={tr("Ритм")} aside={streak > 1 ? tr("{0} подряд", pluralN(streak, ["день", "дня", "дней"])) : undefined} />
      <div className="mx-4 panel rounded-lg p-4">
        <div className="flex h-24 items-end gap-2">
          {days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="num text-caption text-ink-3">{d.count || ""}</span>
              <motion.div
                className="w-full rounded-[6px]"
                style={{ background: d.day === today ? "linear-gradient(180deg, var(--accent-hi), var(--accent-lo))" : "color-mix(in srgb, var(--ink) 22%, transparent)" }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (d.count / max) * 56)}px` }}
                transition={spring.smooth}
              />
              <span className={cn("text-caption", d.day === today ? "font-semibold text-accent-ink" : "text-ink-3")}>{WEEKDAYS_SHORT[weekdayIndex(d.day)]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-footnote text-ink-2">{tr("За неделю сделано")}{" "}{pluralN(total, ["дело", "дела", "дел"])}.</p>
      </div>
    </section>
  );
}
