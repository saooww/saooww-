import { memo, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { presentTx, type PresentCtx } from "../../lib/present";
import { useCategoryMap, useWalletMap } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Transaction } from "../../store/types";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { IconChip } from "../../ui/primitives";

export function usePresentCtx(): PresentCtx {
  const wallets = useWalletMap();
  const categories = useCategoryMap();
  const goals = useData((s) => s.goals);
  const debts = useData((s) => s.debts);
  const baseCurrency = useData((s) => s.settings.baseCurrency);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  return useMemo(
    () => ({ wallets, categories, goals: new Map(goals.map((g) => [g.id, g])), debts: new Map(debts.map((d) => [d.id, d])), baseCurrency, defaultWalletId }),
    [wallets, categories, goals, debts, baseCurrency, defaultWalletId]
  );
}

const REVEAL = 84;

export const TxRow = memo(function TxRow({
  tx,
  ctx,
  onOpen,
  onDelete,
  walletId,
  dense
}: {
  tx: Transaction;
  ctx: PresentCtx;
  onOpen: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  /** Present transfers from this wallet's point of view */
  walletId?: ID;
  dense?: boolean;
}) {
  const v = presentTx(tx, ctx, { walletId });
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  // A swipe must never also count as a tap on the row.
  const dragged = useRef(false);
  const actionOpacity = useTransform(x, [-REVEAL, -24, 0], [1, 0.4, 0]);

  const settle = (to: number) => {
    setOpen(to !== 0);
    animate(x, to, spring.snappy);
  };

  const row = (
    <div className={cn("flex w-full items-center gap-3 px-4", dense ? "min-h-[58px] py-2" : "min-h-[62px] py-2.5")}>
      <IconChip name={v.icon} color={v.color} size={40} />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-body text-ink">{v.title}</div>
        {v.subtitle && <div className="mt-0.5 truncate text-footnote text-ink-2">{v.subtitle}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <Money value={v.amount} currency={v.currency} sign={v.sign} tone={v.tone === "positive" ? "positive" : v.tone === "muted" ? "muted" : "default"} className="text-body font-medium" />
        {v.time && <span className="mt-0.5 text-footnote text-ink-3 tnum">{v.time}</span>}
      </div>
    </div>
  );

  if (!onDelete) {
    return (
      <button type="button" onClick={() => onOpen(tx)} className="block w-full transition-colors duration-100 active:bg-surface-press">
        {row}
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <motion.button
        type="button"
        aria-label="Удалить операцию"
        style={{ opacity: actionOpacity }}
        onClick={() => {
          haptic("warning");
          settle(0);
          onDelete(tx);
        }}
        className="absolute inset-y-0 right-0 flex w-[84px] flex-col items-center justify-center gap-1 bg-negative text-white"
      >
        <Trash2 size={18} />
        <span className="text-caption font-semibold">Удалить</span>
      </motion.button>
      <motion.div
        className="relative"
        style={{ x, touchAction: "pan-y", background: "var(--surface)" }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.25, right: 0.05 }}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          settle(info.offset.x < -REVEAL / 2 || info.velocity.x < -400 ? -REVEAL : 0);
          window.setTimeout(() => (dragged.current = false), 80);
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return;
            if (open) settle(0);
            else onOpen(tx);
          }}
          className="block w-full transition-colors duration-100 active:bg-surface-press"
        >
          {row}
        </button>
      </motion.div>
    </div>
  );
});
