import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Moon, Sunrise } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { WEEKDAYS_LONG, capitalize, pluralN, weekdayIndex } from "../../lib/dates";
import { dayPlan, isInbox } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button, Group } from "../../ui/primitives";
import { EventRow, useEvents } from "../plans/Plans";
import { moveTasks, useLingering } from "./actions";
import { Heading, Invite, InviteButton } from "./bits";
import { Schedule } from "./Schedule";
import { MonthCalendar } from "./MonthCalendar";
import { TaskList } from "./TaskRow";
import { tr } from "../../i18n/i18n";

export function TodayView() {
  const tasks = useData((s) => s.tasks);
  const keep = useLingering();
  const today = useToday();
  const plan = useMemo(() => dayPlan(tasks, today, keep), [tasks, today, keep]);
  const inbox = useMemo(() => tasks.filter(isInbox).length, [tasks]);
  const money = useEvents(today, today).filter((e) => e.kind !== "task" && !e.done);
  const [showDone, setShowDone] = useState(false);
  const empty = !plan.focus.length && !plan.rest.length;

  return (
    <div className="flex flex-col gap-6">
      <SleepPrompt />
      <DayCard total={plan.total} completed={plan.completed} focus={plan.focus.length} inbox={inbox} />
      <MonthCalendar />

      <section>
        <Heading
          title={tr("Главное")}
          aside={plan.focus.length ? tr("{0} из {1}", plan.focus.filter((t) => t.done).length, plan.focus.length) : undefined}
          action={plan.focus.length ? { label: plan.focus.length < 3 ? tr("Добавить") : tr("Изменить"), onClick: () => nav.sheet("planDay", { start: "focus" }) } : undefined}
        />
        <TaskList
          tasks={plan.focus}
          seal
          showDate={false}
          empty={<Invite text={tr("До трёх дел, без которых день не засчитан")} action={<InviteButton onClick={() => nav.sheet("planDay", { start: "focus" })}>{tr("Выбрать")}</InviteButton>} />}
        />
      </section>

      {(plan.rest.length > 0 || empty) && (
        <section>
          <Heading title={plan.focus.length ? tr("Ещё сегодня") : tr("Сегодня")} aside={plan.rest.length || undefined} />
          <TaskList
            tasks={plan.rest}
            showDate={false}
            empty={<Invite text={tr("На сегодня больше ничего")} action={<InviteButton onClick={() => nav.sheet("quickAdd", { due: today })}>{tr("Записать дело")}</InviteButton>} />}
          />
        </section>
      )}

      <Schedule />

      {plan.overdue.length > 0 && (
        <section>
          <Heading title={tr("С прошлых дней")} tone="negative" aside={plan.overdue.length} action={{ label: tr("Всё на сегодня"), onClick: () => moveTasks(plan.overdue.filter((t) => !t.done).map((t) => t.id), today, tr("Перенесено на сегодня")) }} />
          <TaskList tasks={plan.overdue} />
        </section>
      )}

      {money.length > 0 && (
        <section>
          <Heading title={tr("Деньги сегодня")} aside={money.length} />
          <Group>
            {money.map((e) => (
              <EventRow key={e.key} e={e} hideDate />
            ))}
          </Group>
        </section>
      )}

      {plan.done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 px-5 pb-2.5 text-subhead font-medium text-ink-2" aria-expanded={showDone}>{tr("Сделано сегодня")}<span className="num text-ink-3">{plan.done.length}</span>
            <ChevronDown size={15} className={cn("transition-transform duration-200", showDone && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.smooth} className="overflow-hidden">
                <TaskList tasks={plan.done} showDate={false} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

/** One quiet line in the morning: the night is not recorded yet. */
function SleepPrompt() {
  const today = useToday();
  const has = useData((s) => s.sleep.some((e) => e.day === today));
  const any = useData((s) => s.sleep.length > 0);
  if (has || new Date().getHours() >= 15) return null;
  return (
    <button type="button" onClick={() => nav.sheet("sleep", { day: today })} className="panel -mb-2 mx-4 flex items-center gap-3 rounded-[18px] px-3.5 py-2.5 text-left active:opacity-80">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-[var(--sleep)]" style={{ background: "color-mix(in srgb, var(--sleep) 15%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--sleep) 32%, transparent)" }}>
        <Moon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-callout font-semibold">{tr("Как вы спали?")}</span>
        <span className="block truncate text-footnote text-ink-2">{any ? tr("Запишите ночь за минуту") : tr("Следите за сном и самочувствием")}</span>
      </span>
    </button>
  );
}

function DayCard({ total, completed, focus, inbox }: { total: number; completed: number; focus: number; inbox: number }) {
  const today = useToday();
  const name = useData((s) => s.settings.name);
  const planned = useData((s) => s.settings.dayPlannedOn === today);
  const reviewed = useData((s) => s.settings.dayReviewedOn === today);
  const hour = new Date().getHours();
  const allDone = total > 0 && completed === total;
  const left = total - completed;
  const evening = hour >= 17;
  // Nothing to review on an empty day — offer to plan it instead.
  const cta = evening && !reviewed && total > 0 ? "review" : !planned && hour < 17 ? "plan" : !planned && total === 0 ? "plan" : null;
  const first = name.trim().split(/\s+/)[0];
  const title = total === 0 ? tr("Дел на сегодня пока нет") : allDone ? tr("Всё сделано. Можно выдохнуть") : tr("{0} на сегодня", pluralN(left, ["дело", "дела", "дел"]));

  const ratio = total ? completed / total : 0;
  const R = 30;
  const C = 2 * Math.PI * R;
  const chips: Array<{ n: number; label: string; aria?: string; onClick?: () => void }> = [
    { n: focus, label: tr("Главных"), onClick: () => nav.sheet("planDay", { start: "focus" }) },
    { n: inbox, label: tr("Во входящих"), aria: tr("Во входящих {0}", pluralN(inbox, ["дело", "дела", "дел"])), onClick: inbox ? () => nav.sheet("planDay", { start: "inbox" }) : undefined }
  ];

  return (
    <section className="px-4">
      <div className="panel relative overflow-hidden rounded-[22px] p-4">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 120% at 0% 0%, var(--plan-soft), transparent 65%)" }} />
        <div className="relative flex items-center gap-4">
          <div className="relative h-[72px] w-[72px] shrink-0" role="img" aria-label={tr("{0} из {1}", completed, total)}>
            <svg viewBox="0 0 72 72" className="-rotate-90">
              <circle cx="36" cy="36" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
              <motion.circle cx="36" cy="36" r={R} fill="none" stroke="var(--plan)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - ratio) }} transition={spring.smooth} style={{ filter: "drop-shadow(0 0 6px var(--plan))" }} />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[17px] font-bold tabular-nums">
              {completed}<span className="text-[12px] font-medium text-ink-3">/{total}</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-footnote text-ink-2">{first ? tr("Привет, {0}", first) : capitalize(WEEKDAYS_LONG[weekdayIndex(today)])}</div>
            <h2 className="font-display mt-0.5 text-[20px] leading-[26px] tracking-[-0.01em]">{title}</h2>
          </div>
        </div>
        <div className="relative mt-3.5 flex gap-2">
          {chips.map((t) => (
            <button key={t.label} type="button" disabled={!t.onClick} aria-label={t.aria} onClick={t.onClick} className="tile flex h-9 items-center gap-2 rounded-[12px] px-3 text-footnote text-ink-2 enabled:active:opacity-70">
              <span className="num text-[15px] font-semibold text-ink">{t.n}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {cta === "plan" && (
        <Button size="md" variant="secondary" block icon={Sunrise} className="mt-2.5" onClick={() => nav.sheet("planDay", {})}>{tr("Спланировать день")}</Button>
      )}
      {cta === "review" && (
        <Button size="md" variant="secondary" block icon={Moon} className="mt-2.5" onClick={() => nav.sheet("reviewDay", {})}>{tr("Подвести итоги")}</Button>
      )}
    </section>
  );
}
