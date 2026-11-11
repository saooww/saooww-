import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleCheckBig, HandCoins, NotebookPen, PiggyBank, Target, type LucideIcon } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Sheet, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

interface Big {
  label: string;
  icon: LucideIcon;
  /** the card's own colour: expense red, income green, transfer blue, saving gold */
  bg: string;
  glow: string;
  run: () => void;
}

const BIG: Big[] = [
  { label: tr("Расход"), icon: ArrowUpRight, bg: "radial-gradient(70% 60% at 85% 10%, rgba(255,140,140,0.5), transparent 70%), linear-gradient(145deg, #ff2a2a, #a8000e 62%, #4a0008)", glow: "#fa0717", run: () => nav.sheet("composer", { kind: "expense" }) },
  { label: tr("Доход"), icon: ArrowDownLeft, bg: "radial-gradient(70% 60% at 85% 10%, rgba(255,255,255,0.28), transparent 70%), linear-gradient(145deg, #2eb57f, #0b3a28)", glow: "#3cc896", run: () => nav.sheet("composer", { kind: "income" }) },
  { label: tr("Перевод"), icon: ArrowLeftRight, bg: "radial-gradient(70% 60% at 85% 10%, rgba(255,255,255,0.25), transparent 70%), linear-gradient(145deg, #5a78ff, #1a2566)", glow: "#6f8cff", run: () => nav.sheet("composer", { kind: "transfer" }) },
  {
    label: tr("Отложить в цель"),
    icon: PiggyBank,
    bg: "radial-gradient(70% 60% at 85% 10%, rgba(255,255,255,0.25), transparent 70%), linear-gradient(145deg, #d9a24a, #5a3b10)",
    glow: "#e6b45a",
    run: () => {
      const goals = useData.getState().goals.filter((g) => !g.archived);
      const goal = goals.find((g) => g.primary) ?? goals[0];
      if (goal) nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" });
      else nav.sheet("goal", {});
    }
  }
];

const SMALL: Array<{ label: string; icon: LucideIcon; run: () => void }> = [
  { label: tr("Долг"), icon: HandCoins, run: () => nav.sheet("debt", {}) },
  { label: tr("Дело"), icon: CircleCheckBig, run: () => nav.sheet("quickAdd", {}) }
];

const CHIPS: Array<{ label: string; icon: LucideIcon; run: () => void }> = [
  { label: tr("Ожидаемый доход"), icon: ArrowDownLeft, run: () => nav.sheet("plan", { kind: "income" }) },
  {
    label: tr("Заметка"),
    icon: NotebookPen,
    run: () => {
      nav.planner("notes");
      void import("../notes/Notes").then((m) => m.createNote());
    }
  },
  { label: tr("Цель"), icon: Target, run: () => nav.sheet("goal", {}) }
];

/** The «+» in the tab bar: every kind of record one tap away, each in its own colour. */
export function CreateSheet() {
  const { close } = useSheet();
  const go = (run: () => void) => () => {
    haptic();
    close();
    run();
  };
  return (
    <Sheet title={tr("Создать")} ariaLabel={tr("Создать")}>
      <div className="px-5 pb-3">
        <div className="text-title-3 font-semibold">{tr("Что записать?")}</div>
        <div className="text-footnote text-ink-2">{tr("Каждый тип — своего цвета")}</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {BIG.map((a, i) => (
          <motion.button
            key={a.label}
            type="button"
            aria-label={a.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, delay: 0.03 * i }}
            whileTap={{ scale: 0.96 }}
            onClick={go(a.run)}
            className="relative flex h-[104px] flex-col justify-between overflow-hidden rounded-[22px] p-3.5 text-left text-white"
            style={{ background: a.bg, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 14px 26px -16px ${a.glow}` }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-black/25">
              <a.icon size={19} />
            </span>
            <span className="text-callout font-bold">{a.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 px-4">
        {SMALL.map((a, i) => (
          <motion.button key={a.label} type="button" aria-label={a.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: 0.12 + 0.03 * i }} whileTap={{ scale: 0.96 }} onClick={go(a.run)} className="panel flex h-[84px] flex-col justify-between rounded-[22px] p-3.5 text-left">
            <span className="tile grid h-9 w-9 place-items-center rounded-[12px] text-ink">
              <a.icon size={19} />
            </span>
            <span className="text-callout font-semibold">{a.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 px-4 pb-2">
        {CHIPS.map((a) => (
          <button key={a.label} type="button" aria-label={a.label} onClick={go(a.run)} className="tile flex h-11 items-center justify-center gap-1.5 rounded-[16px] px-2 text-footnote font-semibold active:opacity-70">
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
