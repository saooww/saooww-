import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, Plus, Star, Target } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { goalPace, goalStatus, goalStatusText, type GoalStatus } from "../../lib/goals";
import { formatDate, pluralN } from "../../lib/dates";
import { goalInfo, goalSaved, type GoalInfo } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { useAppData, useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Goal } from "../../store/types";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, IconButton, ProgressBar } from "../../ui/primitives";
import { tr } from "../../i18n/i18n";

export function GoalsScreen() {
  const goals = useData((s) => s.goals);
  const data = useAppData();
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();
  const base = useData((s) => s.settings.baseCurrency);
  const items = useMemo(
    () =>
      goals
        .filter((g) => !g.archived)
        .map((g) => {
          const info = goalInfo(g, goalSaved(g, env, balances), today);
          return { g, info, status: goalStatus(g, info, goalPace(g, data, balances, today), today) };
        })
        .sort((a, b) => Number(!!b.g.primary) - Number(!!a.g.primary) || Number(a.info.done) - Number(b.info.done) || (a.g.deadline ?? "9").localeCompare(b.g.deadline ?? "9")),
    [goals, env, balances, data, today]
  );
  // totals in the base currency only — goals in other currencies are listed but not summed
  const inBase = items.filter((x) => x.g.currency === base);
  const saved = inBase.reduce((s, x) => s + x.info.saved, 0);
  const target = inBase.reduce((s, x) => s + x.g.target, 0);
  const monthly = inBase.reduce((s, x) => s + (!x.info.done && x.info.monthly ? x.info.monthly : 0), 0);
  const late = items.filter((x) => x.status.kind === "late").length;

  return (
    <Screen title={tr("Цели")} large actions={<IconButton icon={Plus} label={tr("Новая цель")} onClick={() => nav.sheet("goal")} />}>
      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tr("Поставьте первую цель")}
          text={tr("Квартира, автомобиль, отпуск или финансовая подушка — посчитаем, сколько откладывать в месяц.")}
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("goal")}>{tr("Новая цель")}</Button>}
        />
      ) : (
        <>
          {/* all goals at a glance */}
          <div className="panel mx-4 mb-4 rounded-lg px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-footnote font-medium text-ink-2">{tr("Накоплено на")}{" "}{pluralN(items.length, ["цель", "цели", "целей"])}</div>
                <Money value={saved} currency={base} privacy variant="hero" className="mt-0.5 block text-[28px] font-semibold" />
              </div>
              {target > 0 && <div className="pb-1 text-right text-footnote text-ink-2">{tr("из")}{" "}<Money value={target} currency={base} /></div>}
            </div>
            <ProgressBar value={target ? saved / target : 0} tone="ink" className="mt-3" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="tile rounded-[14px] px-3 py-2.5">
                <div className="text-caption text-ink-2">{tr("Откладывать в месяц")}</div>
                <div className="mt-0.5 text-subhead font-semibold tnum text-ink">{monthly ? formatMoney(monthly, { currency: base }) : "—"}</div>
              </div>
              <div className="tile rounded-[14px] px-3 py-2.5">
                <div className="text-caption text-ink-2">{tr("По графику")}</div>
                <div className={cn("mt-0.5 text-subhead font-semibold", late ? "text-warning" : "text-ink")}>{late ? `${pluralN(late, ["цель", "цели", "целей"])} ${late === 1 ? tr("отстаёт") : tr("отстают")}` : tr("Всё идёт по плану")}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-4">
            {items.map(({ g, info, status }, i) => (
              <GoalCard key={g.id} goal={g} info={info} status={status} index={i} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

const STATUS_TONE = { positive: "text-positive", warning: "text-warning", muted: "text-ink-2" };

function GoalCard({ goal, info, status, index }: { goal: Goal; info: GoalInfo; status: GoalStatus; index: number }) {
  const st = goalStatusText(status, goal.currency);
  const open = () => nav.push("goal", { id: goal.id });
  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay: index * 0.04 }}
      whileTap={{ scale: 0.985 }}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
      className="panel cursor-pointer rounded-lg px-4 py-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", info.done ? "bg-positive-soft text-positive" : "tile")} style={!info.done && goal.color ? { color: goal.color, background: `color-mix(in srgb, ${goal.color} 14%, transparent)` } : undefined}>
          {info.done ? <Check size={19} strokeWidth={2.4} /> : <NamedIcon name={goal.icon} size={19} strokeWidth={1.9} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-body font-semibold">{goal.name}</span>
            {goal.primary && <Star size={13} className="shrink-0 fill-current text-accent-ink" />}
          </div>
          <div className="truncate text-footnote text-ink-2">{goal.deadline ? tr("до {0}", formatDate(goal.deadline, { year: "auto" })) : tr("Без срока")}</div>
        </div>
        <div className="text-title-3 font-semibold tnum">{Math.floor(info.progress * 100)}%</div>
      </div>
      <ProgressBar value={info.progress} tone={info.done ? "positive" : "ink"} color={info.done ? undefined : goal.color} className="mt-3.5" />
      <div className="mt-2 flex justify-between text-footnote text-ink-2">
        <Money value={info.saved} currency={goal.currency} privacy className="text-ink" />
        <span>{tr("из")}{" "}<Money value={goal.target} currency={goal.currency} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <span className={cn("min-w-0 flex-1 truncate text-footnote font-medium", STATUS_TONE[st.tone])}>{st.text}</span>
        {!info.done && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic();
              nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" });
            }}
            className="tile flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-footnote font-semibold text-ink active:opacity-70"
          >
            <Plus size={14} strokeWidth={2.4} />{tr("Пополнить")}</button>
        )}
      </div>
    </motion.div>
  );
}
