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

  const tiles: Array<{ n: number; label: string; aria?: string; onClick?: () => void; accent?: boolean }> = [
    { n: completed, label: tr("Сделано") },
    { n: left, label: tr("Осталось"), accent: left > 0 && evening },
    { n: focus, label: tr("Главных"), onClick: () => nav.sheet("planDay", { start: "focus" }) },
    { n: inbox, label: tr("Во входящих"), aria: tr("Во входящих {0}", pluralN(inbox, ["дело", "дела", "дел"])), onClick: inbox ? () => nav.sheet("planDay", { start: "inbox" }) : undefined }
  ];

  return (
    <section className="px-4">
      <div className="px-1">
        <div className="text-subhead text-ink-2">{first ? tr("Привет, {0}", first) : capitalize(WEEKDAYS_LONG[weekdayIndex(today)])}</div>
        <h2 className="font-display mt-0.5 text-title-2">{title}</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {tiles.map((t, i) => (
          <motion.button
            key={t.label}
            type="button"
            disabled={!t.onClick}
            aria-label={t.aria}
            onClick={t.onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={t.onClick ? { scale: 0.96 } : undefined}
            className="panel flex h-[92px] flex-col items-center justify-center rounded-[22px]"
          >
            <span className={cn("num-display text-[32px] leading-none", t.accent ? "text-accent-ink" : "text-ink")}>{t.n}</span>
            <span className="mt-1.5 text-caption text-ink-2">{t.label}</span>
          </motion.button>
        ))}
      </div>
      {cta === "plan" && (
        <Button size="md" variant="tinted" block icon={Sunrise} className="mt-3" onClick={() => nav.sheet("planDay", {})}>{tr("Спланировать день")}</Button>
      )}
      {cta === "review" && (
        <Button size="md" variant="tinted" block icon={Moon} className="mt-3" onClick={() => nav.sheet("reviewDay", {})}>{tr("Подвести итоги")}</Button>
      )}
    </section>
  );
}
