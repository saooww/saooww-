import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, ChevronRight, Share, Sparkles, X, type LucideIcon } from "../../ui/glyphs";
import { addDays, addMonths, diffDays, parseDay, startOfMonth } from "../../lib/dates";
import { isEmbedded, saveBackupFile } from "../../lib/backupFile";
import { haptic } from "../../lib/haptics";
import { safeToSpend } from "../../lib/safeToSpend";
import { homeInsight } from "../../lib/insights";
import { weekToReview } from "../../lib/week";
import { useWeekSummary } from "../planner/WeekReview";
import { hasStory, monthKey, monthSummary } from "../../lib/story";
import { useAppData, useBalances, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { IconChip, ProgressBar, SectionHeader } from "../../ui/primitives";

/** «Можно потратить сегодня» — one honest number for the day. */
export function SafeToSpendCard() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  if (!s) return null;
  // Nothing to count from yet (fresh start, no balances, no spending): a calm hint, not a red alarm.
  const nothingYet = s.allowance <= 0 && s.spentToday === 0 && s.obligations === 0 && Object.values(balances).every((v) => v <= 0);
  if (nothingYet) {
    return (
      <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring.press} onClick={() => nav.tab("wallets")} className="panel mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-[20px] px-4 py-3.5 text-left">
        <IconChip name="WalletCards" size={34} />
        <span className="min-w-0 flex-1">
          <span className="block text-subhead font-semibold text-ink">Можно потратить сегодня</span>
          <span className="block text-footnote text-ink-2">Укажите остатки на счетах — посчитаем сумму на каждый день</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-3" />
      </motion.button>
    );
  }

  const tight = s.allowance <= 0;
  const over = !tight && s.today < 0;
  const progress = s.allowance > 0 ? Math.min(1, s.spentToday / s.allowance) : 1;
  const label = tight ? "До конца месяца впритык" : over ? "Сегодня сверх нормы" : "Можно потратить сегодня";

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      transition={spring.press}
      onClick={() => nav.push("plans")}
      className="panel mx-5 mt-3 block w-[calc(100%-40px)] rounded-[20px] px-4 pb-3.5 pt-3.5 text-left"
      aria-label={`${label}: ${Math.abs(s.today) / 100} ${base}`}
    >
      <div className="flex items-center justify-between">
        <span className="section-label">{label}</span>
        <ChevronRight size={16} className="text-ink-3" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <AnimatedMoney value={tight ? 0 : Math.abs(s.today)} currency={base} variant="hero" privacy tone={over ? "negative" : "default"} className="text-[32px] leading-none" />
        <span className="pb-0.5 text-right text-footnote text-ink-2">
          {s.daysLeft === 1 ? "последний день месяца" : `${s.daysLeft} ${s.daysLeft % 10 === 1 && s.daysLeft !== 11 ? "день" : [2, 3, 4].includes(s.daysLeft % 10) && ![12, 13, 14].includes(s.daysLeft) ? "дня" : "дней"} до конца месяца`}
        </span>
      </div>
      <ProgressBar value={progress} tone={over || tight ? "negative" : progress > 0.85 ? "warning" : "ink"} className="mt-3" height={5} />
      <div className="mt-2 flex justify-between gap-2 text-caption text-ink-3">
        <span>
          потрачено <Money value={s.spentToday} currency={base} privacy className="text-ink-2" />
        </span>
        <span>
          {tight ? "платежи до конца месяца " : "норма на день "}
          <Money value={tight ? s.obligations : s.allowance} currency={base} privacy className="text-ink-2" />
          {s.basis === "budget" && !tight ? " · по бюджету" : ""}
        </span>
      </div>
    </motion.button>
  );
}

type FeedItem = {
  id: string;
  icon: LucideIcon | string;
  tone?: "accent" | "positive" | "warning" | "negative";
  title: string;
  subtitle?: string;
  onOpen?: () => void;
  /** A button of its own, e.g. «Сохранить» */
  action?: { label: string; run: () => void };
  /** × — hide it; the hint knows for how long */
  onDismiss: () => void;
  dismissLabel?: string;
};

/**
 * «Важное» — the reminders and the one useful hint of the day in a single
 * short list instead of separate cards: the month's story in its first
 * days, a nudge to save a copy outside the phone, a budget, debt or
 * payment worth knowing about. Each line can be hidden with ×.
 */
export function HomeFeed() {
  const settings = useData((s) => s.settings);
  const meta = useData((s) => s.meta);
  const txCount = useData((s) => s.transactions.length);
  const update = useData((s) => s.updateSettings);
  const data = useAppData();
  const { entries } = useLedger();
  const categories = useCategoryMap();
  const today = useToday();

  const prevMonth = addMonths(startOfMonth(today), -1, 1);
  const story = useMemo(() => {
    if (parseDay(today).getDate() > 10 || settings.storySeen === monthKey(prevMonth)) return null;
    const s = monthSummary(entries, categories, prevMonth, today);
    return hasStory(s) ? s : null;
  }, [entries, categories, prevMonth, today, settings.storySeen]);

  const backupDue = useMemo(() => {
    if (isEmbedded() || meta.demo || txCount < 3) return false;
    if (settings.backupSnoozeUntil && settings.backupSnoozeUntil > today) return false;
    if (!settings.lastExternalBackup) return diffDays(today, meta.createdAt.slice(0, 10)) >= 2 || txCount >= 15;
    return diffDays(today, settings.lastExternalBackup.slice(0, 10)) >= 7;
  }, [meta, txCount, settings.backupSnoozeUntil, settings.lastExternalBackup, today]);

  const insight = useMemo(() => homeInsight(data, entries, today), [data, entries, today]);
  const reviewFrom = weekToReview(today);
  const week = useWeekSummary(reviewFrom && settings.weekSeen !== reviewFrom ? reviewFrom : null);
  const dismissed = settings.dismissedHints ?? [];

  const items: FeedItem[] = [];
  if (story) {
    items.push({
      id: "story",
      icon: Sparkles,
      tone: "accent",
      title: `Итоги ${story.nameGen} готовы`,
      subtitle: "Куда ушли деньги и что получилось сберечь",
      onOpen: () => {
        haptic();
        update({ storySeen: monthKey(prevMonth) });
        nav.story(prevMonth);
      },
      onDismiss: () => update({ storySeen: monthKey(prevMonth) })
    });
  }
  if (week && !week.empty) {
    items.push({
      id: "week",
      icon: CalendarCheck,
      tone: "accent",
      title: "Итоги недели готовы",
      subtitle: `Деньги и дела за ${week.label}`,
      onOpen: () => {
        haptic();
        nav.sheet("weekReview", { from: week.from });
      },
      onDismiss: () => update({ weekSeen: week.from })
    });
  }
  if (backupDue) {
    items.push({
      id: "backup",
      icon: Share,
      tone: "accent",
      title: "Сохраните копию данных",
      subtitle: settings.lastExternalBackup ? `Последняя — ${diffDays(today, settings.lastExternalBackup.slice(0, 10))} дн. назад` : "В Файлы или iCloud — на случай потери телефона",
      action: {
        label: "Сохранить",
        run: async () => {
          const r = await saveBackupFile();
          if (r === "shared" || r === "downloaded") {
            haptic("success");
            nav.toast("Копия сохранена", { tone: "positive" });
          } else if (r === "failed") nav.toast("Не получилось — попробуйте в «Настройки → Данные»", { tone: "warning" });
        }
      },
      onDismiss: () => update({ backupSnoozeUntil: addDays(today, 3) }),
      dismissLabel: "Напомнить через 3 дня"
    });
  }
  // a hint hidden with × stays hidden for today; the same situation can come back tomorrow
  const hintKey = insight ? `${today}:${insight.id}` : "";
  if (insight && !dismissed.includes(hintKey)) {
    items.push({
      id: insight.id,
      icon: insight.icon,
      tone: insight.tone === "neutral" ? undefined : insight.tone,
      title: insight.text,
      onOpen: insight.action
        ? () => {
            const { tab, route, params } = insight.action!;
            if (route) nav.push(route, params);
            else nav.tab(tab);
          }
        : undefined,
      onDismiss: () => update({ dismissedHints: [...dismissed.filter((k) => k.startsWith(today)), hintKey].slice(-8) }),
      dismissLabel: "Скрыть на сегодня"
    });
  }

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div key="feed" className="mt-8" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
          <SectionHeader title="Важное" />
          <div className="panel mx-4 overflow-hidden rounded-lg">
            <AnimatePresence initial={false}>
              {items.map((it, i) => (
                <motion.div key={it.id} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                  {i > 0 && <div className="ml-[62px] h-px bg-line" />}
                  <FeedRow item={it} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const Icon = typeof item.icon === "string" ? undefined : item.icon;
  const body = (
    <>
      <IconChip icon={Icon} name={typeof item.icon === "string" ? item.icon : undefined} tone={item.tone} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block text-subhead font-medium leading-[19px] text-ink">{item.title}</span>
        {item.subtitle && <span className="mt-0.5 block text-caption text-ink-2">{item.subtitle}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-1 py-1 pl-4 pr-1.5">
      {item.onOpen ? (
        <button type="button" onClick={item.onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left active:opacity-70">
          {body}
          {!item.action && <ChevronRight size={16} className="shrink-0 text-ink-3" />}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 py-2">{body}</div>
      )}
      {item.action && (
        <button type="button" onClick={item.action.run} className="tile ml-2 h-9 shrink-0 rounded-full px-3.5 text-footnote font-semibold text-ink">
          {item.action.label}
        </button>
      )}
      <button type="button" aria-label={item.dismissLabel ?? "Скрыть"} onClick={item.onDismiss} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-press">
        <X size={16} />
      </button>
    </div>
  );
}
