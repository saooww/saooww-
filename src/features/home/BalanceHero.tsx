import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Plus } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { materialOf } from "../../store/catalog";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
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
export function BalanceHero() {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const setIndex = useUI((s) => s.setHomeCardIndex);
  const hidden = useData((s) => s.settings.hideAmounts);
  const name = useData((s) => s.settings.name.trim().split(/\s+/)[0]);
  const i = Math.min(index, Math.max(0, cards.length - 1));
  const card = cards[i];
  const wallets = cards.filter((c) => c.walletId);

  const go = (n: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, n));
    if (next !== i) haptic();
    setIndex(next);
  };
  const open = (c: CardModel) => (c.walletId ? nav.push("wallet", { id: c.walletId }) : nav.tab("wallets"));
  const bg = !card || !card.walletId ? RED.background : card.material.background;

  return (
    <div role="region" aria-roledescription={tr("карусель")} aria-label={tr("Кошельки")}>
      <div className="relative overflow-hidden text-white" style={{ marginTop: "calc(-1 * (var(--safe-top) + 52px))", paddingTop: "calc(var(--safe-top) + 60px)", minHeight: "calc(var(--safe-top) + 52px + 290px)" }}>
        {/* the colour, crossfading between accounts, with streaks of light over it */}
        <AnimatePresence initial={false}>
          <motion.div key={card?.key ?? "none"} aria-hidden="true" className="absolute inset-0" style={{ background: bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />
        </AnimatePresence>
        <div aria-hidden="true" className="hero-light pointer-events-none absolute inset-0" />

        <motion.div
          className="relative px-[22px] pb-14"
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
          <div className="mt-4 text-subhead text-white/80">{!card || !card.walletId ? tr("Доступно на счетах") : card.subtitle ?? tr("Баланс")}</div>
          {card ? (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={card.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
                <AnimatedMoney value={card.amount} currency={card.currency} variant="hero" privacy className="mt-1 block text-[46px] leading-[1.05]" />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="mt-1 text-title-2 font-semibold">{tr("Добавьте первый счёт")}</div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (card ? open(card) : nav.sheet("wallet"))}
              className="h-9 rounded-full px-4 text-subhead font-semibold"
              style={{ background: "rgba(255,255,255,0.14)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.3)" }}
            >
              {card ? tr("Подробнее") : tr("Добавить")}
            </button>
            {hidden && <span className="text-caption text-white/70">{tr("Суммы скрыты")}</span>}
          </div>
        </motion.div>

        {cards.length > 1 && (
          <div className="absolute inset-x-0 bottom-12 flex justify-center gap-[5px]" aria-hidden="true">
            {cards.map((c, k) => (
              <motion.span key={c.key} className={cn("h-[5px] rounded-full", k === i ? "bg-white" : "bg-white/45")} animate={{ width: k === i ? 20 : 5 }} />
            ))}
          </div>
        )}
      </div>

      {/* the sheet that rises over the colour: every account as a tile */}
      <div className="relative -mt-8 rounded-t-[32px] bg-[var(--bg)] pt-5">
        <div className="scroll-x flex gap-2.5 px-4 pb-1">
          {wallets.map((c) => (
            <motion.button
              key={c.key}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptic();
                open(c);
              }}
              className={cn("panel relative flex h-[116px] w-[158px] shrink-0 flex-col rounded-[22px] px-3.5 py-3 text-left", c.key === card?.key && "!shadow-[inset_0_0_0_1.5px_var(--ink)]")}
            >
              <Money value={c.amount} currency={c.currency} privacy className="num block truncate text-[19px] font-bold leading-tight" />
              <span className="mt-1 truncate text-caption text-ink-2">
                {c.title}
                {c.ident ? ` ··${c.ident}` : ""}
              </span>
              <span aria-hidden="true" className="absolute bottom-3 right-3 h-[26px] w-[40px] rounded-[6px]" style={{ background: c.material.background, boxShadow: "0 4px 10px -4px rgba(0,0,0,0.6)" }} />
            </motion.button>
          ))}
          <button type="button" onClick={() => nav.sheet("wallet")} aria-label={tr("Новый кошелёк")} className="grid h-[116px] w-[64px] shrink-0 place-items-center rounded-[22px] border border-dashed border-line-strong text-ink-2">
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
