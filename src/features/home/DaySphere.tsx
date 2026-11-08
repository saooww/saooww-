import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { dayPlan } from "../../lib/tasks";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { useLingering } from "../planner/actions";

const SIZE = 248; // drawn in 248 units, shown a little larger
const SHOWN = 276;
const R = 100; // the sphere, in a 248-wide box
const RING = 116; // the tasks ring around it

/** One wave of the liquid's surface, wide enough to slide by one period without a seam. */
function wave(amp: number, period: number, width: number): string {
  let d = `M 0 0`;
  for (let x = 0; x <= width; x += period / 2) {
    const up = (x / (period / 2)) % 2 === 0;
    d += ` Q ${x + period / 4} ${up ? -amp : amp} ${x + period / 2} 0`;
  }
  return `${d} L ${width} 400 L 0 400 Z`;
}

/**
 * «Сфера дня» — the day at a glance. The liquid is today's money: full in
 * the morning, it sinks as you spend; red when you're over. The ring around
 * fills with the day's tasks. Tap for the details.
 */
export function DaySphere() {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const keep = useLingering();
  const base = data.settings.baseCurrency;

  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  const plan = useMemo(() => dayPlan(tasks, today, keep), [tasks, today, keep]);

  const allowance = s?.allowance ?? 0;
  const left = s?.today ?? 0;
  const over = left < 0;
  const empty = !s || allowance <= 0;
  // how full the sphere is: today's money left (a sliver stays when it's all spent)
  const level = empty ? 0.12 : over ? 1 : Math.max(0.06, Math.min(1, left / allowance));
  const taskShare = plan.total ? plan.completed / plan.total : 0;
  const surfaceY = 124 + R - level * 2 * R; // top of the liquid in box coordinates
  const circ = 2 * Math.PI * RING;

  return (
    <motion.button
      type="button"
      aria-label={empty ? "Сфера дня" : `${over ? "Сегодня сверх нормы" : "Можно потратить сегодня"}: ${Math.abs(left) / 100} ${base}`}
      onClick={() => {
        haptic();
        nav.sheet("day");
      }}
      whileTap={{ scale: 0.97 }}
      className="relative mx-auto block"
      style={{ width: SHOWN, height: SHOWN }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SHOWN} height={SHOWN} aria-hidden="true" className="absolute inset-0 overflow-visible">
        <defs>
          <clipPath id={`c${id}`}>
            <circle cx="124" cy="124" r={R} />
          </clipPath>
          <linearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={over ? "var(--negative)" : "var(--accent-hi)"} />
            <stop offset="100%" stopColor={over ? "color-mix(in srgb, var(--negative) 60%, black)" : "var(--accent-lo)"} />
          </linearGradient>
          <radialGradient id={`g${id}`} cx="35%" cy="28%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
          </radialGradient>
        </defs>

        {/* the glass */}
        <circle cx="124" cy="124" r={R} fill="color-mix(in srgb, var(--ink) 5%, var(--surface))" />

        {/* the liquid: two waves sliding against each other */}
        <g clipPath={`url(#c${id})`}>
          <motion.g initial={false} animate={{ y: surfaceY }} transition={{ type: "spring", stiffness: 40, damping: 14 }}>
            <motion.path
              d={wave(7, 120, 480)}
              fill={`url(#l${id})`}
              opacity={0.45}
              animate={reduce ? undefined : { x: [-120, 0] }}
              transition={{ duration: 4.2, ease: "linear", repeat: Infinity }}
            />
            <motion.path
              d={wave(5, 90, 480)}
              fill={`url(#l${id})`}
              animate={reduce ? undefined : { x: [0, -90] }}
              transition={{ duration: 3, ease: "linear", repeat: Infinity }}
              transform="translate(0 5)"
            />
          </motion.g>
        </g>

        {/* light and a hairline edge make it a sphere, not a disc */}
        <circle cx="124" cy="124" r={R} fill={`url(#g${id})`} />
        <circle cx="124" cy="124" r={R - 0.5} fill="none" stroke="var(--line-strong)" />

        {/* tasks ring */}
        <circle cx="124" cy="124" r={RING} fill="none" stroke="var(--line)" strokeWidth="5" />
        <motion.circle
          cx="124"
          cy="124"
          r={RING}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="5"
          strokeLinecap="round"
          transform="rotate(-90 124 124)"
          strokeDasharray={circ}
          initial={false}
          animate={{ strokeDashoffset: circ * (1 - taskShare) }}
          transition={{ type: "spring", stiffness: 50, damping: 16 }}
        />
      </svg>

      {/* the numbers, legible over glass and liquid alike */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ textShadow: level > 0.55 ? "0 1px 12px rgba(0,0,0,0.35)" : undefined }}>
        <span className={level > 0.55 ? "text-caption font-semibold text-white/85" : "section-label"}>{empty ? "Сегодня" : over ? "Сверх нормы" : "Можно сегодня"}</span>
        {empty ? (
          <span className="mt-1 px-10 text-subhead font-medium text-ink-2">Добавьте остатки — посчитаю сумму на день</span>
        ) : (
          <AnimatedMoney value={Math.abs(left)} currency={base} variant="hero" privacy className={level > 0.55 ? "mt-0.5 text-[40px] leading-none text-white" : "mt-0.5 text-[40px] leading-none text-ink"} />
        )}
        {!empty && (
          <span className={level > 0.55 ? "mt-1.5 text-caption text-white/80" : "mt-1.5 text-caption text-ink-2"}>
            из <Money value={allowance} currency={base} privacy /> на день
          </span>
        )}
        <span className={level > 0.3 ? "mt-2 rounded-full bg-black/20 px-2.5 py-0.5 text-caption font-semibold text-white" : "mt-2 rounded-full bg-[var(--chart-grid)] px-2.5 py-0.5 text-caption font-semibold text-ink-2"}>
          {plan.total ? `Дела ${plan.completed} из ${plan.total}` : "Дел нет"}
        </span>
      </div>
    </motion.button>
  );
}
