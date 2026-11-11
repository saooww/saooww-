import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Sparkles, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { nav } from "../../store/ui";
import { BalanceHero } from "./BalanceHero";
import { tr } from "../../i18n/i18n";

/**
 * The top of the home screen: the red block with the balance and today's
 * allowance, and the sheet rising over it with four round actions.
 */
export function HomeHero() {
  return (
    <BalanceHero>
      <QuickActions />
    </BalanceHero>
  );
}

const ACTIONS: Array<{ id: string; label: string; icon: LucideIcon; run: () => void; accent?: boolean }> = [
  { id: "expense", label: tr("Расход"), icon: ArrowUpRight, run: () => nav.sheet("composer", { kind: "expense" }), accent: true },
  { id: "income", label: tr("Доход"), icon: ArrowDownLeft, run: () => nav.sheet("composer", { kind: "income" }) },
  { id: "transfer", label: tr("Перевод"), icon: ArrowLeftRight, run: () => nav.sheet("composer", { kind: "transfer" }) },
  { id: "ask", label: tr("Спросить"), icon: Sparkles, run: () => nav.push("assistant", {}) }
];

/** Four round actions under the cards, as in a banking app. */
function QuickActions() {
  return (
    <div className="mx-4 grid grid-cols-4 gap-2">
      {ACTIONS.map((a, i) => (
        <motion.button
          key={a.id}
          type="button"
          onClick={() => {
            haptic();
            a.run();
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.35 }}
          whileTap={{ scale: 0.92 }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className={cn("grid h-[54px] w-[54px] place-items-center rounded-full", a.accent ? "fill-accent text-[var(--accent-on)] shadow-[0_10px_24px_-10px_var(--accent)]" : "tile text-ink")}>
            <a.icon size={21} />
          </span>
          <span className="text-caption font-medium text-ink-2">{a.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const QUESTIONS = [tr("На что ушло больше всего?"), tr("Почему траты выросли?"), tr("Сколько можно отложить?"), tr("Что скоро списать?")];
