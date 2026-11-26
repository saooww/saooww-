import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Pencil, Play, Repeat, TrendingUp } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays, diffDays, formatDate, pluralN, todayKey } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { freqLabel, subscriptionStats } from "../../lib/recurrence";
import { useCategoryMap, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete } from "../../store/undo";
import { Money } from "../../ui/Money";
import { Badge, Button, Group, IconChip, Row } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

/**
 * A subscription on one screen: what it costs, when it renews and how far the cycle is,
 * what it has cost in total and the payments behind that.
 */
export function SubscriptionDetailSheet({ id }: { id: ID }) {
  const { close } = useSheet();
  const r = useData((s) => s.recurring.find((x) => x.id === id));
  const txs = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const cats = useCategoryMap();
  const today = useToday();
  const [all, setAll] = useState(false);
  const stats = useMemo(() => (r ? subscriptionStats(r, txs, today) : null), [r, txs, today]);
  const history = useMemo(() => txs.filter((t) => t.recurringId === id).sort((a, b) => (a.date < b.date ? 1 : -1)), [txs, id]);
  if (!r || !stats) {
    return (
      <Sheet title={tr("Подписка")}>
        <div className="px-6 py-8 text-center text-callout text-ink-2">{tr("Эта подписка удалена.")}</div>
      </Sheet>
    );
  }
  const w = wallets.find((x) => x.id === r.walletId);
  const cur = w?.currency ?? base;
  const cat = r.categoryId ? cats.get(r.categoryId) : undefined;
  const overdue = stats.daysLeft < 0;
  const left = overdue ? tr("Платёж просрочен на {0}", pluralN(-stats.daysLeft, ["день", "дня", "дней"])) : stats.daysLeft === 0 ? tr("Продлится сегодня") : tr("Продлится через {0}", pluralN(stats.daysLeft, ["день", "дня", "дней"]));
  const shown = all ? history : history.slice(0, 4);
  const edit = () => nav.sheet("recurring", { editId: r.id });

  return (
    <Sheet tall title={tr("Подписка")} right={<button type="button" onClick={edit} aria-label={tr("Изменить")} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 active:bg-surface-press"><Pencil size={18} /></button>}>
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-col items-center px-5 pt-1 text-center">
          <IconChip name={cat?.icon ?? "Repeat"} icon={cat ? undefined : Repeat} size={56} />
          <div className="mt-3 text-title-3 font-semibold">{r.title}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Money value={r.amount} currency={cur} variant="hero" privacy className="text-[30px] leading-none" />
            <span className="text-subhead text-ink-2">{freqLabel(r.freq, r.interval).toLowerCase()}</span>
          </div>
        </div>

        <section className="tile-pastel mx-4 rounded-[22px] p-4" style={{ ["--tp" as string]: overdue ? "var(--pastel-peach)" : r.active ? "var(--pastel-mint)" : "var(--pastel-butter)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-callout font-semibold">{r.active ? left : tr("На паузе")}</div>
            <Badge tone={r.active ? (overdue ? "negative" : "positive") : "warning"}>{r.active ? (overdue ? tr("Просрочена") : tr("Активна")) : tr("Пауза")}</Badge>
          </div>
          <div className="relative mt-3 h-[8px] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pastel-ink)_14%,transparent)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress * 100)}>
            <motion.div className="h-full origin-left rounded-full" style={{ background: overdue ? "var(--negative)" : "var(--positive)" }} initial={{ scaleX: 0 }} animate={{ scaleX: r.active ? stats.progress : 0 }} transition={{ type: "spring", stiffness: 140, damping: 26 }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-caption text-ink-2">
            <span>{stats.lastPaid ? tr("Последний платёж {0}", formatDate(stats.lastPaid, { year: "auto" })) : tr("Платежей ещё не было")}</span>
            <span className="num">{tr("День {0} из {1}", Math.min(stats.cycleDays, Math.max(0, stats.cycleDays - stats.daysLeft)), stats.cycleDays)}</span>
          </div>
          <div className="mt-1 text-caption text-ink-2">{tr("Следующий платёж: {0}", formatDate(stats.next, { year: "auto" }))}</div>
        </section>

        <section className="panel mx-4 flex items-center gap-3 rounded-[22px] px-4 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-negative" style={{ background: "color-mix(in srgb, var(--negative) 14%, transparent)" }}>
            <TrendingUp size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-callout font-medium">{tr("Потрачено всего")}</div>
            <div className="truncate text-footnote text-ink-2">{stats.since ? tr("с {0} · {1}", formatDate(stats.since, { year: "auto" }), pluralN(stats.payments, ["платёж", "платежа", "платежей"])) : tr("пока ничего")}</div>
          </div>
          <Money value={stats.totalPaid} currency={cur} privacy className="text-callout font-semibold" />
        </section>

        <Group header={tr("История платежей")}>
          {history.length === 0 ? (
            <div className="px-4 py-3.5 text-subhead text-ink-3">{tr("Первый платёж запишется в день списания")}</div>
          ) : (
            shown.map((t) => <Row key={t.id} title={formatDate(t.date.slice(0, 10), { year: "auto" })} subtitle={wallets.find((x) => x.id === t.walletId)?.name} value={<Money value={-t.amount} currency={cur} sign="always" privacy className="text-ink" />} onClick={() => nav.sheet("tx", { id: t.id })} chevron />)
          )}
        </Group>
        {history.length > 4 && (
          <div className="px-4">
            <Button variant="secondary" size="md" block onClick={() => setAll((v) => !v)}>{all ? tr("Свернуть") : tr("Показать все: {0}", history.length)}</Button>
          </div>
        )}

        <Group>
          <Row title={tr("Категория")} value={cat?.name ?? tr("Без категории")} />
          <Row title={tr("Счёт")} value={w?.name ?? "—"} />
        </Group>

        <div className="grid grid-cols-2 gap-2.5 px-4">
          <Button variant="secondary" size="md" icon={r.active ? Pause : Play} onClick={() => { haptic(); useData.getState().updateRecurring(r.id, { active: !r.active, nextDate: r.active ? r.nextDate : r.nextDate < todayKey() ? todayKey() : r.nextDate }); }}>
            {r.active ? tr("Пауза") : tr("Возобновить")}
          </Button>
          <Button variant="secondary" size="md" className={cn("text-negative")} onClick={() => confirmDelete({ title: tr("Удалить «{0}»?", r.title), message: tr("Записанные платежи останутся в истории операций."), onConfirm: () => { useData.getState().deleteRecurring(r.id); close(); } })}>
            {tr("Удалить")}
          </Button>
        </div>
        <div className="px-6 pb-2 text-center text-caption text-ink-3">{diffDays(addDays(stats.next, 0), today) < 0 ? "" : tr("Платёж записывается сам в день списания, когда вы открываете приложение.")}</div>
      </div>
    </Sheet>
  );
}
