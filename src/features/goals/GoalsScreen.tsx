import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Star, Target } from "lucide-react";
import { formatDate, pluralN } from "../../lib/dates";
import { goalInfo, goalSaved, type GoalInfo } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Goal } from "../../store/types";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, IconButton, ProgressBar } from "../../ui/primitives";

export function GoalsScreen() {
  const goals = useData((s) => s.goals);
  const balances = useBalances();
  const env = useEnvelopes();
  const today = useToday();
  const items = useMemo(
    () =>
      goals
        .filter((g) => !g.archived)
        .map((g) => ({ g, info: goalInfo(g, goalSaved(g, env, balances), today) }))
        .sort((a, b) => Number(!!b.g.primary) - Number(!!a.g.primary) || Number(a.info.done) - Number(b.info.done) || (a.g.deadline ?? "9") .localeCompare(b.g.deadline ?? "9")),
    [goals, env, balances, today]
  );
  const total = items.reduce((s, x) => s + x.info.saved, 0);

  return (
    <Screen title="Цели" large actions={<IconButton icon={Plus} label="Новая цель" onClick={() => nav.sheet("goal")} />}>
      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Поставьте первую цель"
          text="Квартира, автомобиль, отпуск или финансовая подушка — посчитаем, сколько откладывать в месяц."
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("goal")}>Новая цель</Button>}
        />
      ) : (
        <>
          <div className="px-5 pb-4 text-subhead text-ink-2">
            Накоплено <Money value={total} privacy className="font-semibold text-ink" /> · {pluralN(items.length, ["цель", "цели", "целей"])}
          </div>
          <div className="flex flex-col gap-3 px-4">
            {items.map(({ g, info }, i) => (
              <GoalCard key={g.id} goal={g} info={info} index={i} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

function GoalCard({ goal, info, index }: { goal: Goal; info: GoalInfo; index: number }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay: index * 0.04 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => nav.push("goal", { id: goal.id })}
      className="panel rounded-lg px-4 py-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full tile">
          <NamedIcon name={goal.icon} size={19} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-body font-semibold">{goal.name}</span>
            {goal.primary && <Star size={13} className="shrink-0 fill-current text-accent-ink" />}
          </div>
          <div className="truncate text-footnote text-ink-2">
            {info.done ? "Достигнута" : goal.deadline ? `до ${formatDate(goal.deadline, { year: "auto" })}` : "Без срока"}
            {!info.done && info.monthly ? ` · ${formatMoney(info.monthly, { currency: goal.currency })}/мес` : ""}
          </div>
        </div>
        <div className="text-title-3 font-semibold tnum">{Math.floor(info.progress * 100)}%</div>
      </div>
      <ProgressBar value={info.progress} tone={info.done ? "positive" : "accent"} className="mt-3.5" />
      <div className="mt-2 flex justify-between text-footnote text-ink-2">
        <Money value={info.saved} currency={goal.currency} privacy className="text-ink" />
        <span>
          из <Money value={goal.target} currency={goal.currency} />
        </span>
      </div>
    </motion.button>
  );
}
