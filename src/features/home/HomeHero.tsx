import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, type LucideIcon } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { nav } from "../../store/ui";
import { BalanceHero } from "./BalanceHero";
import { ForecastStrip } from "./Forecast";
import { DayStrip } from "./DayBudget";
import { IncomeCard } from "./Incomes";
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
      <IncomeCard />
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
    <div className="mx-4 grid grid-cols-3 gap-2">
      {ACTIONS.map(({ kind, label, icon: Icon, color }) => (
        <motion.button
          key={kind}
          type="button"
          onClick={() => {
            haptic();
            nav.sheet("composer", { kind });
          }}
          whileTap={{ scale: 0.96 }}
          className="panel flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-2 text-center"
        >
          <Icon size={20} strokeWidth={2.2} style={{ color }} />
          <span className="text-footnote font-semibold leading-tight text-ink [overflow-wrap:anywhere]">{label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const QUESTIONS = [tr("На что ушло больше всего?"), tr("Почему траты выросли?"), tr("Сколько можно отложить?"), tr("Что скоро списать?")];
