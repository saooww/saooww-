import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, ChevronRight, Share, Sparkles, X, type LucideIcon } from "../../ui/glyphs";
import { addDays, addMonths, diffDays, parseDay, startOfMonth } from "../../lib/dates";
import { isEmbedded, saveBackupFile } from "../../lib/backupFile";
import { haptic } from "../../lib/haptics";
import { homeInsight } from "../../lib/insights";
import { weekToReview } from "../../lib/week";
import { useWeekSummary } from "../planner/WeekReview";
import { hasStory, monthKey, monthSummary } from "../../lib/story";
import { useAppData, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { IconChip, SectionHeader } from "../../ui/primitives";
import { tr } from "../../i18n/i18n";

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
      title: tr("Итоги {0} готовы", story.nameGen),
      subtitle: tr("Куда ушли деньги и что получилось сберечь"),
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
      title: tr("Итоги недели готовы"),
      subtitle: tr("Деньги и дела за {0}", week.label),
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
      title: tr("Сохраните копию данных"),
      subtitle: settings.lastExternalBackup ? tr("Последняя — {0} дн. назад", diffDays(today, settings.lastExternalBackup.slice(0, 10))) : tr("В Файлы или iCloud — на случай потери телефона"),
      action: {
        label: tr("Сохранить"),
        run: async () => {
          const r = await saveBackupFile();
          if (r === "shared" || r === "downloaded") {
            haptic("success");
            nav.toast(tr("Копия сохранена"), { tone: "positive" });
          } else if (r === "failed") nav.toast(tr("Не получилось — попробуйте в «Настройки → Данные»"), { tone: "warning" });
        }
      },
      onDismiss: () => update({ backupSnoozeUntil: addDays(today, 3) }),
      dismissLabel: tr("Напомнить через 3 дня")
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
      dismissLabel: tr("Скрыть на сегодня")
    });
  }

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div key="feed" className="mt-8" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
          <SectionHeader title={tr("Важное")} />
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
      <button type="button" aria-label={item.dismissLabel ?? tr("Скрыть")} onClick={item.onDismiss} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-press">
        <X size={16} />
      </button>
    </div>
  );
}
