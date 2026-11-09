import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, LayoutGrid, Sparkles, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Group, SectionHeader } from "../../ui/primitives";
import { EventRow, useEvents, type CalEvent } from "../plans/Plans";
import { BalanceHero } from "./BalanceHero";
import { DayBudget } from "./DayBudget";
import { tr } from "../../i18n/i18n";

/**
 * The top of the home screen: the wallet cards as a Wallet-like stack, four
 * quick actions, the daily budget, «Спросить Ardessa» and the coming week of
 * money and tasks together.
 */
export function HomeHero() {
  return (
    <div>
      <BalanceHero />
      <QuickActions />
      <DayBudget />
      <AskEntry />
      <Upcoming />
    </div>
  );
}

const ACTIONS: Array<{ id: string; label: string; icon: LucideIcon; run: () => void; accent?: boolean }> = [
  { id: "expense", label: tr("Расход"), icon: ArrowUpRight, run: () => nav.sheet("composer", { kind: "expense" }), accent: true },
  { id: "income", label: tr("Доход"), icon: ArrowDownLeft, run: () => nav.sheet("composer", { kind: "income" }) },
  { id: "transfer", label: tr("Перевод"), icon: ArrowLeftRight, run: () => nav.sheet("composer", { kind: "transfer" }) },
  { id: "more", label: tr("Ещё"), icon: LayoutGrid, run: () => nav.sheet("create") }
];

/** Four round actions under the cards, as in a banking app. */
function QuickActions() {
  return (
    <div className="mx-4 mt-5 grid grid-cols-4 gap-2">
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
          <span className={cn("grid h-[54px] w-[54px] place-items-center rounded-full", a.accent ? "fill-accent text-[var(--accent-on)]" : "tile text-ink")}>
            <a.icon size={21} />
          </span>
          <span className="text-caption font-medium text-ink-2">{a.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

export const QUESTIONS = [tr("На что ушло больше всего?"), tr("Почему траты выросли?"), tr("Сколько можно отложить?"), tr("Что скоро списать?")];

/** The way into «Спросить Ardessa», with the questions it answers. */
function AskEntry() {
  return (
    <section className="mx-4 mt-4 rounded-[22px] p-4" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), var(--surface))", boxShadow: "inset 0 0 0 0.5px color-mix(in srgb, var(--accent) 30%, transparent)" }}>
      <button type="button" onClick={() => nav.push("assistant", {})} className="flex w-full items-center gap-2.5 text-left">
        <span className="fill-accent grid h-8 w-8 place-items-center rounded-[10px] text-[var(--accent-on)]">
          <Sparkles size={16} />
        </span>
        <span className="flex-1 text-headline font-semibold">{tr("Спросить Ardessa")}</span>
        <span className="text-caption text-ink-3">{tr("по вашим данным")}</span>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUESTIONS.map((q, i) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              haptic();
              nav.push("assistant", { ask: i });
            }}
            className="rounded-full px-3 py-1.5 text-footnote text-ink active:opacity-70"
            style={{ background: "color-mix(in srgb, var(--ink) 8%, transparent)" }}
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}

/** The next seven days: payments, plans, debts and tasks in one list. */
function Upcoming() {
  const today = useToday();
  const tasks = useData((s) => s.tasks);
  const to = addDays(today, 7);
  const events = useEvents(today, to);
  const items = useMemo(() => {
    const money = events.filter((e) => !e.done && e.kind !== "goal");
    const taskEvents: CalEvent[] = tasks
      .filter((t) => !t.done && t.due && t.due >= today && t.due <= to)
      .map((t) => ({ key: `t-${t.id}`, kind: "task", date: t.due!, title: t.time ? `${t.title} · ${t.time}` : t.title, onOpen: () => nav.sheet("task", { editId: t.id }) }));
    return [...money, ...taskEvents].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 6);
  }, [events, tasks, today, to]);
  if (!items.length) return null;
  return (
    <div className="mt-6">
      <SectionHeader title={tr("Скоро · деньги и дела")} action={{ label: tr("Календарь"), onClick: () => nav.push("plans") }} />
      <Group>
        {items.map((e) => (
          <EventRow key={e.key} e={e} />
        ))}
      </Group>
    </div>
  );
}
