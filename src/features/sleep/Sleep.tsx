import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Moon, Sunrise, Trash2 } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { MONTHS_NOM, pluralN, WEEKDAYS_SHORT, addDays, addMonths, capitalize, endOfMonth, formatDate, parseDay, startOfMonth, startOfWeek, weekdayIndex, type DayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { DEFAULT_SLEEP_GOAL, entriesBetween, fromMin, hm, lastDays, sleepInsights, sleepMinutes, sleepScore, sleepStats, sleepStreak, toMin } from "../../lib/sleep";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { SleepEntry } from "../../store/types";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { spring } from "../../ui/motion";
import { Button, EmptyState, IconButton, Segmented } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

type Range = "week" | "month" | "quarter";
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, quarter: 90 };

const dur = (min: number) => {
  const { h, m } = hm(min);
  if (!h) return tr("{0} мин", m);
  return m ? tr("{0} ч {1} мин", h, m) : tr("{0} ч", h);
};
const QUALITY = [tr("Плохо"), tr("Так себе"), tr("Нормально"), tr("Хорошо"), tr("Отлично")];
const dayName = (d: DayKey) => WEEKDAYS_SHORT[weekdayIndex(d)];

function useGoal() {
  return useData((s) => s.settings.sleepGoal ?? DEFAULT_SLEEP_GOAL);
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const R = size / 2 - 6;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={tr("Оценка сна: {0} из 100", score)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
        <motion.circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--sleep)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - score / 100) }} transition={spring.smooth} style={{ filter: "drop-shadow(0 0 6px var(--sleep))" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[20px] font-bold tabular-nums">{score}</span>
    </div>
  );
}

/** Dots 1–5: how rested, mood or energy. */
function Dots({ value, color = "var(--sleep)" }: { value: number; color?: string }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-1.5 w-3.5 rounded-full" style={{ background: i <= Math.round(value) ? color : "var(--line-strong)" }} />
      ))}
    </span>
  );
}

/**
 * The night as a capsule from going to bed to waking, one per day on a shared time axis
 * (20:00 at the top, noon at the bottom): steady sleep looks like a straight row.
 */
function WindowChart({ days, onPick }: { days: Array<{ day: DayKey; entry: SleepEntry | null }>; onPick: (d: DayKey) => void }) {
  const W = 340;
  const H = 188;
  const top = 1200; // 20:00
  const bottom = 2160; // 12:00 next day
  const padL = 30;
  const n = days.length;
  const slot = (W - padL) / n;
  const w = Math.max(5, Math.min(22, slot * 0.62));
  const y = (m: number) => ((Math.max(top, Math.min(bottom, m)) - top) / (bottom - top)) * H;
  const ticks = [1320, 1440, 1560, 1680, 1800, 1920, 2040];
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="mx-auto w-full lg:max-h-[240px]" role="img" aria-label={tr("Когда вы спали по дням")}>
      <defs>
        <linearGradient id="slg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sleep)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--sleep) 55%, #ff4b9a)" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="0.6" strokeDasharray="2 4" />
          <text x={0} y={y(t) + 3.5} fontSize="9.5" fill="var(--ink-3)">{fromMin(t)}</text>
        </g>
      ))}
      {days.map(({ day, entry }, i) => {
        const cx = padL + slot * i + slot / 2;
        const label = n <= 7 || parseDay(day).getDay() === 1;
        const e = entry;
        let bedX = 0;
        let len = 0;
        if (e) {
          const b = toMin(e.bed);
          bedX = b >= 720 ? b : b + 1440;
          len = sleepMinutes(e.bed, e.wake);
        }
        return (
          <g key={day} onClick={() => onPick(day)} style={{ cursor: "pointer" }}>
            <rect x={cx - slot / 2} y={0} width={slot} height={H + 22} fill="transparent" />
            {e ? (
              <rect x={cx - w / 2} y={y(bedX)} width={w} height={Math.max(4, y(bedX + len) - y(bedX))} rx={w / 2} fill="url(#slg)" opacity={0.45 + e.quality * 0.11} />
            ) : (
              <circle cx={cx} cy={H / 2} r={1.6} fill="var(--line-strong)" />
            )}
            {label && (
              <text x={cx} y={H + 15} fontSize="9.5" textAnchor="middle" fill="var(--ink-3)">
                {n <= 7 ? dayName(day) : parseDay(day).getDate()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Weekly mean duration over three months. */
function WeekBars({ days, goal }: { days: Array<{ day: DayKey; entry: SleepEntry | null }>; goal: number }) {
  const weeks: Array<{ label: string; avg: number | null }> = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7).filter((d) => d.entry);
    weeks.push({ label: String(parseDay(days[i].day).getDate()), avg: chunk.length ? chunk.reduce((s, d) => s + sleepMinutes(d.entry!.bed, d.entry!.wake), 0) / chunk.length : null });
  }
  const max = Math.max(goal * 1.25, ...weeks.map((w) => w.avg ?? 0));
  return (
    <div className="relative flex h-[150px] items-end gap-1.5 pb-5" role="img" aria-label={tr("Средний сон по неделям")}>
      <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--line-strong)]" style={{ bottom: `calc(20px + ${(goal / max) * 130}px)` }} />
      {weeks.map((w, i) => (
        <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end">
          <div className="w-full rounded-t-[7px]" style={{ height: w.avg ? (w.avg / max) * 130 : 3, background: w.avg ? "linear-gradient(var(--sleep), color-mix(in srgb, var(--sleep) 50%, transparent))" : "var(--line)" }} />
          <span className="absolute -bottom-5 text-[10px] text-ink-3">{w.label}</span>
        </div>
      ))}
    </div>
  );
}

function MonthHeat({ month, onMonth, entries, goal, onPick }: { month: DayKey; onMonth: (m: DayKey) => void; entries: SleepEntry[]; goal: number; onPick: (d: DayKey) => void }) {
  const today = useToday();
  const by = useMemo(() => new Map(entries.map((e) => [e.day, e])), [entries]);
  const days = useMemo(() => {
    const out: DayKey[] = [];
    for (let d = startOfWeek(month); d <= addDays(startOfWeek(endOfMonth(month)), 6); d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);
  const m = parseDay(month);
  return (
    <section className="panel mx-4 rounded-[22px] px-3 pb-3 pt-2.5">
      <div className="flex items-center justify-between px-1">
        <button type="button" aria-label={tr("Предыдущий месяц")} onClick={() => onMonth(addMonths(month, -1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press"><ChevronLeft size={18} /></button>
        <span className="text-headline font-semibold">{capitalize(MONTHS_NOM[m.getMonth()])} {m.getFullYear()}</span>
        <button type="button" aria-label={tr("Следующий месяц")} onClick={() => onMonth(addMonths(month, 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-ink-2 active:bg-surface-press"><ChevronRight size={18} /></button>
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="pb-0.5 text-[11px] font-medium capitalize text-ink-3">{w}</span>
        ))}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const e = by.get(d);
          const score = e ? sleepScore(e, goal) : 0;
          return (
            <button key={d} type="button" disabled={d > today} aria-label={e ? tr("{0}: {1}, оценка {2}", formatDate(d), dur(sleepMinutes(e.bed, e.wake)), score) : tr("{0}: нет записи", formatDate(d))} onClick={() => onPick(d)} className={cn("grid h-10 place-items-center disabled:opacity-25", !inMonth && "opacity-25")}>
              <span
                className={cn("grid h-9 w-9 place-items-center rounded-full text-[13px] tabular-nums", e ? "font-semibold text-white" : "text-ink-3", d === today && "ring-1 ring-[var(--sleep)] ring-offset-2 ring-offset-[var(--surface)]")}
                style={e ? { background: `color-mix(in srgb, var(--sleep) ${20 + score * 0.72}%, transparent)` } : undefined}
              >
                {parseDay(d).getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export function SleepScreen() {
  const all = useData((s) => s.sleep);
  const goal = useGoal();
  const today = useToday();
  const [range, setRange] = useState<Range>("week");
  const [month, setMonth] = useState(startOfMonth(today));
  const days = useMemo(() => lastDays(all, today, RANGE_DAYS[range]), [all, today, range]);
  const inRange = useMemo(() => entriesBetween(all, days[0].day, today), [all, days, today]);
  const st = useMemo(() => sleepStats(inRange, goal), [inRange, goal]);
  const last = useMemo(() => [...all].sort((a, b) => (a.day < b.day ? 1 : -1))[0], [all]);
  const streak = sleepStreak(all, today);
  const insights = useMemo(() => sleepInsights(entriesBetween(all, addDays(today, -29), today), goal), [all, today, goal]);
  const open = (day: DayKey) => nav.sheet("sleep", { day });
  const hasToday = all.some((e) => e.day === today);

  return (
    <Screen title={tr("Сон")} large actions={<IconButton icon={Moon} label={tr("Записать ночь")} onClick={() => open(today)} />}>
      {all.length === 0 ? (
        <EmptyState icon={Moon} title={tr("Как вы спите?")} text={tr("Записывайте, когда легли и встали и как себя чувствуете: приложение покажет режим, недосып и то, как сон влияет на настроение.")} action={<Button size="md" icon={Moon} onClick={() => open(today)}>{tr("Записать первую ночь")}</Button>} />
      ) : (
        <div className="flex flex-col gap-4 pb-6">
          {/* last night */}
          <section className="panel relative mx-4 overflow-hidden rounded-[22px] p-4">
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(80% 120% at 100% 0%, color-mix(in srgb, var(--sleep) 20%, transparent), transparent 65%)" }} />
            <div className="relative flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-footnote text-ink-2">{last.day === today ? tr("Эта ночь") : tr("Последняя запись · {0}", formatDate(last.day))}</div>
                <div className="num-display mt-1 text-[34px] leading-none">{dur(sleepMinutes(last.bed, last.wake))}</div>
                <div className="num mt-1.5 text-subhead text-ink-2">{last.bed} → {last.wake}</div>
                <div className="mt-2.5 flex items-center gap-2 text-footnote text-ink-2"><Dots value={last.quality} />{QUALITY[last.quality - 1]}</div>
              </div>
              <ScoreRing score={sleepScore(last, goal)} />
            </div>
            {!hasToday && (
              <Button size="md" variant="secondary" block icon={Sunrise} className="relative mt-3.5" onClick={() => open(today)}>{tr("Записать эту ночь")}</Button>
            )}
          </section>

          <div className="px-4">
            <Segmented value={range} onChange={setRange} options={[{ value: "week", label: tr("Неделя") }, { value: "month", label: tr("Месяц") }, { value: "quarter", label: tr("3 месяца") }]} />
          </div>

          <section className="panel mx-4 rounded-[22px] px-3 pb-2 pt-3.5">
            <div className="flex items-baseline justify-between px-1 pb-2 text-footnote text-ink-2"><span>{range === "quarter" ? tr("Средний сон по неделям") : tr("Когда вы спали")}</span><span className="text-ink-3">{tr("цель {0}", dur(goal))}</span></div>
            {range === "quarter" ? <WeekBars days={days} goal={goal} /> : <WindowChart days={days} onPick={open} />}
          </section>

          {/* numbers */}
          <section className="panel mx-4 grid grid-cols-3 rounded-[22px] py-3.5">
            {[
              { label: tr("В среднем"), value: st.nights ? dur(st.avgMin) : "—" },
              { label: tr("Ложитесь"), value: st.avgBed ?? "—" },
              { label: tr("Недосып за ночь"), value: st.nights ? dur(Math.round(st.debt / st.nights)) : "—", warn: st.debt > st.nights * 45 }
            ].map((x, i) => (
              <div key={x.label} className={cn("px-3.5", i > 0 && "hairline-l")}>
                <div className="text-caption text-ink-3">{x.label}</div>
                <div className={cn("num mt-1 text-[17px] font-semibold leading-[22px]", x.warn && "text-warning")}>{x.value}</div>
              </div>
            ))}
          </section>

          {/* state */}
          {(st.avgMood || st.avgEnergy) && (
            <section className="panel mx-4 rounded-[22px] p-4">
              <div className="text-footnote text-ink-2">{tr("Самочувствие за период")}</div>
              <div className="mt-3 flex flex-col gap-3">
                {[
                  { label: tr("Настроение"), v: st.avgMood, c: "var(--plan)" },
                  { label: tr("Энергия"), v: st.avgEnergy, c: "var(--warning)" },
                  { label: tr("Выспались"), v: st.avgQuality, c: "var(--sleep)" }
                ].map((x) => x.v && (
                  <div key={x.label} className="flex items-center justify-between gap-3">
                    <span className="text-callout">{x.label}</span>
                    <span className="flex items-center gap-3"><Dots value={x.v} color={x.c} /><span className="num w-8 text-right text-subhead text-ink-2">{x.v.toFixed(1)}</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {insights.length > 0 && (
            <section className="mx-4 flex flex-col gap-2">
              {insights.map((i) => (
                <div key={i.kind} className="rounded-[18px] border border-[color-mix(in_srgb,var(--sleep)_30%,transparent)] bg-[color-mix(in_srgb,var(--sleep)_8%,transparent)] px-4 py-3 text-subhead">
                  {i.kind === "mood" && tr("После полноценного сна настроение {0} из 5, после короткого — {1}.", i.a!.toFixed(1), i.b!.toFixed(1))}
                  {i.kind === "bed" && tr("Время отхода ко сну гуляет примерно на {0} мин: ровный режим помогает высыпаться.", i.a ?? 0)}
                  {i.kind === "debt" && tr("В среднем вам не хватает {0} мин сна за ночь.", i.a ?? 0)}
                </div>
              ))}
            </section>
          )}

          <div className="flex items-baseline justify-between px-5">
            <h2 className="text-headline font-semibold">{tr("Календарь сна")}</h2>
            {streak > 1 && <span className="text-footnote text-ink-3">{tr("{0} подряд", pluralN(streak, ["ночь", "ночи", "ночей"]))}</span>}
          </div>
          <MonthHeat month={month} onMonth={setMonth} entries={all} goal={goal} onPick={open} />
        </div>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Entry sheet                                                        */
/* ------------------------------------------------------------------ */

function Scale({ label, value, onChange, hints }: { label: string; value?: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; hints?: string[] }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-callout">{label}</span>
        <span className="text-footnote text-ink-3">{value && hints ? hints[value - 1] : ""}</span>
      </div>
      <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label={label}>
        {([1, 2, 3, 4, 5] as const).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}`} onClick={() => { haptic(); onChange(i); }} className={cn("h-11 flex-1 rounded-[12px] text-[15px] font-semibold transition-colors", value && i <= value ? "bg-[color-mix(in_srgb,var(--sleep)_26%,transparent)] text-ink shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sleep)_55%,transparent)]" : "tile text-ink-3")}>
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SleepSheet({ day: dayProp }: { day?: DayKey }) {
  const { close } = useSheet();
  const today = useToday();
  const day = dayProp ?? today;
  const goal = useGoal();
  const existing = useData((s) => s.sleep.find((e) => e.day === day));
  const prev = useData((s) => [...s.sleep].sort((a, b) => (a.day < b.day ? 1 : -1))[0]);
  const [bed, setBed] = useState(existing?.bed ?? prev?.bed ?? "23:00");
  const [wake, setWake] = useState(existing?.wake ?? prev?.wake ?? "07:00");
  const [quality, setQuality] = useState<SleepEntry["quality"]>(existing?.quality ?? 3);
  const [mood, setMood] = useState<SleepEntry["mood"]>(existing?.mood);
  const [energy, setEnergy] = useState<SleepEntry["energy"]>(existing?.energy);
  const [note, setNote] = useState(existing?.note ?? "");
  const minutes = sleepMinutes(bed, wake);
  const odd = minutes < 120 || minutes > 16 * 60;
  const gap = goal - minutes;

  const save = () => {
    useData.getState().saveSleep(day, { bed, wake, quality, mood, energy, note: note.trim() || undefined });
    haptic("success");
    close();
  };

  return (
    <Sheet title={day === today ? tr("Как вы спали?") : capitalize(formatDate(day))} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong onClick={save}>{tr("Готово")}</SheetAction>}>
      <div className="flex flex-col gap-4 pt-1">
        <section className="panel relative mx-4 overflow-hidden rounded-[22px] p-4">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 130% at 50% 0%, color-mix(in srgb, var(--sleep) 18%, transparent), transparent 70%)" }} />
          <div className="relative text-center">
            <div className={cn("num-display text-[40px] leading-none", odd && "text-warning")}>{dur(minutes)}</div>
            <div className="mt-1.5 text-footnote text-ink-2">{odd ? tr("Проверьте время") : gap > 15 ? tr("Не хватило {0}", dur(gap)) : gap < -15 ? tr("Больше цели на {0}", dur(-gap)) : tr("Ровно по цели")}</div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2.5">
            {[
              { id: "bed", label: tr("Лёг"), v: bed, set: setBed, icon: Moon },
              { id: "wake", label: tr("Встал"), v: wake, set: setWake, icon: Sunrise }
            ].map((t) => (
              <label key={t.id} className="tile flex h-[68px] flex-col justify-center rounded-[16px] px-3.5">
                <span className="flex items-center gap-1.5 text-caption text-ink-3"><t.icon size={13} />{t.label}</span>
                <input type="time" value={t.v} onChange={(e) => e.target.value && t.set(e.target.value)} aria-label={t.label} className="num mt-0.5 w-full bg-transparent text-[24px] font-semibold outline-none [color-scheme:dark]" />
              </label>
            ))}
          </div>
        </section>

        <section className="panel mx-4 overflow-hidden rounded-[22px] [&>*+*]:hairline-t">
          <Scale label={tr("Выспались")} value={quality} onChange={setQuality} hints={QUALITY} />
          <Scale label={tr("Настроение")} value={mood} onChange={setMood} hints={QUALITY} />
          <Scale label={tr("Энергия")} value={energy} onChange={setEnergy} hints={QUALITY} />
        </section>

        <section className="panel mx-4 rounded-[22px] px-4 py-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Заметка: кофе вечером, шумно, поздний ужин…")} aria-label={tr("Заметка")} className="w-full bg-transparent text-body outline-none placeholder:text-ink-3" />
        </section>

        {existing && (
          <div className="px-4">
            <Button variant="secondary" size="md" block icon={Trash2} className="text-negative" onClick={() => { useData.getState().deleteSleep(day); close(); }}>{tr("Удалить запись")}</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
