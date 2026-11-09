import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUp, ArrowUpRight, CircleCheckBig, PiggyBank, Sparkles, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { activeWallets } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { formatMoney } from "../../lib/money";
import { parseSmart, type SmartResult } from "../../lib/smart";
import { nowISO } from "../../lib/dates";
import { useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { tr } from "../../i18n/i18n";

const HINTS = [tr("кофе 300"), tr("зарплата 120 000"), tr("позвонить маме завтра в 18"), tr("отложить 5000 на отпуск"), tr("такси 450 вчера")];

/** What the line understood, as a short label with an icon and tone. */
function describe(r: SmartResult, names: { cat: (id?: string) => string | undefined; goal: (id: string) => string | undefined }): { icon: LucideIcon; tone: string; kind: string; text: string } | null {
  switch (r.kind) {
    case "expense":
      return { icon: ArrowUpRight, tone: "text-accent-ink", kind: tr("Расход"), text: [names.cat(r.categoryId) ?? r.title, formatMoney(r.amount)].filter(Boolean).join(" · ") };
    case "income":
      return { icon: ArrowDownLeft, tone: "text-positive", kind: tr("Доход"), text: [names.cat(r.categoryId) ?? r.title, formatMoney(r.amount)].filter(Boolean).join(" · ") };
    case "goal":
      return { icon: PiggyBank, tone: "text-accent-ink", kind: tr("В цель"), text: `${names.goal(r.goalId)} · ${formatMoney(r.amount)}` };
    case "task":
      return { icon: CircleCheckBig, tone: "text-ink", kind: tr("Дело"), text: [r.task.title, ...r.task.tokens.map((t) => t.label)].filter(Boolean).join(" · ") };
    default:
      return null;
  }
}

/**
 * One line for everything: type a spend, an income, a task or money for a
 * goal — the app works out which, shows it, and saves it on Enter.
 */
export function SmartLine({ autoFocus, onDone, compact, docked }: { autoFocus?: boolean; onDone?: () => void; compact?: boolean; /** Floating above the tab bar: glass, preview on top */ docked?: boolean }) {
  const [text, setText] = useState("");
  const today = useToday();
  const categories = useData((s) => s.categories);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const hint = useMemo(() => HINTS[new Date().getMinutes() % HINTS.length], []);

  const result = useMemo(
    () => parseSmart(text, { today, categories, goals, projects, history: transactions.slice(-400) }),
    [text, today, categories, goals, projects, transactions]
  );
  const label = describe(result, {
    cat: (id) => categories.find((c) => c.id === id)?.name,
    goal: (id) => goals.find((g) => g.id === id)?.name
  });

  const save = () => {
    const st = useData.getState();
    const live = activeWallets(wallets);
    const wallet = live.find((w) => w.id === defaultWalletId) ?? live[0];
    if (result.kind === "empty") return;
    if (result.kind === "task") {
      if (!result.task.title) return;
      const t = result.task;
      undoable(tr("Дело записано"), () => st.addTask({ title: t.title, due: t.due, time: t.due ? t.time : undefined, repeat: t.repeat ?? "none", priority: t.priority ?? 0, projectId: t.projectId }));
    } else if (result.kind === "goal") {
      const goal = goals.find((g) => g.id === result.goalId);
      const from = live.find((w) => w.currency === goal?.currency && w.id !== goal?.walletId);
      if (!goal || !from) {
        nav.toast(tr("Нужен кошелёк в валюте цели"), { tone: "warning" });
        return;
      }
      undoable(tr("Цель пополнена"), () => st.moveGoalMoney(goal.id, from.id, result.amount, "deposit"));
    } else {
      if (!wallet) {
        nav.toast(tr("Сначала добавьте кошелёк"), { tone: "warning" });
        return;
      }
      const r = result;
      undoable(r.kind === "income" ? tr("Доход записан") : tr("Расход записан"), () =>
        st.addTransaction({ kind: r.kind, amount: r.amount, walletId: wallet.id, categoryId: r.categoryId, note: r.title || undefined, date: r.day ? `${r.day}T12:00:00` : nowISO() })
      );
    }
    haptic("success");
    setText("");
    if (docked) (document.activeElement as HTMLElement | null)?.blur();
    onDone?.();
  };

  const ready = label && !(result.kind === "task" && !result.task.title);

  const preview = (
    <AnimatePresence initial={false}>
      {label && (
        <motion.div
          key="preview"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className={cn("flex items-center gap-2 px-2 text-footnote", docked ? "pb-2" : "pt-2.5")}>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--chart-grid)] px-2 py-0.5 font-semibold", label.tone)}>
              <label.icon size={13} />
              {label.kind}
            </span>
            <span className="min-w-0 truncate text-ink-2">{label.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div>
      {docked && preview}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className={cn("flex items-center gap-2 pl-4 pr-1.5", docked ? "glass h-[50px] rounded-[22px]" : "panel rounded-[20px]", !docked && (compact ? "h-12" : "h-14"))}
      >
        <Sparkles size={19} className="shrink-0 text-accent-ink" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocus}
          enterKeyHint="done"
          aria-label={tr("Умная строка: трата, доход, дело или цель")}
          placeholder={tr("Напишите, например «{0}»", hint)}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
        />
        <motion.button
          type="submit"
          aria-label={tr("Записать")}
          disabled={!ready}
          animate={{ scale: ready ? 1 : 0.8, opacity: ready ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fill-accent grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--accent-on)]"
        >
          <ArrowUp size={19} />
        </motion.button>
      </form>
      {!docked && preview}
    </div>
  );
}
