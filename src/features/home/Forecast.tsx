import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { capitalForecast } from "../../lib/analytics";
import { dayOf, diffDays, endOfMonth, formatDate, parseDay, pluralN, startOfMonth } from "../../lib/dates";
import { balanceSeries, totalWallets } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Sheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

export function useCapitalForecast() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  return useMemo(() => ({ f: capitalForecast(data, balances, entries, today), today, data, balances }), [data, balances, entries, today]);
}

/** In the red block: where the accounts will be on the last day of the month. */
export function ForecastStrip() {
  const { f, today } = useCapitalForecast();
  const base = useAppData().settings.baseCurrency;
  const delta = f.end - f.now;
  const last = parseDay(endOfMonth(today)).getDate();
  const glass = { background: "rgba(0,0,0,0.28)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.16)", backdropFilter: "blur(12px)" } as const;
  if (f.daysLeft <= 0) return null;
  return (
    <motion.button
      type="button"
      aria-label={tr("Прогноз на конец месяца")}
      onClick={() => {
        haptic();
        nav.sheet("forecast");
      }}
      onPointerDownCapture={(e) => e.stopPropagation()}
      whileTap={{ scale: 0.98 }}
      transition={spring.press}
      className="mt-4 block w-full rounded-[20px] px-4 py-3 text-left text-white"
      style={glass}
    >
      <span className="flex items-center justify-between text-caption text-white/80">
        <span>{tr("К {0} будет", `${last} ${formatMonthShort(today)}`)}</span>
        <span className="flex items-center gap-0.5">{pluralN(f.daysLeft, ["день", "дня", "дней"])}<ChevronRight size={13} className="opacity-70" /></span>
      </span>
      <span className="mt-0.5 flex items-baseline gap-2">
        <AnimatedMoney value={f.end} currency={base} variant="hero" privacy className="text-[26px] leading-tight" />
        <span className={cn("num text-footnote font-semibold", delta >= 0 ? "text-[#9bf5cf]" : "text-[#ffd0d0]")}>
          {delta >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(delta), { currency: base })}
        </span>
      </span>
    </motion.button>
  );
}

function formatMonthShort(day: string): string {
  return formatDate(endOfMonth(day), { long: true }).replace(/^\d+\s*/, "");
}

/** The forecast in full: the way to the end of the month and what it is made of. */
export function ForecastSheet() {
  const { f, today, data, balances } = useCapitalForecast();
  const base = data.settings.baseCurrency;
  const from = startOfMonth(today);
  const to = endOfMonth(today);
  const ids = useMemo(() => new Set(totalWallets(data.wallets).map((w) => w.id)), [data.wallets]);
  const actual = useMemo(() => balanceSeries(data, balances, ids, from, today), [data, balances, ids, from, today]);
  const delta = f.end - f.now;

  // one scale for the past and the future
  const days = diffDays(to, from) + 1;
  const all = [...actual.map((p) => p.value), ...f.path.map((p) => p.value)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const W = 320;
  const H = 150;
  const x = (day: string) => (diffDays(day, from) / Math.max(1, days - 1)) * W;
  const y = (v: number) => 12 + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 28);
  const line = (pts: Array<{ day: string; value: number }>) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const low = f.path.reduce((m, p) => (p.value < m.value ? p : m), f.path[0]);
  const tight = low.value < 0;

  const rows: Array<{ label: string; hint?: string; value: number; sign: "plus" | "minus" | "none" }> = [
    { label: tr("Сейчас на счетах"), value: f.now, sign: "none" },
    { label: tr("Ожидаемые доходы"), hint: tr("осталось получить"), value: f.incomeLeft, sign: "plus" },
    { label: tr("Платежи и подписки"), value: f.obligations, sign: "minus" },
    { label: tr("Обычные траты"), hint: f.daysLeft ? tr("{0} в день", formatMoney(Math.round(f.everyday / f.daysLeft / 100) * 100, { currency: base })) : undefined, value: f.everyday, sign: "minus" }
  ];

  return (
    <Sheet tall title={tr("Прогноз месяца")} ariaLabel={tr("Прогноз на конец месяца")}>
      <div className="px-5">
        <div className="text-subhead text-ink-2">{tr("К {0} у вас будет", `${parseDay(to).getDate()} ${formatMonthShort(today)}`)}</div>
        <AnimatedMoney value={f.end} currency={base} variant="hero" privacy className="mt-0.5 block text-[42px] leading-[1.05]" />
        <div className={cn("mt-1 text-footnote font-medium tnum", delta >= 0 ? "text-positive" : "text-negative")}>
          {delta >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(delta), { currency: base })} <span className="font-normal text-ink-3">{tr("к сегодняшнему")}</span>
        </div>
      </div>

      <div className="panel mx-4 mt-4 rounded-[22px] px-3 pb-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-[150px] w-full overflow-visible" aria-label={tr("Капитал до конца месяца")} role="img" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="fc-glow" x="-10%" y="-60%" width="120%" height="220%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <path d={`${line(actual)} L${x(today)} ${H} L0 ${H} Z`} fill="url(#fc-area)" />
          <path d={line(f.path)} fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <path d={line(actual)} fill="none" stroke="var(--accent)" strokeWidth="5" opacity="0.6" filter="url(#fc-glow)" />
          <path d={line(actual)} fill="none" stroke="var(--accent-hi, var(--accent))" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={x(today)} cy={y(f.now)} r="4.5" fill="var(--ink)" />
          <circle cx={x(to)} cy={y(f.end)} r="5" fill={delta >= 0 ? "var(--positive)" : "var(--negative)"} />
        </svg>
        <div className="mt-1 flex justify-between px-1 text-caption text-ink-3">
          <span>{tr("1-е")}</span>
          <span>{tr("сегодня {0}", parseDay(dayOf(today)).getDate())}</span>
          <span>{parseDay(to).getDate()}</span>
        </div>
      </div>

      <div className="panel mx-4 mt-3 overflow-hidden rounded-[22px] [&>*+*]:hairline-t">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 px-4 py-3">
            <span className="min-w-0 flex-1 text-callout">
              {r.sign === "plus" ? "+ " : r.sign === "minus" ? "− " : ""}
              {r.label}
              {r.hint && <span className="ml-1.5 text-caption text-ink-3">{r.hint}</span>}
            </span>
            <Money value={r.sign === "minus" ? -r.value : r.value} currency={base} sign={r.sign === "none" ? "never" : "always"} privacy tone={r.sign === "plus" ? "positive" : "default"} className="text-callout font-semibold" />
          </div>
        ))}
        <div className="flex items-center gap-2 px-4 py-3.5">
          <span className="flex-1 text-headline font-semibold">{tr("Итого к концу месяца")}</span>
          <Money value={f.end} currency={base} privacy variant="hero" className="text-[19px]" />
        </div>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
        <div className="panel rounded-[18px] px-3.5 py-3">
          <div className="text-caption text-ink-2">{tr("Месяц закроется")}</div>
          <Money value={delta} currency={base} sign="always" privacy tone={delta >= 0 ? "positive" : "negative"} className="mt-0.5 block text-title-3 font-semibold" />
        </div>
        <div className="panel rounded-[18px] px-3.5 py-3">
          <div className="text-caption text-ink-2">{tr("Самый низкий остаток")}</div>
          <Money value={low.value} currency={base} privacy tone={tight ? "negative" : "default"} className="mt-0.5 block text-title-3 font-semibold" />
          <div className="text-caption text-ink-3">{tight ? tr("денег не хватит {0}", formatDate(low.day)) : tr("{0} · хватает", formatDate(low.day))}</div>
        </div>
      </div>
      <p className="px-6 pb-2 pt-3 text-center text-caption text-ink-3">{tr("Платежи — на свои даты, обычные траты — ровно по дням, как обычно за последние 60 дней.")}</p>
    </Sheet>
  );
}
