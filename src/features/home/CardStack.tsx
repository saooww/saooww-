import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { spring } from "../../ui/motion";
import { CARD_RATIO, WalletCard } from "../../ui/WalletCard";
import { useCardModels, type CardModel } from "./WalletCarousel";
import { tr } from "../../i18n/i18n";

const PEEK = 38; // the visible top edge of each card behind
const MAX_PEEKS = 4;

/**
 * The cards as a stack, the way Apple Wallet keeps them: the chosen card in
 * front in full, the others behind it showing only their top edge with the
 * name and balance. Tap an edge and that card slides to the front; tap the
 * front card to open it.
 */
export function CardStack() {
  const cards = useCardModels();
  const index = useUI((s) => s.homeCardIndex);
  const setIndex = useUI((s) => s.setHomeCardIndex);
  const heroWalletId = useUI((s) => s.heroWalletId);
  const hidden = useData((s) => s.settings.hideAmounts);
  const toggleHidden = useCallback(() => {
    haptic();
    const st = useData.getState();
    st.updateSettings({ hideAmounts: !st.settings.hideAmounts });
  }, []);
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!cards.length) {
    return (
      <div className="px-4">
        <button type="button" onClick={() => nav.sheet("wallet")} className="grid w-full place-items-center rounded-[24px] border border-dashed border-line-strong text-ink-2" style={{ aspectRatio: String(CARD_RATIO) }}>
          <span className="flex flex-col items-center gap-2">
            <Plus size={24} />
            <span className="text-callout font-medium">{tr("Добавить кошелёк")}</span>
          </span>
        </button>
      </div>
    );
  }

  const front = Math.min(index, cards.length - 1);
  // behind the front card: the others in their order, the nearest last
  const behind = cards.map((c, i) => ({ c, i })).filter((x) => x.i !== front).slice(0, MAX_PEEKS);
  const cardH = width / CARD_RATIO;
  const height = behind.length * PEEK + cardH;

  const open = (c: CardModel, el: HTMLElement | null) => {
    const rect = el?.getBoundingClientRect();
    if (c.walletId && rect) nav.push("wallet", { id: c.walletId, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
    else nav.tab("wallets");
  };

  return (
    <div ref={wrap} className="relative mx-4" role="region" aria-roledescription={tr("карусель")} aria-label={tr("Кошельки")} style={{ height: width ? height : undefined, aspectRatio: width ? undefined : String(CARD_RATIO) }}>
      {width > 0 &&
        [...behind.map((x, k) => ({ ...x, top: k * PEEK, depth: behind.length - k })), { c: cards[front], i: front, top: behind.length * PEEK, depth: 0 }].map(({ c, i, top, depth }) => (
          <motion.div
            key={c.key}
            ref={(el) => {
              if (el) refs.current.set(c.key, el);
              else refs.current.delete(c.key);
            }}
            role="button"
            aria-label={depth ? tr("Показать: {0}", c.title) : c.title}
            className="absolute inset-x-0 cursor-pointer"
            style={{ height: cardH, zIndex: 10 - depth, transformOrigin: "50% 0%", opacity: c.walletId && c.walletId === heroWalletId ? 0 : 1 }}
            initial={false}
            animate={{ top, scale: 1 - depth * 0.025, filter: depth ? `brightness(${1 - depth * 0.08})` : "brightness(1)" }}
            transition={spring.card}
            onTap={(e) => {
              if ((e.target as HTMLElement | null)?.closest("[data-no-tap]")) return;
              if (depth) {
                haptic();
                setIndex(i);
              } else open(c, refs.current.get(c.key) ?? null);
            }}
            whileTap={{ scale: 1 - depth * 0.025 - 0.015 }}
          >
            <WalletCard
              title={c.title}
              subtitle={c.subtitle}
              icon={c.icon}
              ident={c.ident}
              amount={c.amount}
              currency={c.currency}
              material={c.material}
              badge={c.badge}
              footnote={c.footnote}
              label={c.label}
              hidden={hidden}
              onToggleHidden={toggleHidden}
              stacked={depth > 0}
            />
          </motion.div>
        ))}
    </div>
  );
}
