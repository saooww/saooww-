import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChartColumn, ChevronLeft, ChevronRight, Sparkles } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { bucketSeries, bucketsFor, capitalSeries, categoryRows, donutSlices, habits, monthForecast, monthlyTotals, type SeriesKind } from "../../lib/analytics";
import { addDays, capitalize, formatDate, pluralN, WEEKDAYS_ACC, WEEKDAYS_SHORT } from "../../lib/dates";
import { pctChange, periodRange, periodStats, type Period } from "../../lib/finance";
import { analyticsTips } from "../../lib/insights";
import { formatCompact, formatMoney, formatPercent } from "../../lib/money";
import { useAppData, useBalances, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { nav, useUI } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { BarChart } from "../../charts/BarChart";
import { Donut } from "../../charts/Donut";
import { LineChart } from "../../charts/LineChart";
import { NamedIcon } from "../../ui/icons";
import { AnimatedMoney, Money } from "../../ui/Money";
import { ease } from "../../ui/motion";
import { EmptyState, IconButton, ProgressBar, Segmented } from "../../ui/primitives";
import { MoneySwitch } from "../../nav/MoneySwitch";
import { SpendingCalendar } from "./SpendingCalendar";
import { StoryRow } from "./StoryRow";
import { tr } from "../../i18n/i18n";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "week", label: tr("Неделя") },
  { value: "month", label: tr("Месяц") },
  { value: "quarter", label: tr("Квартал") },
  { value: "year", label: tr("Год") }
];

const PREV_GEN: Record<Period, string> = { week: tr("прошлой недели"), month: tr("прошлого месяца"), quarter: tr("прошлого квартала"), year: tr("прошлого года") };
const PREV_LABEL: Record<Period, string> = { week: tr("прошлой неделе"), month: tr("прошлом месяце"), quarter: tr("прошлом квартале"), year: tr("прошлом году") };

const VIEWS: Array<{ value: "overview" | "categories" | "trends"; label: string }> = [
  { value: "overview", label: tr("Обзор") },
  { value: "categories", label: tr("Категории") },
  { value: "trends", label: tr("Тренды") }
];

export function AnalyticsScreen() {
  const data = useAppData();
  const { entries, skipped } = useLedger();
  const balances = useBalances();
  const today = useToday();
  const cats = useCategoryMap();
  const base = data.settings.baseCurrency;

  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const [metric, setMetric] = useState<SeriesKind>("expense");
  const [bar, setBar] = useState<number | null>(null);
  const [slice, setSlice] = useState<string | null>(null);
  const [capScrub, setCapScrub] = useState<number | null>(null);
  const [capMode, setCapMode] = useState<"capital" | "savings">("capital");
  const [view, setView] = useState<"overview" | "categories" | "trends">("overview");

  const range = useMemo(() => periodRange(period, offset, today), [period, offset, today]);
  const prevRange = useMemo(() => periodRange(period, offset - 1, today), [period, offset, today]);
  const stats = useMemo(() => periodStats(entries, range, today), [entries, range, today]);
  // An unfinished period is compared with the same number of days of the previous one.
  const prev = useMemo(() => {
    const cur = periodStats(entries, range, today);
    const partial = offset === 0 && cur.elapsedDays > 0 && cur.elapsedDays < range.days;
    const cmp = partial ? { ...prevRange, to: addDays(prevRange.from, cur.elapsedDays - 1) } : prevRange;
    return periodStats(entries, cmp, today);
  }, [entries, range, prevRange, today, offset]);
  const partialCompare = offset === 0 && stats.elapsedDays < range.days;
  const buckets = useMemo(() => bucketsFor(range), [range]);
  const series = useMemo(() => bucketSeries(entries, buckets, metric), [entries, buckets, metric]);
  const rows = useMemo(() => categoryRows(stats.expenseByCategory, prev.expenseByCategory, cats), [stats, prev, cats]);
  const slices = useMemo(() => donutSlices(rows), [rows]);
  const capital = useMemo(() => {
    const to = range.to < today ? range.to : today;
    return range.from > today ? [] : capitalSeries(data, balances, range.from, to, capMode);
  }, [data, balances, range, today, capMode]);
  const hab = useMemo(() => habits(entries, range.from, range.to < today ? range.to : today), [entries, range, today]);
  const forecast = useMemo(() => (period === "month" && offset === 0 ? monthForecast(data, entries, today) : null), [data, entries, today, period, offset]);
  const tips = useMemo(() => analyticsTips(data, entries, balances, today), [data, entries, balances, today]);
  const months = useMemo(() => monthlyTotals(entries, today, 6), [entries, today]);

  const animKey = `${period}-${offset}-${metric}`;
  const changePeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
    setBar(null);
    setSlice(null);
  };
  const shift = (d: number) => {
    setOffset((o) => Math.min(0, o + d));
    setBar(null);
    setSlice(null);
  };

  const elapsed = Math.max(1, stats.elapsedDays);
  const avgDaily = Math.round(stats.expense / elapsed / 100) * 100;
  const expChange = pctChange(stats.expense, prev.expense);
  const incChange = pctChange(stats.income, prev.income);
  const hasData = entries.length > 0;

  const barValues = series.map((v) => (metric === "net" ? v : Math.max(0, v)));
  const selectedBucket = bar !== null ? buckets[bar] : null;
  const headline = selectedBucket ? series[bar!] : metric === "expense" ? stats.expense : metric === "income" ? stats.income : stats.net;
  const avgLine = metric === "expense" && (period === "week" || period === "month") ? avgDaily : undefined;

  const selectedSlice = slice ? slices.find((s) => s.id === slice) : null;
  const capShown = capScrub !== null ? capital[capScrub] : null;
  const capDelta = capital.length ? capital[capital.length - 1].value - capital[0].value : 0;

  return (
    <Screen title={tr("Деньги")} large subheader={<MoneySwitch current="analytics" />}>
      <StoryRow />
      <div className="px-4">
        <Segmented options={PERIODS} value={period} onChange={changePeriod} />
      </div>

      <div className="mt-3 flex items-center justify-between px-3">
        <IconButton icon={ChevronLeft} label={tr("Предыдущий период")} variant="plain" onClick={() => shift(-1)} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={range.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="text-headline font-semibold">
            {range.label}
          </motion.div>
        </AnimatePresence>
        <IconButton icon={ChevronRight} label={tr("Следующий период")} variant="plain" disabled={offset >= 0} className="disabled:opacity-25" onClick={() => shift(1)} />
      </div>

      {!hasData ? (
        <EmptyState icon={ChartColumn} title={tr("Пока нечего анализировать")} text={tr("Добавьте несколько доходов и расходов — графики построятся автоматически.")} />
      ) : (
        <>
          {/* Summary */}
          <div className="mt-3 grid grid-cols-2 gap-2 px-4 min-[390px]:grid-cols-3">
            <SummaryTile label={tr("Доходы")} value={stats.income} change={incChange} goodWhenUp currency={base} tone="positive" />
            <SummaryTile label={tr("Расходы")} value={stats.expense} change={expChange} currency={base} />
            <SummaryTile label={tr("Итог")} value={stats.net} currency={base} signed className="col-span-2 min-[390px]:col-span-1" />
          </div>
          {partialCompare && (prev.income > 0 || prev.expense > 0) && <div className="mt-2 px-5 text-caption text-ink-3">{tr("Проценты — к тем же дням")}{" "}{PREV_GEN[period]}</div>}
          {period === "month" && hab.expenseCount >= 5 && (
            <div className="mt-3 px-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => nav.story(range.from)}
                className="panel relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] px-4 py-3 text-left"
              >
                <Sparkles size={18} className="text-accent-ink" />
                <span className="flex-1 text-callout font-semibold text-ink">{tr("Итоги:")}{" "}{range.label.toLowerCase()}</span>
                <ChevronRight size={16} className="text-ink-3" />
              </motion.button>
            </div>
          )}
          {skipped > 0 && (
            <button type="button" onClick={() => nav.push("currencies")} className="mt-2 px-5 text-left text-footnote text-warning">
              {pluralN(skipped, ["операция не учтена", "операции не учтены", "операций не учтено"])}{" "}{tr("— нет курса валюты →")}</button>
          )}

          {/* Three short views instead of one endless scroll */}
          <div className="mt-6 px-4">
            <Segmented options={VIEWS} value={view} onChange={setView} size="sm" />
          </div>

          {view === "overview" && (
            <>
          {/* Flow chart */}
          <section className="mt-4 px-4">
            <div className="panel rounded-xl p-4">
              {/* The switch sits beside the amount; on small phones and large text it gets its own line */}
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 grow-[999] basis-[156px]">
                  <div className="text-footnote font-medium text-ink-2">{selectedBucket ? capitalize(selectedBucket.tip) : metric === "expense" ? tr("Расходы за период") : metric === "income" ? tr("Доходы за период") : tr("Итог: доходы минус расходы")}</div>
                  <AnimatedMoney value={headline} currency={base} sign={metric === "net" ? "always" : "auto"} tone={metric === "income" || (metric === "net" && headline > 0) ? "positive" : "default"} variant="hero" className="mt-0.5 block text-[28px] font-semibold tracking-[-0.03em]" duration={0.45} />
                  {avgLine ? (
                    <div className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-3">
                      <span className="inline-block w-3.5 border-t border-dashed border-ink-2" />
                      <span className="whitespace-nowrap">
                        {tr("в среднем")} {formatMoney(avgLine, { currency: base })} {tr("в день")}
                      </span>
                    </div>
                  ) : null}
                </div>
                <Segmented
                  size="sm"
                  className="min-w-0 grow basis-[calc(150px*var(--text-scale))]"
                  value={metric}
                  onChange={(m) => {
                    setMetric(m);
                    setBar(null);
                  }}
                  options={[
                    { value: "expense", label: tr("Расх.") },
                    { value: "income", label: tr("Дох.") },
                    { value: "net", label: tr("Итог") }
                  ]}
                />
              </div>
              <div className="mt-4">
                <BarChart
                  data={buckets.map((b, i) => ({ label: b.label, value: Math.abs(barValues[i]) }))}
                  selected={bar}
                  onSelect={setBar}
                  emphasis={(() => {
                    const k = buckets.findIndex((b) => b.from <= today && today <= b.to);
                    return k >= 0 ? k : undefined;
                  })()}
                  color={metric === "income" ? "var(--positive)" : metric === "net" ? "var(--ink-2)" : "var(--ink)"}
                  average={avgLine}
                  formatAxis={(v) => formatCompact(v)}
                  animKey={animKey}
                  ariaLabel={tr("Динамика за период")}
                />
              </div>
              {metric === "net" && <div className="mt-2 text-caption text-ink-3">{tr("Высота столбца — модуль разницы доходов и расходов за интервал")}</div>}
            </div>
          </section>

          {/* Forecast */}
          {forecast && (
            <section className="mt-4 px-4">
              <div className="panel rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-headline font-semibold">{tr("Прогноз до конца месяца")}</div>
                  <div className="shrink-0 text-footnote text-ink-3">{pluralN(forecast.daysLeft, ["день", "дня", "дней"])}</div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <Money value={forecast.projected} currency={base} variant="hero" className="text-title-2 font-semibold" />
                  {forecast.lastMonth > 0 && (
                    <span className={cn("text-footnote font-medium", forecast.projected > forecast.lastMonth ? "text-warning" : "text-positive")}>
                      {forecast.projected > forecast.lastMonth ? tr("больше") : tr("меньше")}{tr(", чем в прошлом месяце")}</span>
                  )}
                </div>
                <div className="mt-3">
                  <ProgressBar tone="ink" value={forecast.projected ? forecast.spent / forecast.projected : 0} marker={forecast.lastMonth && forecast.projected ? Math.min(0.999, forecast.lastMonth / Math.max(forecast.projected, forecast.lastMonth)) : undefined} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-caption">
                  <Fact label={tr("Уже потрачено")} value={forecast.spent} currency={base} />
                  <Fact label={tr("Обычные траты")} value={forecast.dailyRate} currency={base} suffix={tr("в день")} />
                  <Fact label={tr("Запланировано")} value={forecast.scheduled} currency={base} />
                </div>
                <p className="mt-3 text-caption text-ink-3">{tr("Учитывает ваш обычный темп трат за 60 дней, регулярные платежи и планы на остаток месяца.")}</p>
              </div>
            </section>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <section className="mt-4 px-4">
              <div className="panel rounded-xl p-4">
                <div className="text-headline font-semibold">{tr("Наблюдения")}</div>
                <div className="mt-2 flex flex-col">
                  {tips.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!t.action}
                      onClick={() => {
                        if (!t.action) return;
                        if (t.action.route) nav.push(t.action.route, t.action.params);
                        else useUI.getState().setTab(t.action.tab);
                      }}
                      className="flex items-start gap-3 py-2.5 text-left [&+&]:hairline-t"
                    >
                      <NamedIcon name={t.icon} size={18} strokeWidth={2} className={cn("mt-0.5 shrink-0", { neutral: "text-ink-2", positive: "text-positive", warning: "text-warning", negative: "text-negative" }[t.tone])} />
                      <span className="text-subhead text-ink">{t.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
          <div className="mt-3 px-5 text-caption text-ink-3">{tr("Переводы между своими кошельками, долги и цели не считаются доходами и расходами.")}</div>
            </>
          )}

          {view === "categories" && (
            <>
          {/* Categories */}
          <section className="mt-4 px-4">
            <div className="panel rounded-xl p-4">
              <div className="text-headline font-semibold">{tr("Расходы по категориям")}</div>
              {rows.length === 0 ? (
                <div className="py-8 text-center text-callout text-ink-2">{tr("В этом периоде расходов нет")}</div>
              ) : (
                <>
                  <div className="mt-4 flex justify-center">
                    <Donut slices={slices.map((s) => ({ id: s.id, value: s.amount, color: s.color }))} selected={slice} onSelect={setSlice} animKey={animKey}>
                      <div className="max-w-[120px]">
                        <div className="truncate text-caption font-medium text-ink-2">{selectedSlice ? selectedSlice.name : tr("Всего")}</div>
                        <Money value={selectedSlice ? selectedSlice.amount : stats.expense} currency={base} className="block text-headline font-semibold" />
                        {selectedSlice && <div className="text-caption text-ink-3 tnum">{formatPercent(selectedSlice.share)}</div>}
                      </div>
                    </Donut>
                  </div>
                  <div className="mt-4 flex flex-col">
                    {rows.slice(0, 8).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSlice(slice === r.id ? null : slices.some((s) => s.id === r.id) ? r.id : "__rest")}
                        className={cn("flex items-center gap-3 rounded-sm py-2 text-left transition-opacity", slice && slice !== r.id && !(slice === "__rest" && !slices.some((s) => s.id === r.id)) && "opacity-45")}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slices.some((s) => s.id === r.id) ? r.color : "var(--chart-muted)" }} />
                        <NamedIcon name={r.icon} size={17} strokeWidth={1.9} className="shrink-0 text-ink-2" />
                        <span className="min-w-0 flex-1 truncate text-callout">{r.name}</span>
                        {r.delta !== null && Math.abs(r.delta) >= 0.05 && (
                          <span className={cn("text-caption font-medium tnum", r.delta > 0 ? "text-warning" : "text-positive")}>
                            {r.delta > 0 ? "↑" : "↓"} {formatPercent(Math.abs(r.delta))}
                          </span>
                        )}
                        <Money value={r.amount} currency={base} className="text-callout font-medium" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-caption text-ink-3">{tr("Стрелки — изменение к")}{" "}{PREV_LABEL[period]}{partialCompare ? tr(" за те же дни") : ""}</div>
                </>
              )}
            </div>
          </section>

          {/* Calendar */}
          {period === "month" && (
            <section className="mt-4 px-4">
              <div className="panel rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-headline font-semibold">{tr("Календарь трат")}</div>
                  {hab.noSpendDays > 0 && <div className="text-footnote text-ink-2">{pluralN(hab.noSpendDays, ["день", "дня", "дней"])}{" "}{tr("без трат")}</div>}
                </div>
                <SpendingCalendar key={range.from} entries={entries} from={range.from} to={range.to} today={today} categories={cats} currency={base} />
              </div>
            </section>
          )}

            </>
          )}

          {view === "trends" && (
            <>
          {/* Capital */}
          {capital.length > 1 && (
            <section className="mt-4 px-4">
              <div className="panel rounded-xl p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 grow-[999] basis-[110px] text-footnote font-medium text-ink-2">{capShown ? formatDate(capShown.day, { year: "auto" }) : capMode === "capital" ? tr("Изменение капитала") : tr("Динамика накоплений")}</div>
                  <Segmented
                    size="sm"
                    className="min-w-0 grow basis-[calc(184px*var(--text-scale))]"
                    value={capMode}
                    onChange={(m) => {
                      setCapMode(m);
                      setCapScrub(null);
                    }}
                    options={[
                      { value: "capital", label: tr("Капитал") },
                      { value: "savings", label: tr("Накопления") }
                    ]}
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <Money value={capShown ? capShown.value : capital[capital.length - 1].value} currency={base} privacy variant="hero" className="text-title-2 font-semibold" />
                  {!capShown && (
                    <span className={cn("text-footnote font-medium tnum", capDelta >= 0 ? "text-positive" : "text-negative")}>
                      {capDelta >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(capDelta))}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <LineChart points={capital.map((p) => ({ value: p.value }))} height={130} onScrub={setCapScrub} formatValue={(v) => formatCompact(v)} animKey={`${animKey}-${capMode}`} color={capMode === "capital" ? "var(--ink)" : "var(--positive)"} ariaLabel={capMode === "capital" ? tr("Капитал") : tr("Накопления")} />
                </div>
                <div className="mt-1 text-caption text-ink-3">{capMode === "capital" ? tr("Счета, цели и долги в {0}", base) : tr("Накопительные и инвестиционные счета, деньги в целях — в {0}", base)}</div>
              </div>
            </section>
          )}

          {/* Six months */}
          <section className="mt-4 px-4">
            <div className="panel rounded-xl p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-headline font-semibold">{tr("Полгода")}</div>
                <div className="flex items-center gap-3 text-caption text-ink-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive" />{" "}{tr("Доходы")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink" />{" "}{tr("Расходы")}</span>
                </div>
              </div>
              <SixMonths months={months} base={base} />
            </div>
          </section>

          {/* Habits */}
          {hab.expenseCount > 0 && (
            <section className="mt-4 px-4">
              <div className="panel rounded-xl p-4">
                <div className="text-headline font-semibold">{tr("Привычки")}</div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Fact label={tr("В среднем в день")} value={avgDaily} currency={base} />
                  <Fact label={tr("Средний чек")} value={hab.avgTicket} currency={base} />
                  <div>
                    <div className="text-caption text-ink-2">{tr("Дней без трат")}</div>
                    <div className="text-callout font-semibold tnum">{hab.noSpendDays}</div>
                  </div>
                  <div>
                    <div className="text-caption text-ink-2">{tr("Покупок")}</div>
                    <div className="text-callout font-semibold tnum">{hab.expenseCount}</div>
                  </div>
                </div>
                <WeekdayProfile values={hab.weekday} peak={hab.peakWeekday} />
                <div className="mt-3 flex flex-col gap-1.5 text-subhead text-ink-2">
                  {hab.peakWeekday !== null && <p>{tr("Больше всего тратите по")}{" "}{WEEKDAYS_ACC[hab.peakWeekday]}.</p>}
                  {hab.topNote && (
                    <p>{tr("Чаще всего — «")}{hab.topNote.label}»: {pluralN(hab.topNote.count, ["раз", "раза", "раз"])}{tr(", всего")}{" "}{formatMoney(hab.topNote.total)}.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

            </>
          )}
        </>
      )}
    </Screen>
  );
}

function SummaryTile({ label, value, change, currency, goodWhenUp, signed, tone, className }: { label: string; value: number; change?: number | null; currency: string; goodWhenUp?: boolean; signed?: boolean; tone?: "positive"; className?: string }) {
  const good = change == null ? null : goodWhenUp ? change >= 0 : change <= 0;
  return (
    <div className={cn("panel rounded-md px-3 py-3", className)}>
      <div className="text-caption font-medium text-ink-2">{label}</div>
      <div className={cn("mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em] tnum", tone === "positive" && value > 0 && "text-positive", signed && value < 0 && "text-negative")}>
        {signed && value > 0 ? "+" : ""}
        {formatCompact(value, currency)}
      </div>
      {change != null && (
        <div className={cn("mt-0.5 text-caption font-medium tnum", good ? "text-positive" : "text-warning")}>
          {change >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(change))}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value, currency, suffix }: { label: string; value: number; currency: string; suffix?: string }) {
  return (
    <div>
      <div className="text-caption text-ink-2">{label}</div>
      <div className="text-callout font-semibold">
        <Money value={value} currency={currency} />
        {suffix && <span className="ml-1 text-caption font-normal text-ink-3">{suffix}</span>}
      </div>
    </div>
  );
}

function WeekdayProfile({ values, peak }: { values: number[]; peak: number | null }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mt-4 flex h-[84px] items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-[60px] w-full items-end justify-center">
            <motion.div
              className="w-full max-w-[26px] rounded-[4px]"
              style={{ background: i === peak ? "var(--accent)" : "var(--chart-muted)" }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(3, (v / max) * 60) }}
              transition={{ type: "spring", stiffness: 160, damping: 22, delay: i * 0.03 }}
            />
          </div>
          <span className={cn("text-[10.5px] font-medium", i === peak ? "text-ink" : "text-ink-3")}>{WEEKDAYS_SHORT[i]}</span>
        </div>
      ))}
    </div>
  );
}

function SixMonths({ months, base }: { months: Array<{ label: string; income: number; expense: number }>; base: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const m = sel !== null ? months[sel] : null;
  return (
    <>
      <div className="mt-2 h-10">
        <AnimatePresence mode="wait" initial={false}>
          {m ? (
            <motion.div key={sel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12, ease: ease.out }} className="flex gap-4 text-subhead tnum">
              <span className="text-ink-2">{capitalize(m.label)}</span>
              <span className="text-positive">+{formatCompact(m.income, base)}</span>
              <span>−{formatCompact(m.expense, base)}</span>
              <span className={m.income - m.expense >= 0 ? "text-positive" : "text-negative"}>= {formatCompact(m.income - m.expense, base)}</span>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-subhead text-ink-3">{tr("Коснитесь месяца, чтобы увидеть детали")}</motion.div>
          )}
        </AnimatePresence>
      </div>
      <BarChart data={months.map((x) => ({ label: x.label, value: x.expense, value2: x.income }))} selected={sel} onSelect={setSel} height={150} formatAxis={(v) => formatCompact(v)} ariaLabel={tr("Доходы и расходы по месяцам")} />
    </>
  );
}

