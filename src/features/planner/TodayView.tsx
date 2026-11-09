import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Inbox, Moon, Sunrise } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_GEN, WEEKDAYS_LONG, capitalize, parseDay, pluralN, weekdayIndex } from "../../lib/dates";
import { dayPlan, isInbox } from "../../lib/tasks";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Button, Group, Row } from "../../ui/primitives";
import { EventRow, useEvents } from "../plans/Plans";
import { moveTasks, useLingering } from "./actions";
import { Heading, Invite, InviteButton } from "./bits";
import { Enso } from "./Enso";
import { Schedule } from "./Schedule";
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
      <DayCard total={plan.total} completed={plan.completed} />

      {inbox > 0 && (
        <Group>
          <Row
            icon={Inbox}
            iconTone="accent"
            title={tr("Во входящих {0}", pluralN(inbox, ["дело", "дела", "дел"]))}
            subtitle={tr("Решите, когда за них взяться")}
            trailing={
              <>
                <span className="text-subhead font-semibold text-accent-ink max-[389px]:hidden">{tr("Разобрать")}</span>
                <ChevronRight size={18} className="-mr-1 hidden shrink-0 text-ink-3 max-[389px]:block" />
              </>
            }
            onClick={() => nav.sheet("planDay", { start: "inbox" })}
          />
        </Group>
      )}

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

const NARROW = "(max-width: 389px)";

/** True on small phones (iPhone SE, mini). Follows rotation and zoom. */
function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(NARROW);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW).matches,
    () => false
  );
}

function DayCard({ total, completed }: { total: number; completed: number }) {
  const today = useToday();
  const planned = useData((s) => s.settings.dayPlannedOn === today);
  const reviewed = useData((s) => s.settings.dayReviewedOn === today);
  const hour = new Date().getHours();
  const d = parseDay(today);
  const allDone = total > 0 && completed === total;
  const left = total - completed;

  const status = total === 0 ? tr("Дел на сегодня пока нет") : allDone ? tr("Всё сделано. Можно выдохнуть") : tr("Осталось {0}", pluralN(left, ["дело", "дела", "дел"]));
  const evening = hour >= 17;
  // Nothing to review on an empty day — offer to plan it instead.
  const cta = evening && !reviewed && total > 0 ? "review" : !planned && hour < 17 ? "plan" : !planned && total === 0 ? "plan" : null;
  const narrow = useNarrowScreen();

  return (
    <section className="mx-4 panel flex items-center gap-4 rounded-[24px] p-4 pr-5">
      <Enso value={total ? completed / total : 0} complete={allDone} size={narrow ? 86 : 104}>
        <div className="flex items-baseline">
          <span className="num-display text-[30px] leading-none text-ink">{completed}</span>
          <span className="num text-subhead text-ink-3">/{total}</span>
        </div>
      </Enso>
      <div className="min-w-0 flex-1">
        <div className="text-title-3 font-semibold">{capitalize(WEEKDAYS_LONG[weekdayIndex(today)])}</div>
        <div className="text-subhead text-ink-2">
          {d.getDate()} {MONTHS_GEN[d.getMonth()]}
        </div>
        <div className="mt-2 text-footnote text-ink-2">{status}</div>
        {cta === "plan" && (
          <Button size="sm" variant="tinted" icon={Sunrise} className="mt-3 max-w-full" onClick={() => nav.sheet("planDay", {})}>{tr("Спланировать день")}</Button>
        )}
        {cta === "review" && (
          <Button size="sm" variant="tinted" icon={Moon} className="mt-3 max-w-full" onClick={() => nav.sheet("reviewDay", {})}>{tr("Подвести итоги")}</Button>
        )}
      </div>
    </section>
  );
}
