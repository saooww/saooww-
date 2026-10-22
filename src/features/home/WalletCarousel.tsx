import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { Plus } from "lucide-react";
import { haptic } from "../../lib/haptics";
import { cn } from "../../lib/cn";
import type { Minor } from "../../lib/money";
import { materialOf, TOTAL_MATERIAL, walletKindInfo, type CardMaterial } from "../../store/catalog";
import { useBalances, useTotalBalance } from "../../store/hooks";
import { useData } from "../../store/store";
import { activeWallets } from "../../lib/finance";
import { useUI } from "../../store/ui";
import { iconByName } from "../../ui/icons";
import { spring } from "../../ui/motion";
import { CARD_RATIO, WalletCard } from "../../ui/WalletCard";
import { pluralN } from "../../lib/dates";
import type { ID } from "../../store/types";
import { Layers } from "lucide-react";

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
        title: "Все счета",
        label: "Всего",
        subtitle: pluralN(counted, ["счёт", "счёта", "счетов"]),
        icon: Layers,
        amount: total.total,
        currency: base,
        material: TOTAL_MATERIAL,
        footnote: total.missing.length ? `без ${total.missing.join(", ")} — нет курса` : undefined
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
        material: materialOf(w.style),
        badge: w.currency !== base ? w.currency : undefined
      });
    }
    return cards;
  }, [wallets, balances, total, base]);
}

export function WalletCarousel({ onOpen, onAdd, intro = false }: { onOpen: (card: CardModel, rect: DOMRect) => void; onAdd: () => void; intro?: boolean }) {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const setIndex = useUI((s) => s.setHomeCardIndex);
  const heroWalletId = useUI((s) => s.heroWalletId);
  const hidden = useData((s) => s.settings.hideAmounts);
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
            <span className="text-callout font-medium">Добавить кошелёк</span>
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
        aria-roledescription="карусель"
        aria-label="Кошельки"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") goTo(safeIndex + 1);
          if (e.key === "ArrowLeft") goTo(safeIndex - 1);
        }}
        style={{ aspectRatio: String(CARD_RATIO) }}
      >
        {/* ambient light cast by the card in front */}
        {width > 0 &&
          cards.map((c, i) => (Math.abs(i - safeIndex) <= 1 ? <AmbientGlow key={c.key} color={c.material.glow} i={i} x={x} step={step} intro={intro} /> : null))}

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
                onToggleHidden={toggleHidden}
                onTap={(rect) => (i === safeIndex ? onOpen(c, rect) : goTo(i))}
              />
            ))}
          </motion.div>
        )}
      </div>

      {count > 1 && (
        <motion.div
          className="mt-4 flex h-2 items-center justify-center gap-[5px]"
          aria-hidden="true"
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.4 }}
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
  onToggleHidden: () => void;
  onTap: (rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dist = useTransform(x, (v) => Math.min(1, Math.abs(v + i * step) / step));
  const scale = useTransform(dist, [0, 1], [1, 0.9]);
  const opacity = useTransform(dist, [0, 1], [1, 0.4]);
  const sheen = useTransform(x, (v) => Math.max(-1, Math.min(1, (v + i * step) / step)));
  return (
    <motion.div
      ref={ref}
      className="shrink-0 cursor-pointer"
      // Own layer: swiping moves and scales finished pictures of the cards.
      style={{ width, scale, opacity: invisible ? 0 : opacity, willChange: "transform" }}
      initial={intro ? { y: 26 } : false}
      animate={{ y: 0 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onTap={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-no-tap]")) return;
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onTap(rect);
      }}
      role="button"
      aria-label={`${card.title}`}
    >
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
  );
}

function AmbientGlow({ color, i, x, step, intro }: { color: string; i: number; x: MotionValue<number>; step: number; intro: boolean }) {
  const opacity = useTransform(x, (v) => Math.max(0, 1 - Math.abs(v + i * step) / step));
  return (
    <motion.div aria-hidden="true" className="pointer-events-none absolute -inset-x-12 -bottom-24 -top-16" style={{ opacity, willChange: "opacity" }}>
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(50% 46% at 50% 54%, ${color}, transparent 100%)` }}
        initial={intro ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  );
}
