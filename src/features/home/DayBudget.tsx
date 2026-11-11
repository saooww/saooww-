import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "../../ui/glyphs";
import { formatMoney } from "../../lib/money";
import { safeToSpend } from "../../lib/safeToSpend";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { AnimatedMoney } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { tr } from "../../i18n/i18n";

/**
 * «Можно потратить сегодня» — a dark strip set into the red block at the top
 * of the home screen: what is left for today, recounted after every
 * operation, and a bar of how much of today's norm is still free. Tapping it
 * opens the day in full. Crossing the norm brings a warning.
 */
export function DayStrip() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);

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

  const shell = "mt-5 flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left text-white";
  const glass = { background: "rgba(0,0,0,0.28)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.16)", backdropFilter: "blur(12px)" } as const;

  if (!s || s.allowance <= 0) {
    return (
      <button type="button" onClick={() => nav.tab("wallets")} aria-label={tr("Карта дня")} className={shell} style={glass}>
        <span className="flex-1 text-subhead font-semibold">{tr("Добавьте остатки — посчитаю сумму на день")}</span>
        <ChevronRight size={16} className="opacity-70" />
      </button>
    );
  }

  const over = s.today < 0;
  const share = over ? 1 : Math.max(0, Math.min(1, s.today / s.allowance));
  return (
    <motion.button
      type="button"
      aria-label={`${over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}: ${Math.abs(s.today) / 100} ${base}`}
      onClick={() => {
        haptic();
        nav.sheet("day");
      }}
      onPointerDownCapture={(e) => e.stopPropagation()}
      whileTap={{ scale: 0.98 }}
      transition={spring.press}
      className={shell}
      style={glass}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-white/80">{over ? tr("Сегодня сверх нормы") : tr("Можно потратить сегодня")}</span>
        <AnimatedMoney value={Math.abs(s.today)} currency={base} variant="hero" privacy className="mt-0.5 block text-[24px] leading-none" />
      </span>
      <span className="w-[42%] shrink-0">
        <span className="block h-[7px] overflow-hidden rounded-full bg-white/25">
          <motion.span className="block h-full rounded-full" style={{ background: over ? "#ffd0d0" : "#fff", boxShadow: "0 0 12px rgba(255,255,255,0.6)" }} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </span>
        <span className="num mt-1.5 block text-right text-[11px] text-white/80">{tr("из {0}", formatMoney(s.allowance, { currency: base }))}</span>
      </span>
    </motion.button>
  );
}
