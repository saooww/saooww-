import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDate, todayKey, WEEKDAYS_ACC, WEEKDAYS_SHORT } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { formatMoney, formatPercent } from "../../lib/money";
import { monthSummary, type MonthSummary } from "../../lib/story";
import { useCategoryMap, useLedger } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { NamedIcon } from "../../ui/icons";
import { useCountUp } from "../../ui/Money";
import { ease } from "../../ui/motion";

const SLIDE_MS = 6500;

export function MonthStoryLayer() {
  const month = useUI((s) => s.story);
  return <AnimatePresence>{month && <MonthStory key={month} month={month} />}</AnimatePresence>;
}

interface Slide {
  key: string;
  bg: string;
  body: ReactNode;
}

const BG = {
  sumi: "radial-gradient(90% 60% at 80% 100%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%), linear-gradient(170deg, #1b1b1f, #070708)",
  ember: "radial-gradient(100% 70% at 20% 0%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(165deg, var(--accent-hi), var(--accent-lo) 70%, #3a1004)",
  jade: "radial-gradient(90% 60% at 80% 0%, rgba(255,255,255,0.12), transparent 60%), linear-gradient(165deg, #1f6b52, #0c2a21 75%)",
  indigo: "radial-gradient(90% 60% at 10% 100%, rgba(120,140,255,0.35), transparent 65%), linear-gradient(165deg, #222d5c, #0b0f22 75%)",
  plum: "radial-gradient(90% 60% at 90% 100%, rgba(230,120,200,0.3), transparent 65%), linear-gradient(165deg, #4a2550, #160a19 75%)",
  sand: "radial-gradient(90% 60% at 20% 0%, rgba(255,255,255,0.25), transparent 60%), linear-gradient(165deg, #b8955f, #4a3720 80%)"
};

/** Full-screen «Итоги месяца» in the format of stories: tap to go on, hold to pause. */
function MonthStory({ month }: { month: string }) {
  const { entries } = useLedger();
  const categories = useCategoryMap();
  const base = useData((s) => s.settings.baseCurrency);
  const s = useMemo(() => monthSummary(entries, categories, month, todayKey()), [entries, categories, month]);
  const slides = useMemo(() => buildSlides(s, base), [s, base]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const last = useRef(performance.now());
  const pressAt = useRef(0);

  const close = () => useUI.setState({ story: null });
  const next = () => (i < slides.length - 1 ? (setI(i + 1), setProgress(0), haptic()) : close());
  const prev = () => (i > 0 ? (setI(i - 1), setProgress(0), haptic()) : setProgress(0));

  // progress clock
  useEffect(() => {
    let raf = 0;
    last.current = performance.now();
    const tick = (t: number) => {
      const dt = t - last.current;
      last.current = t;
      if (!paused) setProgress((p) => Math.min(1, p + dt / SLIDE_MS));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, i]);

  useEffect(() => {
    if (progress >= 1) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const slide = slides[i];

  return (
    <motion.div
      className="fixed inset-0 z-[95] overflow-hidden text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Итоги: ${s.nameNom}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: ease.out }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => info.offset.y > 120 && close()}
    >
      <AnimatePresence initial={false}>
        <motion.div key={slide.key} className="absolute inset-0" style={{ background: slide.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
      </AnimatePresence>

      {/* progress */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
        {slides.map((sl, k) => (
          <div key={sl.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={close}
        className="absolute right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/10 active:bg-white/20"
        style={{ top: "calc(var(--safe-top) + 22px)" }}
      >
        <X size={20} />
      </button>

      {/* tap zones */}
      <div
        className="absolute inset-0 z-[5]"
        onPointerDown={() => {
          pressAt.current = Date.now();
          setPaused(true);
        }}
        onPointerUp={(e) => {
          setPaused(false);
          if (Date.now() - pressAt.current > 350) return; // that was a hold
          const x = e.clientX / window.innerWidth;
          if (x < 0.3) prev();
          else next();
        }}
        onPointerCancel={() => setPaused(false)}
      />

      <div className="pointer-events-none relative z-[6] flex h-full flex-col px-7" style={{ paddingTop: "calc(var(--safe-top) + 92px)", paddingBottom: "calc(var(--safe-bottom) + 40px)" }}>
        <AnimatePresence mode="wait">
          <motion.div key={slide.key} className="flex flex-1 flex-col" initial="in" animate="on" exit="out" variants={{ in: {}, on: { transition: { staggerChildren: 0.08 } }, out: { opacity: 0, transition: { duration: 0.15 } } }}>
            {slide.body}
          </motion.div>
        </AnimatePresence>
      </div>

      {i === slides.length - 1 && (
        <div className="absolute inset-x-7 z-20 flex gap-2.5" style={{ bottom: "calc(var(--safe-bottom) + 24px)" }}>
          <button type="button" onClick={close} className="h-[52px] flex-1 rounded-[16px] bg-white/15 text-callout font-semibold backdrop-blur active:bg-white/20">
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              nav.tab("analytics");
            }}
            className="h-[52px] flex-1 rounded-[16px] bg-white text-callout font-semibold text-black active:opacity-80"
          >
            Аналитика
          </button>
        </div>
      )}
    </motion.div>
  );
}

const item = { in: { opacity: 0, y: 18 }, on: { opacity: 1, y: 0, transition: { duration: 0.55, ease: ease.out } } };

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={item} className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
      {children}
    </motion.div>
  );
}

function Big({ value, currency, className }: { value: number; currency: string; className?: string }) {
  const shown = useCountUp(value, 1.1, { from: 0, delay: 0.15 });
  return (
    <motion.div variants={item} className={cn("num-display mt-3 leading-none", className)} style={{ fontSize: value >= 1e10 ? 46 : 56 }}>
      {formatMoney(shown, { currency })}
    </motion.div>
  );
}

function Line({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.p variants={item} className={cn("mt-4 text-[19px] leading-[26px] text-white/80", className)}>
      {children}
    </motion.p>
  );
}

function buildSlides(s: MonthSummary, cur: string): Slide[] {
  const out: Slide[] = [];
  const money = (v: number) => formatMoney(v, { currency: cur });

  out.push({
    key: "cover",
    bg: BG.sumi,
    body: (
      <div className="flex flex-1 flex-col justify-end pb-24">
        <Eyebrow>Итоги месяца</Eyebrow>
        <motion.h1 variants={item} className="mt-3 text-[64px] font-bold leading-[0.95] tracking-[-0.04em]">
          Ваш
          <br />
          {s.nameNom}
        </motion.h1>
        <Line>Коротко о главном: сколько ушло, куда и что получилось сберечь.</Line>
      </div>
    )
  });

  const change = s.expenseChange;
  out.push({
    key: "spent",
    bg: BG.ember,
    body: (
      <div className="flex flex-1 flex-col justify-center">
        <Eyebrow>Потрачено</Eyebrow>
        <Big value={s.expense} currency={cur} />
        {change !== null && Math.abs(change) >= 0.01 && (
          <Line>
            На <b className="font-semibold text-white">{formatPercent(Math.abs(change))}</b> {change < 0 ? "меньше" : "больше"}, чем в {s.prevNamePrep}
          </Line>
        )}
        <Line className="text-white/70">
          {s.purchases} {s.purchases % 10 === 1 && s.purchases % 100 !== 11 ? "трата" : [2, 3, 4].includes(s.purchases % 10) && ![12, 13, 14].includes(s.purchases % 100) ? "траты" : "трат"} · в среднем {money(s.avgPerDay)} в день
        </Line>
      </div>
    )
  });

  if (s.income > 0) {
    const rate = s.savingsRate ?? 0;
    out.push({
      key: "saved",
      bg: rate >= 0 ? BG.jade : BG.plum,
      body: (
        <div className="flex flex-1 flex-col justify-center">
          <Eyebrow>{rate >= 0 ? "Отложено" : "Перерасход"}</Eyebrow>
          <Big value={Math.abs(s.net)} currency={cur} />
          <Line>
            {rate >= 0 ? (
              <>
                Это <b className="font-semibold text-white">{formatPercent(rate)}</b> от дохода в {money(s.income)}.
              </>
            ) : (
              <>Расходы превысили доходы ({money(s.income)}). Ничего страшного — главное это видеть.</>
            )}
          </Line>
          <motion.div variants={item} className="mt-8 h-2 overflow-hidden rounded-full bg-white/15">
            <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, Math.abs(rate) * 100))}%` }} transition={{ delay: 0.5, duration: 1, ease: ease.out }} />
          </motion.div>
        </div>
      )
    });
  }

  if (s.top.length) {
    out.push({
      key: "top",
      bg: BG.indigo,
      body: (
        <div className="flex flex-1 flex-col justify-center">
          <Eyebrow>Куда ушло больше всего</Eyebrow>
          <div className="mt-6 flex flex-col gap-5">
            {s.top.map((c, k) => (
              <motion.div key={c.id} variants={item}>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: c.color }}>
                    <NamedIcon name={c.icon} size={21} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[19px] font-semibold">{c.name}</span>
                  <span className="num text-[19px]">{money(c.amount)}</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <motion.div className="h-full rounded-full" style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(3, c.share * 100)}%` }} transition={{ delay: 0.35 + k * 0.12, duration: 0.9, ease: ease.out }} />
                </div>
              </motion.div>
            ))}
          </div>
          <Line className="text-white/70">Эти три категории — {formatPercent(s.top.reduce((a, c) => a + c.share, 0))} всех трат месяца.</Line>
        </div>
      )
    });
  }

  if (s.biggest) {
    out.push({
      key: "biggest",
      bg: BG.plum,
      body: (
        <div className="flex flex-1 flex-col justify-center">
          <Eyebrow>Самая крупная трата</Eyebrow>
          <motion.div variants={item} className="mt-6 grid h-16 w-16 place-items-center rounded-[20px]" style={{ background: s.biggest.color }}>
            <NamedIcon name={s.biggest.icon} size={30} strokeWidth={1.9} />
          </motion.div>
          <motion.div variants={item} className="mt-5 text-[26px] font-semibold leading-tight">
            {s.biggest.title}
          </motion.div>
          <Big value={s.biggest.amount} currency={cur} className="!mt-2" />
          <Line className="text-white/70">{formatDate(s.biggest.day, { long: true, year: "auto" })}</Line>
        </div>
      )
    });
  }

  const max = Math.max(1, ...s.weekday);
  out.push({
    key: "rhythm",
    bg: BG.sand,
    body: (
      <div className="flex flex-1 flex-col justify-center">
        <Eyebrow>Ритм месяца</Eyebrow>
        <motion.div variants={item} className="mt-4 text-[44px] font-bold leading-none tracking-[-0.03em]">
          {s.noSpendDays} {s.noSpendDays % 10 === 1 && s.noSpendDays % 100 !== 11 ? "день" : [2, 3, 4].includes(s.noSpendDays % 10) && ![12, 13, 14].includes(s.noSpendDays % 100) ? "дня" : "дней"}
        </motion.div>
        <Line className="!mt-2">без единой траты</Line>
        {s.peakWeekday !== null && (
          <>
            <motion.div variants={item} className="mt-10 flex h-28 items-end gap-2.5">
              {s.weekday.map((v, k) => (
                <div key={k} className="flex flex-1 flex-col items-center gap-2">
                  <motion.div className={cn("w-full rounded-t-[6px]", k === s.peakWeekday ? "bg-white" : "bg-white/30")} initial={{ height: 0 }} animate={{ height: `${Math.max(4, (v / max) * 88)}px` }} transition={{ delay: 0.4 + k * 0.05, duration: 0.7, ease: ease.out }} />
                  <span className={cn("text-[12px] font-medium", k === s.peakWeekday ? "text-white" : "text-white/50")}>{WEEKDAYS_SHORT[k]}</span>
                </div>
              ))}
            </motion.div>
            <Line>
              Больше всего тратите по <b className="font-semibold text-white">{WEEKDAYS_ACC[s.peakWeekday]}</b>.
            </Line>
          </>
        )}
      </div>
    )
  });

  out.push({
    key: "end",
    bg: BG.sumi,
    body: (
      <div className="flex flex-1 flex-col justify-center pb-24">
        <Eyebrow>{s.nameNom}</Eyebrow>
        <motion.h2 variants={item} className="mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
          {s.net >= 0 ? "Хороший месяц." : "Новый месяц — новый шанс."}
        </motion.h2>
        <Line>{s.net >= 0 ? `Вы сберегли ${money(s.net)}. Так держать.` : "Загляните в бюджеты — там видно, где можно подтянуть."}</Line>
      </div>
    )
  });

  return out;
}
