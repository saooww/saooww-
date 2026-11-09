import { useMemo } from "react";
import { Plus, Target } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { goalPace, goalStatus } from "../../lib/goals";
import { pluralN } from "../../lib/dates";
import { goalInfo, goalSaved } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { useAppData, useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { Button, EmptyState, IconButton } from "../../ui/primitives";
import { GoalVisual } from "./GoalVisual";
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
          <div className="mx-5 mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-footnote text-ink-2">{tr("Накоплено на")}{" "}{pluralN(items.length, ["цель", "цели", "целей"])}</div>
              <Money value={saved} currency={base} privacy variant="hero" className="mt-0.5 block text-[30px]" />
              {target > 0 && <div className="text-footnote text-ink-3">{tr("из")}{" "}<Money value={target} currency={base} /></div>}
            </div>
            <div className="pb-1 text-right">
              <div className="text-caption text-ink-2">{tr("Откладывать в месяц")}</div>
              <div className="text-subhead font-semibold tnum">{monthly ? formatMoney(monthly, { currency: base }) : "—"}</div>
              <div className={cn("text-caption", late ? "text-warning" : "text-positive")}>{late ? `${pluralN(late, ["цель", "цели", "целей"])} ${late === 1 ? tr("отстаёт") : tr("отстают")}` : tr("Всё идёт по плану")}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 px-4">
            {items.map(({ g, info, status }, i) => (
              <GoalVisual key={g.id} goal={g} info={info} status={status} delay={i * 0.05} onOpen={() => nav.push("goal", { id: g.id })} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
