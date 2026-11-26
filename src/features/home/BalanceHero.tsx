import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { capitalChange } from "../../lib/analytics";
import { formatMoney, formatPercent } from "../../lib/money";
import { useAppData, useBalances, useToday } from "../../store/hooks";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "../../ui/glyphs";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { materialOf } from "../../store/catalog";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { ease, spring } from "../../ui/motion";
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
  const animations = useData((s) => s.settings.animations);
  const reducedMotion = useReducedMotion();
  const animateCard = animations && !reducedMotion;
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
      <div className="relative isolate -mt-[calc(var(--safe-top)+52px)] flex min-h-[calc(var(--safe-top)+clamp(352px,45svh,410px))] flex-col overflow-hidden bg-[#7b121d] pt-[calc(var(--safe-top)+73px)] text-white">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={card?.key ?? "none"}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: bg }}
            initial={animateCard ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animateCard ? 0.36 : 0, ease: ease.out }}
          >
            <motion.div
              className="hero-light absolute inset-0"
              initial={animateCard ? { x: "-9%", opacity: 0.65 } : false}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: animateCard ? 0.65 : 0, ease: ease.out }}
            />
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="relative flex flex-1 touch-pan-y flex-col justify-center px-6 pb-[78px]"
          drag={cards.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={animateCard ? 0.2 : 0}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50 || info.velocity.x < -400) go(i + 1);
            else if (info.offset.x > 50 || info.velocity.x > 400) go(i - 1);
          }}
        >
          <div className="mb-3 text-callout font-medium text-white/85">{greeting(new Date().getHours())}{name ? `, ${name}` : ""}</div>
          <div className="flex items-center justify-between gap-2">
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
              className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-[14px] px-2 text-subhead font-semibold"
              style={{ background: "rgba(0,0,0,0.16)" }}
            >
              <span className="truncate">{card ? (card.walletId ? card.title : tr("Все счета · {0}", wallets.length)) : tr("Счета")}</span>
              <ChevronDown size={14} className="shrink-0 opacity-70" />
            </button>
            {card && (
              <button
                type="button"
                aria-label={hidden ? tr("Показать баланс") : tr("Скрыть баланс")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/15 text-white"
                onClick={() => {
                  haptic();
                  useData.getState().updateSettings({ hideAmounts: !useData.getState().settings.hideAmounts });
                }}
              >
                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>
          <div className="mt-4 text-subhead text-white/80">{!card || !card.walletId ? tr("Сейчас на счетах") : card.subtitle ?? tr("Баланс")}</div>
          {card ? (
            <button type="button" aria-label={tr("Подробнее")} onClick={() => open(card)} className="mt-1 flex min-h-11 w-full items-center gap-1 text-left">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span className="min-w-0" key={card.key} initial={animateCard ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: animateCard ? 0.27 : 0, ease: ease.out }}>
                  <AnimatedMoney value={card.amount} currency={card.currency} variant="hero" privacy className="block !whitespace-normal [overflow-wrap:anywhere] text-[clamp(38px,12.5vw,64px)] leading-[1.05]" />
                </motion.span>
              </AnimatePresence>
              <ChevronRight size={22} className="mt-1 shrink-0 opacity-60" />
            </button>
          ) : (
            <button type="button" onClick={() => nav.sheet("wallet")} className="mt-1 text-title-2 font-semibold">{tr("Добавьте первый счёт")}</button>
          )}
          {hidden && <div className="mt-1 text-caption text-white/70">{tr("Суммы скрыты")}</div>}
          {card && !card.walletId && !hidden && change.delta !== 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-footnote font-semibold" aria-label={tr("Капитал за месяц")}>
              <span className={change.delta > 0 ? "text-[#9bf5cf]" : "text-[#ffd0d0]"}>
                {change.delta > 0 ? "↑" : "↓"} {change.delta > 0 ? "+" : "−"}
                {formatMoney(Math.abs(change.delta), { currency: card.currency })}
                {change.pct !== null ? ` · ${formatPercent(Math.abs(change.pct), Math.abs(change.pct) < 0.1 ? 1 : 0)}` : ""}
              </span>
              <span className="font-normal text-white/70">{tr("за этот месяц")}</span>
            </div>
          )}
        </motion.div>

        {cards.length > 1 && (
          <div className="absolute inset-x-0 bottom-[46px] flex justify-center gap-[5px]" aria-hidden="true">
            {cards.map((c, k) => (
              <motion.span key={c.key} className={cn("h-[5px] rounded-full", k === i ? "bg-white" : "bg-white/45")} animate={{ width: k === i ? 20 : 5 }} transition={animateCard ? spring.snappy : { duration: 0 }} />
            ))}
          </div>
        )}
      </div>

      {/* the sheet that rises over the colour */}
      <div className="home-bento relative -mt-8 rounded-t-[32px] bg-[var(--bg)] pt-4">{children}</div>
    </div>
  );
}
