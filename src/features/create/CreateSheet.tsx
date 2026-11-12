import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleCheckBig, HandCoins, NotebookPen, PiggyBank, Target, type LucideIcon } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { spring } from "../../ui/motion";
import { Group, Row } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

interface Big {
  label: string;
  icon: LucideIcon;
  /** the kind's own colour (a token, so the light theme gets its darker twin): expense, income, transfer, saving */
  color: string;
  run: () => void;
}

const BIG: Big[] = [
  { label: tr("Расход"), icon: ArrowUpRight, color: "var(--accent)", run: () => nav.sheet("composer", { kind: "expense" }) },
  { label: tr("Доход"), icon: ArrowDownLeft, color: "var(--positive)", run: () => nav.sheet("composer", { kind: "income" }) },
  { label: tr("Перевод"), icon: ArrowLeftRight, color: "var(--transfer)", run: () => nav.sheet("composer", { kind: "transfer" }) },
  {
    label: tr("Отложить в цель"),
    icon: PiggyBank,
    color: "var(--saving)",
    run: () => {
      const goals = useData.getState().goals.filter((g) => !g.archived);
      const goal = goals.find((g) => g.primary) ?? goals[0];
      if (goal) nav.sheet("goalMoney", { goalId: goal.id, direction: "deposit" });
      else nav.sheet("goal", {});
    }
  }
];

const MORE: Array<{ label: string; icon: LucideIcon; run: () => void }> = [
  { label: tr("Долг"), icon: HandCoins, run: () => nav.sheet("debt", {}) },
  { label: tr("Дело"), icon: CircleCheckBig, run: () => nav.sheet("quickAdd", {}) },
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
            whileTap={{ scale: 0.97 }}
            onClick={go(a.run)}
            className="panel relative flex h-[64px] items-center gap-3 overflow-hidden rounded-[20px] pl-3 pr-2 text-left"
            style={{ "--k": a.color, "--glyph-fill": "currentColor", "--glyph-fill-o": 0.25 } as CSSProperties}
          >
            {/* the kind's colour is only a soft light from the corner and the icon — the card itself stays dark */}
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--k) 15%, transparent), transparent 62%)" }} />
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={{ color: "var(--k)", background: "color-mix(in srgb, var(--k) 14%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--k) 32%, transparent)" }}>
              <a.icon size={19} />
            </span>
            <span className="relative min-w-0 text-[15px] font-semibold leading-[18px] text-ink">{a.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="mt-3.5">
        <Group>
          {MORE.map((a) => (
            <Row key={a.label} icon={a.icon} className="!min-h-[48px] !py-2" title={a.label} chevron onClick={go(a.run)} ariaLabel={a.label} />
          ))}
        </Group>
      </div>
    </Sheet>
  );
}
