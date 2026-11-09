import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCheck, Flag, Flame, Mountain, PiggyBank, ReceiptText, Stamp, TrendingUp, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { goalInfo, goalSaved } from "../../lib/finance";
import { personalProgress, type AchievementId } from "../../lib/progress";
import { safeToSpend } from "../../lib/safeToSpend";
import { useAppData, useBalances, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { tr } from "../../i18n/i18n";

const BADGES: Record<AchievementId, { icon: LucideIcon; title: string; hint: string }> = {
  first: { icon: Stamp, title: tr("Первая запись"), hint: tr("Записать первую операцию") },
  hundred: { icon: ReceiptText, title: tr("100 операций"), hint: tr("Сто записей — привычка") },
  normWeek: { icon: Flame, title: tr("Неделя в норме"), hint: tr("7 дней подряд без перерасхода") },
  tasksStreak: { icon: CheckCheck, title: tr("Серия дел"), hint: tr("5 дней подряд со сделанным делом") },
  plusMonth: { icon: TrendingUp, title: tr("Месяц в плюсе"), hint: tr("Доходы больше расходов за месяц") },
  halfGoal: { icon: Flag, title: tr("Полпути"), hint: tr("Цель накоплена наполовину") },
  goalDone: { icon: Mountain, title: tr("Вершина"), hint: tr("Цель достигнута") },
  journal: { icon: BookOpen, title: tr("Дневник"), hint: tr("7 записей в дневнике") }
};

/** «Ваш путь»: streaks and achievements at the top of the profile. */
export function ProgressPanel() {
  const data = useAppData();
  const { entries } = useLedger();
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();

  const p = useMemo(() => {
    const goalShares = data.goals.filter((g) => !g.archived).map((g) => goalInfo(g, goalSaved(g, env, balances), today).progress);
    const norm = safeToSpend(data, balances, entries, today)?.allowance ?? 0;
    return personalProgress({ entries, transactions: data.transactions, tasks: data.tasks, notes: data.notes, goalShares, norm, today });
  }, [data, entries, balances, env, today]);
  const earned = p.achievements.filter((a) => a.done).length;

  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between px-5 pb-2.5">
        <h2 className="section-label">{tr("Ваш путь")}</h2>
        <span className="text-caption text-ink-3">{tr("{0} из {1} наград", earned, p.achievements.length)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4">
        <Stat icon={Flame} value={p.normStreak} label={tr("дней в норме подряд")} />
        <Stat icon={CheckCheck} value={p.tasksStreak} label={tr("дней с делами подряд")} />
        <Stat icon={PiggyBank} value={p.plusMonths} label={tr("месяцев в плюсе за год")} />
      </div>
      <div className="scroll-x mt-3 flex gap-2.5 px-4 pb-1" role="list" aria-label={tr("Награды")}>
        {p.achievements.map((a, i) => {
          const b = BADGES[a.id];
          const R = 25;
          const C = 2 * Math.PI * R;
          return (
            <motion.div
              key={a.id}
              role="listitem"
              aria-label={`${b.title}: ${a.done ? tr("получено") : b.hint}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35 }}
              className="tile flex w-[92px] shrink-0 flex-col items-center rounded-[18px] px-2 pb-3 pt-3 text-center"
            >
              <span className="relative grid h-[58px] w-[58px] place-items-center">
                <svg width="58" height="58" viewBox="0 0 58 58" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="29" cy="29" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
                  <circle cx="29" cy="29" r={R} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - a.progress)} />
                </svg>
                <span className={cn("grid h-[42px] w-[42px] place-items-center rounded-full", a.done ? "fill-accent text-[var(--accent-on)]" : "text-ink-3")}>
                  <b.icon size={20} weight={a.done ? "fill" : undefined} />
                </span>
              </span>
              <span className={cn("mt-2 text-caption font-semibold leading-tight", a.done ? "text-ink" : "text-ink-2")}>{b.title}</span>
            </motion.div>
          );
        })}
        <span className="w-1 shrink-0" />
      </div>
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="tile flex flex-col rounded-[18px] px-3 pb-3 pt-2.5">
      <Icon size={16} className="text-accent-ink" />
      <span className="num-display mt-1.5 text-[28px] leading-none text-ink">{value}</span>
      <span className="mt-1 text-caption leading-tight text-ink-2">{label}</span>
    </div>
  );
}
