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
import { ProgressBar, Button, EmptyState, IconButton } from "../../ui/primitives";
import { GoalVisual } from "./GoalVisual";
import { HeroCard } from "../../ui/HeroCard";
import { materialOf } from "../../store/catalog";
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
          <HeroCard material={materialOf("obsidian")} className="mb-4" style={{ ["--ink" as string]: "#f5f3f0", ["--ink-2" as string]: "rgba(245,243,240,0.72)", ["--ink-3" as string]: "rgba(245,243,240,0.55)", ["--line" as string]: "rgba(255,255,255,0.12)" }}>
            <div className="px-5 pb-[18px] pt-[18px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{tr("Накоплено на")}{" "}{pluralN(items.length, ["цель", "цели", "целей"])}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-semibold", late ? "bg-[var(--warning-soft)] text-warning" : "bg-[var(--positive-soft)] text-positive")}>{late ? `${pluralN(late, ["цель", "цели", "целей"])} ${late === 1 ? tr("отстаёт") : tr("отстают")}` : tr("Всё идёт по плану")}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <Money value={saved} currency={base} privacy variant="hero" className="text-[40px] leading-none" />
                {target > 0 && <span className="num text-headline font-semibold text-ink-2">{Math.floor((saved / target) * 100)}%</span>}
              </div>
              {target > 0 && <ProgressBar value={saved / target} tone="positive" height={8} className="mt-4" />}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-caption text-ink-3">{tr("Осталось накопить")}</div>
                  <Money value={Math.max(0, target - saved)} currency={base} privacy className="mt-0.5 block text-headline font-semibold" />
                </div>
                <div>
                  <div className="text-caption text-ink-3">{tr("Откладывать в месяц")}</div>
                  <div className="num mt-0.5 text-headline font-semibold">{monthly ? formatMoney(monthly, { currency: base }) : "—"}</div>
                </div>
              </div>
            </div>
          </HeroCard>
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
