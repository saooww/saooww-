import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { diffDays, eachDay, endOfMonth, parseDay, startOfMonth } from "../../lib/dates";
import { freeCash, monthForecast } from "../../lib/analytics";
import { formatMoney } from "../../lib/money";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { tr } from "../../i18n/i18n";

/**
 * «Дневной бюджет» — the heart of the home screen: what can still be spent
 * today, recounted after every operation; the month's spending so far and
 * where it is heading; what will be left by the end of the month and what
 * is still to be paid. Crossing today's norm brings a warning.
 */
export function DayBudget() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  const cash = useMemo(() => freeCash(data, balances, entries, today), [data, balances, entries, today]);
  const fc = useMemo(() => monthForecast(data, entries, today), [data, entries, today]);

  // the month's spending, day by day, and its likely path to the end
  const curve = useMemo(() => {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    const byDay = new Map<string, number>();
    for (const e of entries) if (e.tx.kind === "expense" && e.day >= from && e.day <= today) byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.base);
    let run = 0;
    const actual = eachDay(from, today).map((d) => (run += byDay.get(d) ?? 0));
    const total = diffDays(to, from) + 1;
    return { actual, total, end: fc.projected };
  }, [entries, today, fc.projected]);

  // a warning when an operation takes today over the norm, or close to it
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (!s || s.allowance <= 0) return;
    const before = prev.current;
    prev.current = s.today;
    if (before === null || s.today >= before) return;
    if (before >= 0 && s.today < 0) nav.toast(tr("Норма дня превышена на {0}. Завтрашняя норма станет меньше.", formatMoney(-s.today, { currency: base })), { tone: "warning" });
    else if (before > s.allowance * 0.2 && s.today >= 0 && s.today <= s.allowance * 0.2) nav.toast(tr("На сегодня осталось {0} — меньше пятой части нормы", formatMoney(s.today, { currency: base })), { tone: "warning" });
  }, [s, base]);

  if (!s || s.allowance <= 0) {
    return (
      <button type="button" onClick={() => nav.tab("wallets")} aria-label={tr("Карта дня")} className="panel mx-4 mt-5 block w-[calc(100%-32px)] rounded-[22px] p-5 text-left">
        <div className="section-label">{tr("Дневной бюджет")}</div>
        <div className="mt-2 text-headline font-semibold">{tr("Добавьте остатки — посчитаю сумму на день")}</div>
      </button>
    );
  }

  const over = s.today < 0;
  const low = !over && s.today <= s.allowance * 0.3;
  const status = over ? { text: tr("Сверх нормы"), cls: "bg-[var(--negative-soft)] text-negative" } : low ? { text: tr("Мало осталось"), cls: "bg-[var(--warning-soft)] text-warning" } : { text: tr("В норме"), cls: "bg-[var(--positive-soft)] text-positive" };

  // the chart: spent so far (solid) and the forecast (dashed) on one scale
  const W = 300;
  const H = 64;
  const max = Math.max(curve.end, curve.actual[curve.actual.length - 1] ?? 0, 1);
  const x = (i: number) => (i / (curve.total - 1)) * W;
  const y = (v: number) => H - 4 - (v / max) * (H - 10);
  const n = curve.actual.length;
  const solid = curve.actual.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = curve.actual[n - 1] ?? 0;

  return (
    <motion.button
      type="button"
      aria-label={`${over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}: ${Math.abs(s.today) / 100} ${base}`}
      onClick={() => {
        haptic();
        nav.sheet("day");
      }}
      whileTap={{ scale: 0.985 }}
      transition={spring.press}
      className="panel mx-4 mt-5 block w-[calc(100%-32px)] rounded-[24px] px-5 pb-4 pt-4 text-left"
    >
      <div className="flex items-center justify-between">
        <span className="section-label">{tr("Дневной бюджет")}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-semibold", status.cls)}>{status.text}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <AnimatedMoney value={Math.abs(s.today)} currency={base} variant="hero" privacy className={cn("text-[44px] leading-none", over ? "text-negative" : "text-ink")} />
        <span className="text-footnote text-ink-2">{over ? tr("сверх нормы") : tr("можно сегодня")}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-[72px] w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="db-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <filter id="db-glow" x="-10%" y="-80%" width="120%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <line x1="0" x2={W} y1={H - 4} y2={H - 4} stroke="var(--line)" />
        <motion.path d={`${solid} L${x(n - 1).toFixed(1)} ${H - 4} L0 ${H - 4} Z`} fill="url(#db-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <path d={`M${x(n - 1)} ${y(last)} L${W} ${y(curve.end)}`} stroke="var(--ink-3)" strokeWidth="1.6" strokeDasharray="4 5" fill="none" vectorEffect="non-scaling-stroke" />
        <path d={solid} stroke="var(--accent)" strokeWidth="5" fill="none" opacity="0.7" filter="url(#db-glow)" />
        <motion.path d={solid} stroke="var(--accent-hi, var(--accent))" strokeWidth="2.6" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-3">
        <span>{tr("потрачено {0}", formatMoney(last, { currency: base }))}</span>
        <span>{tr("к {0} ≈ {1}", `${parseDay(endOfMonth(today)).getDate()}`, formatMoney(curve.end, { currency: base }))}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
        <Fact label={tr("Потрачено сегодня")}>
          <Money value={s.spentToday} currency={base} privacy />
        </Fact>
        <Fact label={tr("Останется к концу месяца")}>
          <Money value={cash.free} currency={base} privacy sign="always" tone={cash.free < 0 ? "negative" : "positive"} />
        </Fact>
        <Fact label={tr("Платежи до конца месяца")}>
          <Money value={cash.obligations} currency={base} privacy />
        </Fact>
      </div>
      <div className="mt-3 flex items-center justify-between text-caption text-ink-3">
        <span>{tr("Норма {0} в день · пересчёт после каждой операции", formatMoney(s.allowance, { currency: base }))}</span>
        <ChevronRight size={14} />
      </div>
    </motion.button>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-tight text-ink-3">{label}</div>
      <div className="mt-1 truncate text-subhead font-semibold">{children}</div>
    </div>
  );
}

