import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useAnimationControls, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { Plus } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { cn } from "../../lib/cn";
import type { Minor } from "../../lib/money";
import { materialFor, TOTAL_MATERIAL, walletKindInfo, type CardMaterial } from "../../store/catalog";
import { useBalances, useTotalBalance } from "../../store/hooks";
import { useData } from "../../store/store";
import { activeWallets } from "../../lib/finance";
import { useUI, type Flight } from "../../store/ui";
import { formatMoney } from "../../lib/money";
import { iconByName } from "../../ui/icons";
import { spring } from "../../ui/motion";
import { CARD_RATIO, WalletCard } from "../../ui/WalletCard";
import { pluralN } from "../../lib/dates";
import type { ID } from "../../store/types";
import { Layers } from "../../ui/glyphs";
import { INTRO_SHIFT } from "../../ui/intro";
import { tr } from "../../i18n/i18n";

const GAP = 14;

export interface CardModel {
  key: string;
  walletId: ID | null;
  title: string;
  subtitle?: string;
  icon?: ReturnType<typeof iconByName>;
  ident?: string;
  amount: Minor;
  currency: string;
  material: CardMaterial;
  badge?: string;
  footnote?: string;
  label?: string;
}

export function useCardModels(): CardModel[] {
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const balances = useBalances();
  const total = useTotalBalance();
  return useMemo(() => {
    const list = activeWallets(wallets);
    const cards: CardModel[] = [];
    if (list.length > 1) {
      const counted = list.filter((w) => w.includeInTotal).length;
      cards.push({
        key: "total",
        walletId: null,
        title: tr("Все счета"),
        label: tr("Всего"),
        subtitle: pluralN(counted, ["счёт", "счёта", "счетов"]),
        icon: Layers,
        amount: total.total,
        currency: base,
        material: TOTAL_MATERIAL,
        footnote: total.missing.length ? tr("без {0} — нет курса", total.missing.join(", ")) : undefined
      });
    }
    for (const w of list) {
      cards.push({
        key: w.id,
        walletId: w.id,
        title: w.name,
        subtitle: walletKindInfo(w.kind).label,
        icon: iconByName(walletKindInfo(w.kind).icon),
        ident: w.ident,
        amount: balances[w.id] ?? 0,
        currency: w.currency,
        material: materialFor(w),
        badge: w.currency !== base ? w.currency : undefined
      });
    }
    return cards;
  }, [wallets, balances, total, base]);
}

export function WalletCarousel({ onOpen, onAdd, intro = false, glow = false }: { onOpen: (card: CardModel, rect: DOMRect) => void; onAdd: () => void; intro?: boolean; /** The card in front lights the page around it in its colour */ glow?: boolean }) {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const setIndex = useUI((s) => s.setHomeCardIndex);
  const heroWalletId = useUI((s) => s.heroWalletId);
  const hidden = useData((s) => s.settings.hideAmounts);
  // Only a saved amount flying into the card on the home tab; switching tabs must not
  // re-render this draggable carousel (that makes the motion library re-measure).
  const flight = useUI((s) => (s.tab === "home" ? s.flight : null));
  // Stable, so the memoised cards don't re-render when the index changes.
  const toggleHidden = useCallback(() => {
    haptic();
    const st = useData.getState();
    st.updateSettings({ hideAmounts: !st.settings.hideAmounts });
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const step = width + GAP;
  const count = cards.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep position in sync with index (resize, wallets added/removed)
  useEffect(() => {
    if (!width) return;
    if (safeIndex !== index) setIndex(safeIndex);
    x.set(-safeIndex * step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, count]);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    if (next !== safeIndex) haptic();
    setIndex(next);
    animate(x, -next * step, spring.card);
  };

  if (!count) {
    return (
      <div ref={wrap} className="px-5">
        <button
          type="button"
          onClick={onAdd}
          className="grid w-full place-items-center rounded-[22px] border border-dashed border-line-strong text-ink-2"
          style={{ aspectRatio: String(CARD_RATIO) }}
        >
          <span className="flex flex-col items-center gap-2">
            <Plus size={24} />
            <span className="text-callout font-medium">{tr("Добавить кошелёк")}</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={wrap}
        className="relative mx-5"
        role="region"
        aria-roledescription={tr("карусель")}
        aria-label={tr("Кошельки")}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") goTo(safeIndex + 1);
          if (e.key === "ArrowLeft") goTo(safeIndex - 1);
        }}
        style={{ aspectRatio: String(CARD_RATIO) }}
      >
        {/* the card in front casts a soft light of its own colour on the page */}
        {glow && (
          <AnimatePresence initial={false}>
            <motion.div
              key={cards[safeIndex]?.key}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-6 -bottom-10 top-6 -z-0 rounded-[40px]"
              style={{ background: `radial-gradient(60% 55% at 50% 60%, ${cards[safeIndex]?.material.glow ?? "transparent"}, transparent 75%)`, filter: "blur(18px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          </AnimatePresence>
        )}

        {width > 0 && (
          <motion.div
            className="absolute inset-y-0 left-0 flex touch-pan-y"
            style={{ x, gap: GAP }}
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: -(count - 1) * step, right: 0 }}
            dragElastic={0.14}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              const projected = -x.get() - info.velocity.x * 0.18;
              let target = Math.round(projected / step);
              // never skip more than one card per flick
              target = Math.max(safeIndex - 1, Math.min(safeIndex + 1, target));
              goTo(target);
            }}
          >
            {cards.map((c, i) => (
              <CarouselItem
                key={c.key}
                card={c}
                i={i}
                x={x}
                step={step}
                width={width}
                hidden={hidden}
                invisible={!!c.walletId && c.walletId === heroWalletId}
                intro={intro && i === safeIndex}
                pulse={i === safeIndex ? flight?.id : undefined}
                onToggleHidden={toggleHidden}
                onTap={(rect) => (i === safeIndex ? onOpen(c, rect) : goTo(i))}
              />
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>{flight && <SaveFlight key={flight.id} flight={flight} target={wrap} />}</AnimatePresence>

      {count > 1 && (
        <motion.div
          className="mt-4 flex h-2 items-center justify-center gap-[5px]"
          aria-hidden="true"
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05 + INTRO_SHIFT, duration: 0.4 }}
        >
          {cards.map((c, i) => (
            <motion.span
              key={c.key}
              className={cn("h-[5px] rounded-full transition-colors duration-300", i === safeIndex ? "bg-ink" : "bg-ink-4")}
              animate={{ width: i === safeIndex ? 20 : 5 }}
              transition={spring.snappy}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function CarouselItem({
  card,
  i,
  x,
  step,
  width,
  hidden,
  invisible,
  intro,
  pulse,
  onToggleHidden,
  onTap
}: {
  card: CardModel;
  i: number;
  x: MotionValue<number>;
  step: number;
  width: number;
  hidden: boolean;
  invisible: boolean;
  intro: boolean;
  /** Changes when a saved amount lands on this card */
  pulse?: number;
  onToggleHidden: () => void;
  onTap: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dist = useTransform(x, (v) => Math.min(1, Math.abs(v + i * step) / step));
  const scale = useTransform(dist, [0, 1], [1, 0.9]);
  const opacity = useTransform(dist, [0, 1], [1, 0.4]);
  const sheen = useTransform(x, (v) => Math.max(-1, Math.min(1, (v + i * step) / step)));
  // Not a remount: the balance inside must keep counting.
  const pulseCtl = useAnimationControls();
  useEffect(() => {
    if (pulse) void pulseCtl.start({ scale: [1, 1, 1.03, 1], transition: { duration: 0.75, times: [0, 0.55, 0.75, 1], ease: "easeOut" } });
  }, [pulse, pulseCtl]);
  return (
    <motion.div
      ref={ref}
      className="shrink-0 cursor-pointer"
      // Own layer: swiping moves and scales finished pictures of the cards.
      style={{ width, scale, opacity: invisible ? 0 : opacity, willChange: "transform" }}
      initial={intro ? { y: 26 } : false}
      animate={{ y: 0 }}
      transition={{ duration: 0.9, delay: 0.5 + INTRO_SHIFT, ease: [0.22, 1, 0.36, 1] }}
      onTap={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-no-tap]")) return;
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onTap(rect);
      }}
      role="button"
      aria-label={`${card.title}`}
    >
      <motion.div animate={pulseCtl}>
        <WalletCard
          title={card.title}
          subtitle={card.subtitle}
          icon={card.icon}
          ident={card.ident}
          amount={card.amount}
          currency={card.currency}
          material={card.material}
          badge={card.badge}
          footnote={card.footnote}
          label={card.label}
          hidden={hidden}
          onToggleHidden={onToggleHidden}
          sheen={sheen}
          intro={intro}
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * After saving, the amount rises from where the button was and drops into
 * the card in front, which answers with a small pulse while its balance counts.
 */
function SaveFlight({ flight, target }: { flight: Flight; target: React.RefObject<HTMLDivElement> }) {
  const rect = target.current?.getBoundingClientRect();
  const startY = window.innerHeight - 120;
  const endY = rect ? rect.top + rect.height * 0.42 : startY - 400;
  const text = formatMoney(flight.kind === "income" ? flight.amount : -flight.amount, { currency: flight.currency, sign: "always" });

  useEffect(() => {
    const id = window.setTimeout(() => useUI.setState((s) => (s.flight?.id === flight.id ? { flight: null } : {})), 1100);
    return () => window.clearTimeout(id);
  }, [flight.id]);

  return (
    <motion.div
      aria-hidden="true"
      className="glass num pointer-events-none fixed left-1/2 z-[80] -ml-[90px] flex h-11 w-[180px] items-center justify-center rounded-full text-[19px] font-semibold"
      style={{ top: 0, color: flight.kind === "income" ? "var(--positive)" : "var(--ink)" }}
      initial={{ y: startY, opacity: 0, scale: 0.9 }}
      animate={{ y: [startY, startY - 40, endY], opacity: [0, 1, 0], scale: [0.9, 1, 0.55] }}
      transition={{ duration: 0.8, times: [0, 0.3, 1], ease: [0.45, 0, 0.2, 1], delay: 0.1 }}
    >
      {text}
    </motion.div>
  );
}
