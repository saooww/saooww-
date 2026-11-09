import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarRange, CheckCheck, Coffee, Flame, Sparkles, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { WEEKDAYS_LONG, formatDate, plural, pluralN } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { weekSummary, type WeekSummary } from "../../lib/week";
import { useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { Money } from "../../ui/Money";
import { ease } from "../../ui/motion";
import { Button, IconChip } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

/** Computes the week from the store. */
export function useWeekSummary(from: string | null): WeekSummary | null {
  const { entries } = useLedger();
  const tasks = useData((s) => s.tasks);
  const notes = useData((s) => s.notes);
  const categories = useCategoryMap();
  const today = useToday();
  return useMemo(() => (from ? weekSummary(entries, tasks, notes, categories, from, today) : null), [entries, tasks, notes, categories, from, today]);
}

/**
 * «Итоги недели»: money and tasks of one week on a single screen — what
 * came in and went out, where it went, what got done, what's next.
 */
export function WeekReviewSheet({ from }: { from: string }) {
  const w = useWeekSummary(from);
  const base = useData((s) => s.settings.baseCurrency);
  const update = useData((s) => s.updateSettings);
  const { close } = useSheet();
  if (!w) return null;

  const done = () => {
    haptic("success");
    update({ weekSeen: w.from });
    close();
  };
  const change = w.expenseChange;

  return (
    <Sheet title={tr("Итоги недели")} ariaLabel={tr("Итоги недели")} tall onClose={() => update({ weekSeen: w.from })}>
      <div className="px-5 pb-5 text-center">
        <div className="section-label">{w.label}</div>
        <div className="font-display mt-1 text-title-2 text-ink text-balance">{headline(w)}</div>
      </div>

      {/* money */}
      <Block title={tr("Деньги")} delay={0}>
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={ArrowUpRight} label={tr("Потрачено")}>
            <Money value={w.expense} currency={base} className="text-title-3 font-semibold" />
            {change !== null && (
              <div className={cn("text-caption font-medium", change > 0.05 ? "text-warning" : change < -0.05 ? "text-positive" : "text-ink-2")}>
                {change > 0 ? "↑" : change < 0 ? "↓" : ""} {Math.abs(Math.round(change * 100))}{tr("% к прошлой неделе")}</div>
            )}
          </Stat>
          <Stat icon={ArrowDownLeft} label={tr("Получено")}>
            <Money value={w.income} currency={base} tone={w.income > 0 ? "positive" : "default"} className="text-title-3 font-semibold" />
            <div className="text-caption text-ink-2">{tr("итог")}{" "}<Money value={w.net} currency={base} sign="always" />
            </div>
          </Stat>
        </div>
        {w.top.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {w.top.map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-3">
                <IconChip name={c.icon} color={c.color} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-subhead text-ink">{c.name}</span>
                    <Money value={c.amount} currency={base} className="shrink-0 text-subhead font-medium" />
                  </div>
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[var(--chart-grid)]">
                    <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${Math.max(4, c.share * 100)}%` }} transition={{ duration: 0.8, ease: ease.out, delay: 0.2 + i * 0.08 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 text-footnote text-ink-2">
          {w.biggest && (
            <Line icon={Flame}>{tr("Самая крупная трата —")}{" "}{w.biggest.title}, <Money value={w.biggest.amount} currency={base} className="text-ink" /> ({formatDate(w.biggest.day)})
            </Line>
          )}
          <Line icon={Coffee}>
            {w.noSpendDays > 0 ? tr("{0} без трат из {1}", pluralN(w.noSpendDays, ["день", "дня", "дней"]), w.daysCounted) : tr("Без трат не обошлось ни дня")}
          </Line>
        </div>
      </Block>

      {/* tasks */}
      <Block title={tr("Дела")} delay={0.08}>
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={CheckCheck} label={tr("Сделано")}>
            <div className="text-title-3 font-semibold tnum text-ink">{w.tasksDone}</div>
            <div className="text-caption text-ink-2">{plural(w.tasksDone, ["дело", "дела", "дел"])}</div>
          </Stat>
          <Stat icon={Sparkles} label={tr("Главное дня")}>
            <div className="text-title-3 font-semibold tnum text-ink">
              {w.focusDone}
              <span className="text-subhead font-normal text-ink-3">{tr("из")}{" "}{w.focusTotal}</span>
            </div>
            <div className="text-caption text-ink-2">{w.focusTotal ? tr("{0}% выполнено", Math.round((w.focusDone / w.focusTotal) * 100)) : tr("не выбирали")}</div>
          </Stat>
        </div>
        <div className="mt-4 flex flex-col gap-2 text-footnote text-ink-2">
          {w.bestDay && (
            <Line icon={Flame}>{tr("Самый продуктивный день —")}{" "}{WEEKDAYS_LONG[w.bestDay.weekday]}: {pluralN(w.bestDay.done, ["дело", "дела", "дел"])}
            </Line>
          )}
          <Line icon={BookOpen}>{w.journalDays ? tr("В дневнике {0}", pluralN(w.journalDays, ["запись", "записи", "записей"])) : tr("В дневнике пока пусто — пара строк вечером помогает")}</Line>
          <Line icon={CalendarRange}>{w.nextWeekTasks ? tr("На следующую неделю уже {0}", pluralN(w.nextWeekTasks, ["дело", "дела", "дел"])) : tr("Следующая неделя пока пустая")}</Line>
        </div>
      </Block>

      <div className="flex flex-col gap-2 px-4 pt-2">
        <Button block onClick={done}>{tr("Готово")}</Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            done();
            useUI.getState().setPlannerView("week");
            nav.tab("planner");
          }}
        >{tr("Открыть следующую неделю")}</Button>
      </div>
    </Sheet>
  );
}

function headline(w: WeekSummary): string {
  if (w.empty) return tr("Тихая неделя");
  if (w.focusTotal && w.focusDone === w.focusTotal) return tr("Всё главное сделано");
  if (w.expenseChange !== null && w.expenseChange < -0.1) return tr("Потратили меньше, чем неделей раньше");
  if (w.tasksDone >= 10) return tr("Насыщенная неделя");
  return tr("Вот как прошла неделя");
}

function Block({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: ease.out, delay }} className="mb-4 px-4">
      <div className="section-label px-1 pb-2.5">{title}</div>
      <div className="panel rounded-lg p-4">{children}</div>
    </motion.section>
  );
}

function Stat({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="tile rounded-[16px] px-3 py-3">
      <div className="flex items-center gap-1.5 text-caption font-medium text-ink-2">
        <Icon size={13} strokeWidth={2.2} />
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Line({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} strokeWidth={2} className="mt-[1px] shrink-0 text-ink-3" />
      <span>{children}</span>
    </div>
  );
}
