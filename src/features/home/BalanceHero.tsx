import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { capitalChange } from "../../lib/analytics";
import { formatMoney, formatPercent } from "../../lib/money";
import { useAppData, useBalances, useToday } from "../../store/hooks";
import { ChevronDown, ChevronRight } from "../../ui/glyphs";
import type { ReactNode } from "react";
import { ForecastStrip } from "./Forecast";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { materialOf } from "../../store/catalog";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { AnimatedMoney } from "../../ui/Money";
import { useCardModels, type CardModel } from "./WalletCarousel";
import { tr } from "../../i18n/i18n";

const RED = materialOf("ardessa");

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return tr("Доброе утро");
  if (hour >= 12 && hour < 18) return tr("Добрый день");
  if (hour >= 18 && hour < 23) return tr("Добрый вечер");
  return tr("Доброй ночи");
}

/**
 * The top of the home screen, as banks do it now: a glossy, lit block in the
 * card's colour — Ardessa red for all accounts together — with the balance
 * in large bold figures. Swipe it to go through the accounts; under it, on a
 * sheet that rises over the colour, every account as a tile.
 */
export function BalanceHero({ children }: { children?: ReactNode }) {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const setIndex = useUI((s) => s.setHomeCardIndex);
  const hidden = useData((s) => s.settings.hideAmounts);
  const name = useData((s) => s.settings.name.trim().split(/\s+/)[0]);
  const i = Math.min(index, Math.max(0, cards.length - 1));
  const card = cards[i];
  const wallets = cards.filter((c) => c.walletId);
  const data = useAppData();
  const balances = useBalances();
  const today = useToday();
  const change = useMemo(() => capitalChange(data, balances, today), [data, balances, today]);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, n));
    if (next !== i) haptic();
    setIndex(next);
  };
  const open = (c: CardModel) => (c.walletId ? nav.push("wallet", { id: c.walletId }) : nav.tab("wallets"));
  const bg = !card || !card.walletId ? RED.background : card.material.background;

  return (
    <div role="region" aria-roledescription={tr("карусель")} aria-label={tr("Кошельки")}>
      <div className="relative overflow-hidden text-white" style={{ marginTop: "calc(-1 * (var(--safe-top) + 52px))", paddingTop: "calc(var(--safe-top) + 60px)", minHeight: "calc(var(--safe-top) + 52px + 330px)" }}>
        {/* the colour, crossfading between accounts, with streaks of light over it */}
        <AnimatePresence initial={false}>
          <motion.div key={card?.key ?? "none"} aria-hidden="true" className="absolute inset-0" style={{ background: bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
        </AnimatePresence>
        <div aria-hidden="true" className="hero-light pointer-events-none absolute inset-0" />

        <motion.div
          className="relative px-[22px] pb-[70px]"
          drag={cards.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50 || info.velocity.x < -400) go(i + 1);
            else if (info.offset.x > 50 || info.velocity.x > 400) go(i - 1);
          }}
        >
          <div className="mb-3 text-title-3 font-semibold">{greeting(new Date().getHours())}{name ? `, ${name}` : ""}</div>
          <button
            type="button"
            onClick={() => {
              haptic();
              nav.sheet("picker", {
                title: tr("Счёт"),
                value: card?.key,
                options: cards.map((c) => ({ value: c.key, label: c.title, sub: c.subtitle })),
                onSelect: (v: string) => setIndex(Math.max(0, cards.findIndex((c) => c.key === v)))
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-[14px] px-3 text-subhead font-semibold"
            style={{ background: "rgba(255,255,255,0.14)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.28)", backdropFilter: "blur(10px)" }}
          >
            {card ? (card.walletId ? card.title : tr("Все счета · {0}", wallets.length)) : tr("Счета")}
            <ChevronDown size={14} className="opacity-70" />
          </button>
          <div className="mt-4 text-subhead text-white/80">{!card || !card.walletId ? tr("Сейчас на счетах") : card.subtitle ?? tr("Баланс")}</div>
          {card ? (
            <button type="button" aria-label={tr("Подробнее")} onClick={() => open(card)} className="mt-1 flex items-center gap-1 text-left">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={card.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
                  <AnimatedMoney value={card.amount} currency={card.currency} variant="hero" privacy className="block text-[48px] leading-[1.05]" />
                </motion.span>
              </AnimatePresence>
              <ChevronRight size={22} className="mt-1 shrink-0 opacity-60" />
            </button>
          ) : (
            <button type="button" onClick={() => nav.sheet("wallet")} className="mt-1 text-title-2 font-semibold">{tr("Добавьте первый счёт")}</button>
          )}
          {hidden && <div className="mt-1 text-caption text-white/70">{tr("Суммы скрыты")}</div>}
          {card && !card.walletId && !hidden && change.delta !== 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-footnote font-semibold" aria-label={tr("Капитал за месяц")}>
              <span className={change.delta > 0 ? "text-[#9bf5cf]" : "text-[#ffd0d0]"}>
                {change.delta > 0 ? "↑" : "↓"} {change.delta > 0 ? "+" : "−"}
                {formatMoney(Math.abs(change.delta), { currency: card.currency })}
                {change.pct !== null ? ` · ${formatPercent(Math.abs(change.pct), Math.abs(change.pct) < 0.1 ? 1 : 0)}` : ""}
              </span>
              <span className="font-normal text-white/70">{tr("за этот месяц")}</span>
            </div>
          )}
          <ForecastStrip />
        </motion.div>

        {cards.length > 1 && (
          <div className="absolute inset-x-0 bottom-[46px] flex justify-center gap-[5px]" aria-hidden="true">
            {cards.map((c, k) => (
              <motion.span key={c.key} className={cn("h-[5px] rounded-full", k === i ? "bg-white" : "bg-white/45")} animate={{ width: k === i ? 20 : 5 }} />
            ))}
          </div>
        )}
      </div>

      {/* the sheet that rises over the colour */}
      <div className="relative -mt-8 rounded-t-[32px] bg-[var(--bg)] pt-6">{children}</div>
    </div>
  );
}
