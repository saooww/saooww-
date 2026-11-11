import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank, type LucideIcon } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { BalanceHero } from "./BalanceHero";
import { DayStrip } from "./DayBudget";
import { IncomeCard } from "./Incomes";
import { tr } from "../../i18n/i18n";

/**
 * The top of the home screen: the red block with the balance and today's
 * allowance, and the sheet rising over it with four round actions.
 */
export function HomeHero() {
  return (
    <BalanceHero>
      <QuickActions />
      <IncomeCard />
      <DayStrip />
    </BalanceHero>
  );
}

const KIND_FILL = {
  expense: { bg: "linear-gradient(160deg, #ff3b47, #a8000e)", glow: "#fa0717" },
  income: { bg: "linear-gradient(160deg, #3cc896, #0b6a47)", glow: "#3cc896" },
  transfer: { bg: "linear-gradient(160deg, #6f8cff, #2b3a9a)", glow: "#6f8cff" },
  saving: { bg: "linear-gradient(160deg, #e6b45a, #7a4f12)", glow: "#e6b45a" }
} as const;

/** Save to the main goal; without goals, open the goals to set one. */
function saveToGoal() {
  const goals = useData.getState().goals.filter((g) => !g.archived);
  const goal = goals.find((g) => g.primary) ?? goals[0];
  if (goal) nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" });
  else nav.sheet("goal");
}

const ACTIONS: Array<{ id: keyof typeof KIND_FILL; label: string; icon: LucideIcon; run: () => void }> = [
  { id: "expense", label: tr("Расход"), icon: ArrowUpRight, run: () => nav.sheet("composer", { kind: "expense" }) },
  { id: "income", label: tr("Доход"), icon: ArrowDownLeft, run: () => nav.sheet("composer", { kind: "income" }) },
  { id: "transfer", label: tr("Перевод"), icon: ArrowLeftRight, run: () => nav.sheet("composer", { kind: "transfer" }) },
  { id: "saving", label: tr("Отложить"), icon: PiggyBank, run: saveToGoal }
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
          <span className="grid h-[54px] w-[54px] place-items-center rounded-[19px] text-white" style={{ background: KIND_FILL[a.id].bg, boxShadow: `0 10px 22px -10px ${KIND_FILL[a.id].glow}, inset 0 1px 0 rgba(255,255,255,0.28)` }}>
            <a.icon size={22} />
          </span>
          <span className="text-caption font-medium text-ink-2">{a.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const QUESTIONS = [tr("На что ушло больше всего?"), tr("Почему траты выросли?"), tr("Сколько можно отложить?"), tr("Что скоро списать?")];
