import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, TriangleAlert } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { capitalForecast } from "../../lib/analytics";
import { addDays, diffDays, endOfMonth, formatDate, parseDay, pluralN, startOfMonth } from "../../lib/dates";
import { balanceSeries, totalWallets } from "../../lib/finance";
import { formatMoney } from "../../lib/money";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Chip } from "../../ui/primitives";
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
      {f.shortfall && (
        <span className="mt-1.5 flex items-center gap-1.5 text-caption font-semibold text-[#ffe2a8]">
          <TriangleAlert size={13} />
          {tr("Через {0} может не хватить денег", pluralN(f.shortfall.inDays, ["день", "дня", "дней"]))}
        </span>
      )}
    </motion.button>
  );
}

function formatMonthShort(day: string): string {
  return formatDate(endOfMonth(day), { long: true }).replace(/^\d+\s*/, "");
}

type Horizon = "month" | 7 | 30 | 90 | 365;

const HORIZONS: Array<{ id: Horizon; label: string }> = [
  { id: "month", label: tr("Месяц") },
  { id: 7, label: tr("7 дней") },
  { id: 30, label: tr("30 дней") },
  { id: 90, label: tr("90 дней") },
  { id: 365, label: tr("Год") }
];

const W = 320;
const H = 150;

/** The forecast in full: pick how far ahead, touch a day to see what the balance will be and what moves it. */
export function ForecastSheet() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [pick, setPick] = useState<number | null>(null);
  const until = horizon === "month" ? endOfMonth(today) : addDays(today, horizon);
  const f = useMemo(() => capitalForecast(data, balances, entries, today, until), [data, balances, entries, today, until]);
  const delta = f.end - f.now;

  // the way back is shown too, so «now» sits inside the line
  const pastDays = horizon === "month" ? diffDays(today, startOfMonth(today)) : Math.min(90, Math.max(7, Math.round(horizon / 3)));
  const from = addDays(today, -pastDays);
  const ids = useMemo(() => new Set(totalWallets(data.wallets).map((w) => w.id)), [data.wallets]);
  const actual = useMemo(() => balanceSeries(data, balances, ids, from, today), [data, balances, ids, from, today]);

  const span = Math.max(1, diffDays(until, from));
  const all = [...actual.map((p) => p.value), ...f.path.map((p) => p.value)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (day: string) => (diffDays(day, from) / span) * W;
  const y = (v: number) => 12 + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 28);
  const line = (pts: Array<{ day: string; value: number }>) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const low = f.path.reduce((m, p) => (p.value < m.value ? p : m), f.path[0]);

  const selectedDay = pick === null ? null : addDays(from, pick);
  const at = selectedDay ? (selectedDay <= today ? actual.find((p) => p.day === selectedDay) : f.path.find((p) => p.day === selectedDay)) : null;
  const dayItems = selectedDay && selectedDay > today ? f.items.filter((i) => i.date === selectedDay || (selectedDay === addDays(today, 1) && i.date === today)) : [];
  const pickAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const k = Math.round(((clientX - r.left) / r.width) * span);
    setPick(Math.max(0, Math.min(span, k)));
  };

  const rows: Array<{ label: string; hint?: string; value: number; sign: "plus" | "minus" | "none" }> = [
    { label: tr("Сейчас на счетах"), value: f.now, sign: "none" },
    { label: tr("Ожидаемые доходы"), hint: tr("осталось получить"), value: f.incomeLeft, sign: "plus" },
    { label: tr("Платежи и подписки"), value: f.obligations, sign: "minus" },
    { label: tr("Обычные траты"), hint: tr("{0} в день", formatMoney(Math.round(f.dailyRate / 100) * 100, { currency: base })), value: f.everyday, sign: "minus" }
  ];

  return (
    <Sheet tall title={tr("Прогноз")} ariaLabel={tr("Прогноз на конец месяца")}>
      <div className="scroll-x flex gap-2 px-4 pb-3">
        {HORIZONS.map((h) => (
          <Chip
            key={String(h.id)}
            selected={horizon === h.id}
            onClick={() => {
              haptic();
              setHorizon(h.id);
              setPick(null);
            }}
          >
            {h.label}
          </Chip>
        ))}
      </div>

      <div className="px-5">
        <div className="text-subhead text-ink-2">{tr("К {0} у вас будет", formatDate(until, { long: true, year: "auto" }))}</div>
        <AnimatedMoney value={f.end} currency={base} variant="hero" privacy className="mt-0.5 block text-[42px] leading-[1.05]" />
        <div className={cn("mt-1 text-footnote font-medium tnum", delta >= 0 ? "text-positive" : "text-negative")}>
          {delta >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(delta), { currency: base })} <span className="font-normal text-ink-3">{tr("к сегодняшнему")}</span>
        </div>
      </div>

      {f.shortfall && (
        <button
          type="button"
          onClick={() => setPick(diffDays(f.shortfall!.day, from))}
          className="mx-4 mt-3 flex w-[calc(100%-32px)] items-start gap-3 rounded-[18px] px-3.5 py-3 text-left"
          style={{ background: "var(--warning-soft)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--warning) 40%, transparent)" }}
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
          <span className="text-subhead">
            <span className="font-semibold text-warning">{tr("Через {0} может не хватить денег", pluralN(f.shortfall.inDays, ["день", "дня", "дней"]))}</span>
            <span className="mt-0.5 block text-footnote text-ink-2">{tr("{0}: на обычных счетах {1}", formatDate(f.shortfall.day), formatMoney(f.shortfall.value, { currency: base }))}</span>
          </span>
        </button>
      )}

      <div className="panel mx-4 mt-3 rounded-[22px] px-3 pb-2 pt-3">
        <div
          className="relative touch-pan-y select-none"
          onPointerDown={(e) => pickAt(e.clientX, e.currentTarget)}
          onPointerMove={(e) => (e.buttons || e.pointerType === "touch") && pickAt(e.clientX, e.currentTarget)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-[150px] w-full overflow-visible" aria-label={tr("Капитал до конца периода")} role="img" preserveAspectRatio="none">
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
            <circle cx={x(until)} cy={y(f.end)} r="5" fill={delta >= 0 ? "var(--positive)" : "var(--negative)"} />
            {f.shortfall && <circle cx={x(f.shortfall.day)} cy={y(f.path[f.shortfall.inDays]?.value ?? f.end)} r="4.5" fill="var(--warning)" />}
            {selectedDay && at && (
              <>
                <line x1={x(selectedDay)} x2={x(selectedDay)} y1="0" y2={H} stroke="var(--ink)" strokeOpacity="0.35" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <circle cx={x(selectedDay)} cy={y(at.value)} r="5" fill="var(--ink)" />
              </>
            )}
          </svg>
        </div>
        <div className="mt-1 flex justify-between px-1 text-caption text-ink-3">
          <span>{formatDate(from)}</span>
          <span>{tr("сегодня")}</span>
          <span>{formatDate(until)}</span>
        </div>
      </div>

      {selectedDay && at ? (
        <div className="panel mx-4 mt-3 rounded-[22px] px-4 py-3.5" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-callout font-semibold">{formatDate(selectedDay, { long: true, year: "auto" })}</span>
            <Money value={at.value} currency={base} privacy variant="hero" className="text-[20px]" />
          </div>
          <div className="mt-1 text-caption text-ink-2">{selectedDay <= today ? tr("так было на этот день") : tr("ожидаемый баланс на конец дня")}</div>
          {selectedDay > today && (
            <div className="mt-2 border-t border-[var(--line)] pt-1">
              {dayItems.map((i, k) => (
                <div key={`${i.title}-${k}`} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-subhead">{i.title}</span>
                  <Money value={i.kind === "income" ? i.amount : -i.amount} currency={base} sign="always" tone={i.kind === "income" ? "positive" : "default"} className="text-subhead font-semibold" />
                </div>
              ))}
              <div className="flex items-center gap-2 py-1.5 text-ink-2">
                <span className="min-w-0 flex-1 truncate text-subhead">{tr("Обычные траты")}</span>
                <Money value={-f.dailyRate} currency={base} sign="always" className="text-subhead" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="px-6 pt-2 text-center text-caption text-ink-3">{tr("Коснитесь графика, чтобы увидеть баланс на любой день")}</p>
      )}

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
          <span className="flex-1 text-headline font-semibold">{horizon === "month" ? tr("Итого к концу месяца") : tr("Итого к концу периода")}</span>
          <Money value={f.end} currency={base} privacy variant="hero" className="text-[19px]" />
        </div>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
        <div className="panel rounded-[18px] px-3.5 py-3">
          <div className="text-caption text-ink-2">{tr("Период закроется")}</div>
          <Money value={delta} currency={base} sign="always" privacy tone={delta >= 0 ? "positive" : "negative"} className="mt-0.5 block text-title-3 font-semibold" />
        </div>
        <div className="panel rounded-[18px] px-3.5 py-3">
          <div className="text-caption text-ink-2">{tr("Самый низкий остаток")}</div>
          <Money value={low.value} currency={base} privacy tone={low.value < 0 ? "negative" : "default"} className="mt-0.5 block text-title-3 font-semibold" />
          <div className="text-caption text-ink-3">{low.value < 0 ? tr("денег не хватит {0}", formatDate(low.day)) : tr("{0} · хватает", formatDate(low.day))}</div>
        </div>
      </div>
      <p className="px-6 pb-2 pt-3 text-center text-caption text-ink-3">{tr("Платежи — на свои даты, обычные траты — ровно по дням, как обычно за последние 60 дней.")}</p>
    </Sheet>
  );
}
