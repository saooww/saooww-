import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Star, Target } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { goalPace, goalStatus, goalStatusText, type GoalStatus } from "../../lib/goals";
import { formatDate, pluralN } from "../../lib/dates";
import { goalInfo, goalSaved, type GoalInfo } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import type { Goal } from "../../store/types";
import { TaskCheck } from "../planner/TaskRow";
import { GoalPaceChart } from "./GoalPace";
import { formatMoney } from "../../lib/money";
import { useAppData, useBalances, useEnvelopes, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { Button, EmptyState, IconButton } from "../../ui/primitives";
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

  const [i, setI] = useState(0);
  const at = Math.min(i, Math.max(0, items.length - 1));
  const cur = items[at];
  const color = cur ? (cur.info.done ? "#2e9d72" : cur.g.color ?? "#df0714") : "#df0714";
  const go = (n: number) => {
    const next = Math.max(0, Math.min(items.length - 1, n));
    if (next !== at) haptic();
    setI(next);
  };

  return (
    <Screen title={tr("Цели")} actions={<IconButton icon={Plus} label={tr("Новая цель")} onClick={() => nav.sheet("goal")} />}>
      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tr("Поставьте первую цель")}
          text={tr("Квартира, автомобиль, отпуск или финансовая подушка — посчитаем, сколько откладывать в месяц.")}
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("goal")}>{tr("Новая цель")}</Button>}
        />
      ) : (
        <div className="relative text-white">
          {/* the page takes the colour of the goal on view */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0"
            style={{ top: "calc(-1 * (var(--safe-top) + 52px))", height: "calc(var(--safe-top) + 52px + 780px)" }}
            animate={{ background: `radial-gradient(90% 55% at 50% 32%, ${color}, color-mix(in srgb, ${color} 30%, #050505) 62%, var(--bg))` }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="relative"
            drag={items.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50 || info.velocity.x < -400) go(at + 1);
              else if (info.offset.x > 50 || info.velocity.x > 400) go(at - 1);
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={cur.g.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
                <GoalPage g={cur.g} info={cur.info} status={cur.status} />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {items.length > 1 && (
            <div className="relative mt-4 flex justify-center gap-[6px]" role="tablist" aria-label={tr("Цели")}>
              {items.map((x, k) => (
                <button key={x.g.id} type="button" role="tab" aria-selected={k === at} aria-label={x.g.name} onClick={() => go(k)} className="grid h-5 place-items-center">
                  <motion.span className={cn("block h-[6px] rounded-full", k === at ? "bg-white" : "bg-white/35")} animate={{ width: k === at ? 20 : 6 }} />
                </button>
              ))}
            </div>
          )}

          <GoalActions g={cur.g} info={cur.info} />

          {/* every goal in one short list, with the total */}
          {items.length > 1 && (
            <section className="relative mt-8">
              <div className="flex items-baseline justify-between px-5 pb-2.5">
                <h2 className="text-title-3 font-semibold text-ink">{tr("Все цели")}</h2>
                <span className="text-footnote text-ink-2">
                  <Money value={saved} currency={base} privacy /> {tr("из")} <Money value={target} currency={base} />
                </span>
              </div>
              <div className="panel mx-4 overflow-hidden rounded-[22px] text-ink [&>*+*]:hairline-t">
                {items.map(({ g, info }, k) => (
                  <button key={g.id} type="button" onClick={() => go(k)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", k === at && "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]")}>
                    <MiniRing value={info.progress} color={info.done ? "#2e9d72" : g.color ?? "#df0714"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-callout font-medium">{g.name}</span>
                      <span className="block truncate text-caption text-ink-2">{info.done ? tr("Цель достигнута") : info.monthly ? tr("{0} в месяц", formatMoney(info.monthly, { currency: g.currency })) : tr("Без срока")}</span>
                    </span>
                    <span className="num text-callout font-semibold">{Math.floor(info.progress * 100)}%</span>
                  </button>
                ))}
              </div>
              <div className={cn("mt-2 px-5 text-footnote", late ? "text-warning" : "text-ink-2")}>
                {late ? `${pluralN(late, ["цель", "цели", "целей"])} ${late === 1 ? tr("отстаёт") : tr("отстают")}` : tr("Всё идёт по плану")}
                {monthly ? ` · ${tr("откладывать {0} в месяц", formatMoney(monthly, { currency: base }))}` : ""}
              </div>
            </section>
          )}
        </div>
      )}
    </Screen>
  );
}

/** One goal: its name, a large lit ring with the share saved, and what is left. */
function GoalPage({ g, info, status }: { g: Goal; info: GoalInfo; status: GoalStatus }) {
  const st = goalStatusText(status, g.currency);
  const R = 116;
  const C = 2 * Math.PI * R;
  const p = Math.max(0.004, info.progress);
  return (
    <div className="on-dark px-5 text-center">
      <div className="flex items-center justify-center gap-1.5 text-title-3 font-semibold">
        <span className="truncate">{g.name}</span>
        {g.primary && <Star size={15} className="shrink-0 fill-current" />}
      </div>
      <div className="mt-0.5 text-footnote text-white/75">
        {g.deadline ? tr("до {0}", formatDate(g.deadline, { year: "auto" })) : tr("Без срока")} · {info.done ? tr("достигнута") : st.tone === "warning" ? tr("отстаёт") : st.tone === "positive" ? tr("по плану") : tr("в пути")}
      </div>
      <button type="button" onClick={() => nav.push("goal", { id: g.id })} aria-label={tr("Открыть цель «{0}»", g.name)} className="relative mx-auto mt-5 block h-[264px] w-[264px] active:opacity-90">
        <svg width="264" height="264" viewBox="0 0 264 264" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <defs>
            <filter id="goal-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          <circle cx="132" cy="132" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="20" />
          <circle cx="132" cy="132" r={R} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} filter="url(#goal-glow)" opacity="0.7" />
          <motion.circle cx="132" cy="132" r={R} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - p) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span>
            <span className="num-display block text-[64px] leading-none">{info.done ? "✓" : `${Math.floor(info.progress * 100)}%`}</span>
            <Money value={info.saved} currency={g.currency} privacy className="mt-2 block text-callout font-semibold" />
            <span className="block text-caption text-white/70">
              {tr("из")} <Money value={g.target} currency={g.currency} />
            </span>
          </span>
        </span>
      </button>
      <div className="mx-auto mt-5 max-w-[340px] text-left text-white">
        <GoalPaceChart goal={g} info={info} />
      </div>
    </div>
  );
}

/** What is left and the monthly amount, «Пополнить», and the next task of the goal's list. */
function GoalActions({ g, info }: { g: Goal; info: GoalInfo }) {
  const tasks = useData((s) => s.tasks);
  const open = g.projectId ? tasks.filter((t) => t.projectId === g.projectId && !t.done) : [];
  const glass = { background: "rgba(0,0,0,0.3)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.14)" } as const;
  return (
    <div className="on-dark relative mx-4 mt-5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] px-4 py-3" style={glass}>
          <div className="text-caption text-white/70">{tr("Осталось")}</div>
          <Money value={info.remaining} currency={g.currency} privacy variant="hero" className="mt-0.5 block text-[20px] leading-tight" />
        </div>
        <div className="rounded-[20px] px-4 py-3" style={glass}>
          <div className="text-caption text-white/70">{tr("В месяц")}</div>
          <div className="num-display mt-0.5 text-[20px] leading-tight">{info.monthly && !info.done ? formatMoney(info.monthly, { currency: g.currency }) : "—"}</div>
        </div>
      </div>
      {!info.done && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            haptic();
            nav.sheet("goalMoney", { goalId: g.id, direction: "deposit" });
          }}
          className="mt-2.5 flex h-[54px] w-full items-center justify-center gap-1.5 rounded-[20px] bg-white text-headline font-bold text-black"
        >
          <Plus size={18} strokeWidth={2.6} />
          {tr("Пополнить")}
        </motion.button>
      )}
      {open.length > 0 && (
        <div className="mt-2.5 flex items-center gap-3 rounded-[20px] px-4 py-3" style={glass}>
          <TaskCheck task={open[0]} size={22} />
          <button type="button" onClick={() => nav.sheet("task", { editId: open[0].id })} className="min-w-0 flex-1 truncate text-left text-callout">
            {open[0].title}
          </button>
          {open.length > 1 && (
            <button type="button" onClick={() => nav.push("project", { id: g.projectId! }, "planner")} className="shrink-0 text-footnote text-white/70">
              {tr("ещё {0}", open.length - 1)} ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MiniRing({ value, color }: { value: number; color: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * Math.max(0.02, value)} ${c}`} />
    </svg>
  );
}
