import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleCheckBig, NotebookPen, Target, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Sheet, useSheet } from "../../ui/Sheet";
import { SmartLine } from "./SmartLine";

type Action = { label: string; icon: LucideIcon; tone: string; run: () => void };

const ACTIONS: Action[] = [
  { label: "Расход", icon: ArrowUpRight, tone: "fill-accent text-[var(--accent-on)]", run: () => nav.sheet("composer", { kind: "expense" }) },
  { label: "Доход", icon: ArrowDownLeft, tone: "bg-positive-soft text-positive", run: () => nav.sheet("composer", { kind: "income" }) },
  { label: "Перевод", icon: ArrowLeftRight, tone: "tile text-ink", run: () => nav.sheet("composer", { kind: "transfer" }) },
  { label: "Дело", icon: CircleCheckBig, tone: "tile text-ink", run: () => nav.sheet("quickAdd", {}) },
  {
    label: "Заметка",
    icon: NotebookPen,
    tone: "tile text-ink",
    run: () => {
      nav.planner("notes");
      void import("../notes/Notes").then((m) => m.createNote());
    }
  },
  { label: "Цель", icon: Target, tone: "tile text-ink", run: () => nav.sheet("goal", {}) }
];

/** The «+» in the tab bar: the smart line on top, and every kind of record one tap away. */
export function CreateSheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Создать" ariaLabel="Создать">
      <div className="px-4">
        <SmartLine onDone={close} />
        <p className="px-2 pt-2 text-caption text-ink-3">Одна строка — и приложение само поймёт: трата, доход, дело или цель.</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2.5 px-4 pb-2">
        {ACTIONS.map((a, i) => (
          <motion.button
            key={a.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.smooth, delay: 0.03 * i }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              haptic();
              close();
              // let this sheet go before the next one comes up
              window.setTimeout(a.run, 120);
            }}
            className="panel flex h-[92px] flex-col items-center justify-center gap-2.5 rounded-[20px]"
          >
            <span className={cn("grid h-10 w-10 place-items-center rounded-[14px]", a.tone)}>
              <a.icon size={20} />
            </span>
            <span className="text-footnote font-semibold text-ink">{a.label}</span>
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}
