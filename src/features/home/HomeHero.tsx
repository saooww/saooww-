import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, type LucideIcon } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { nav } from "../../store/ui";
import { BalanceHero } from "./BalanceHero";
import { ForecastStrip } from "./Forecast";
import { DayStrip } from "./DayBudget";
import { tr } from "../../i18n/i18n";

/**
 * Balance and frequently used actions, followed by the daily allowance and forecast.
 */
export function HomeHero() {
  return (
    <BalanceHero>
      <QuickActions />
      <DayStrip />
      <ForecastStrip />
    </BalanceHero>
  );
}

const ACTIONS: Array<{ kind: "expense" | "income" | "transfer"; label: string; icon: LucideIcon; color: string }> = [
  { kind: "expense", label: tr("Расход"), icon: ArrowUpRight, color: "var(--accent-ink)" },
  { kind: "income", label: tr("Доход"), icon: ArrowDownLeft, color: "var(--positive)" },
  { kind: "transfer", label: tr("Перевод"), icon: ArrowLeftRight, color: "var(--transfer)" }
];

function QuickActions() {
  return (
    <div className="panel mx-4 grid grid-cols-3 overflow-hidden rounded-[22px]">
      {ACTIONS.map(({ kind, label, icon: Icon, color }) => (
        <motion.button
          key={kind}
          type="button"
          onClick={() => {
            haptic();
            nav.sheet("composer", { kind });
          }}
          whileTap={{ scale: 0.96 }}
          className="flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1 border-l border-[var(--line)] px-1 py-2 text-center first:border-l-0 active:bg-surface-press"
        >
          <Icon size={20} strokeWidth={2.2} style={{ color }} />
          <span className="text-footnote font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const QUESTIONS = [tr("На что ушло больше всего?"), tr("Почему траты выросли?"), tr("Сколько можно отложить?"), tr("Что скоро списать?")];
