import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Share, Sparkles, X } from "lucide-react";
import { addDays, addMonths, diffDays, parseDay, startOfMonth } from "../../lib/dates";
import { isEmbedded, saveBackupFile } from "../../lib/backupFile";
import { haptic } from "../../lib/haptics";
import { safeToSpend } from "../../lib/safeToSpend";
import { hasStory, monthKey, monthSummary } from "../../lib/story";
import { useAppData, useBalances, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { IconChip, ProgressBar } from "../../ui/primitives";

/** «Можно потратить сегодня» — one honest number for the day. */
export function SafeToSpendCard() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const s = useMemo(() => safeToSpend(data, balances, entries, today), [data, balances, entries, today]);
  if (!s) return null;

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
        <span className="label-caps">{label}</span>
        <ChevronRight size={16} className="text-ink-3" />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <AnimatedMoney value={tight ? 0 : Math.abs(s.today)} currency={base} variant="hero" privacy tone={over ? "negative" : "default"} className="text-[32px] leading-none" />
        <span className="pb-0.5 text-right text-footnote text-ink-2">
          {s.daysLeft === 1 ? "последний день месяца" : `${s.daysLeft} ${s.daysLeft % 10 === 1 && s.daysLeft !== 11 ? "день" : [2, 3, 4].includes(s.daysLeft % 10) && ![12, 13, 14].includes(s.daysLeft) ? "дня" : "дней"} до конца месяца`}
        </span>
      </div>
      <ProgressBar value={progress} tone={over || tight ? "negative" : progress > 0.85 ? "warning" : "accent"} className="mt-3" height={5} />
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

/**
 * At most one gentle reminder: the monthly story in the first days of a
 * month, otherwise a nudge to save a copy outside the phone once a week.
 */
export function HomeReminder() {
  const settings = useData((s) => s.settings);
  const meta = useData((s) => s.meta);
  const txCount = useData((s) => s.transactions.length);
  const update = useData((s) => s.updateSettings);
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

  const kind = story ? "story" : backupDue ? "backup" : null;

  return (
    <AnimatePresence initial={false}>
      {kind === "story" && story && (
        <motion.div key="story" className="mx-5 mt-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
          <div
            className="relative overflow-hidden rounded-[20px] text-white"
            style={{ background: "radial-gradient(90% 120% at 100% 100%, color-mix(in srgb, var(--accent) 70%, transparent), transparent 70%), linear-gradient(160deg, #26262b, #0b0b0d)", boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.12)" }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-4 text-left"
              onClick={() => {
                haptic();
                update({ storySeen: monthKey(prevMonth) });
                nav.story(prevMonth);
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-white/15">
                <Sparkles size={19} strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-callout font-semibold">Итоги {story.nameGen} готовы</span>
                <span className="block text-footnote text-white/70">Куда ушли деньги и что получилось сберечь</span>
              </span>
            </button>
            <button type="button" aria-label="Скрыть" onClick={() => update({ storySeen: monthKey(prevMonth) })} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-white/60 active:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
      {kind === "backup" && (
        <motion.div key="backup" className="mx-5 mt-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
          <div className="panel flex items-center gap-3 rounded-[18px] py-3 pl-3 pr-2">
            <IconChip icon={Share} tone="accent" size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-subhead font-semibold text-ink">Сохраните копию данных</div>
              <div className="truncate text-caption text-ink-2">
                {settings.lastExternalBackup ? `Последняя — ${diffDays(today, settings.lastExternalBackup.slice(0, 10))} дн. назад` : "В Файлы или iCloud — на случай потери телефона"}
              </div>
            </div>
            <button type="button" onClick={() => update({ backupSnoozeUntil: addDays(today, 3) })} className="h-9 px-2 text-footnote font-medium text-ink-3 active:opacity-60">
              Позже
            </button>
            <button
              type="button"
              onClick={async () => {
                const r = await saveBackupFile();
                if (r === "shared" || r === "downloaded") {
                  haptic("success");
                  nav.toast("Копия сохранена", { tone: "positive" });
                } else if (r === "failed") nav.toast("Не получилось — попробуйте в «Настройки → Данные»", { tone: "warning" });
              }}
              className="tile h-9 rounded-full px-3.5 text-footnote font-semibold text-ink"
            >
              Сохранить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

