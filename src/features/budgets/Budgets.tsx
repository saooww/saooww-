import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Plus, ReceiptText } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addMonths, diffDays, endOfMonth, monthTitle, pluralN, startOfMonth } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { budgetStates, type BudgetState } from "../../lib/insights";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { useAppData, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, FormRow, Group, IconButton, IconChip, ProgressBar, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { tr } from "../../i18n/i18n";

/** Spending noticeably ahead of the calendar: more than 15 points past the share of the month gone. */
const isFast = (b: BudgetState, monthShare: number) => b.level === "ok" && b.progress > monthShare + 0.15 && b.projected > b.limit;
const toneOf = (b: BudgetState, monthShare: number) => (b.level === "over" ? "negative" : b.level === "near" || isFast(b, monthShare) ? "warning" : "ink");

function statusOf(b: BudgetState, monthShare: number, daysLeft: number): { text: string; cls: string } {
  if (b.level === "over") return { text: tr("Превышен на {0}", formatMoney(-b.remaining)), cls: "text-negative" };
  if (b.level === "near") return { text: tr("Почти исчерпан · осталось {0}", formatMoney(b.remaining)), cls: "text-warning" };
  if (isFast(b, monthShare)) return { text: tr("Быстрее плана · к концу месяца ~{0}", formatMoney(Math.round(b.projected / 10_000) * 10_000)), cls: "text-warning" };
  return { text: tr("≈ {0} в день до конца месяца", formatMoney(Math.floor(b.remaining / daysLeft / 100) * 100)), cls: "text-ink-2" };
}

export function BudgetsScreen() {
  const data = useAppData();
  const { entries } = useLedger();
  const today = useToday();
  const cats = useCategoryMap();
  const states = useMemo(() => budgetStates(data, entries, today), [data, entries, today]);
  const overall = states.find((b) => b.categoryId === null);
  const items = states.filter((b) => b.categoryId !== null).sort((a, b) => b.progress - a.progress);
  const daysLeft = diffDays(endOfMonth(today), today) + 1;
  const monthShare = (diffDays(today, startOfMonth(today)) + 1) / (diffDays(endOfMonth(today), startOfMonth(today)) + 1);
  const calm = items.filter((b) => toneOf(b, monthShare) === "ink").length;
  // where money goes this month without a limit — candidates for one
  const unbudgeted = useMemo(() => {
    const has = new Set(states.map((b) => b.categoryId));
    const from = startOfMonth(today);
    const by = new Map<string, number>();
    for (const e of entries) {
      if (e.tx.kind !== "expense" || e.day < from || e.day > today || !e.tx.categoryId || has.has(e.tx.categoryId)) continue;
      by.set(e.tx.categoryId, (by.get(e.tx.categoryId) ?? 0) + e.base);
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [states, entries, today]);

  return (
    <Screen title={tr("Бюджеты")} large actions={<IconButton icon={Plus} label={tr("Новый бюджет")} onClick={() => nav.sheet("budget")} />}>
      <div className="-mt-2 px-5 pb-4 text-subhead text-ink-2">
        {monthTitle(today)}{" "}{tr("· осталось")}{" "}{pluralN(daysLeft, ["день", "дня", "дней"])}
        {items.length > 0 && <>{tr("· в норме")}{" "}{calm}{" "}{tr("из")}{" "}{items.length}</>}
      </div>

      {states.length === 0 ? (
        <EmptyState icon={Gauge} title={tr("Бюджетов пока нет")} text={tr("Задайте месячный лимит для категории — например, «Продукты — 30 000 ₽». Мы подскажем, когда он будет близок.")} action={<Button size="md" icon={Plus} onClick={() => nav.sheet("budget")}>{tr("Создать бюджет")}</Button>} />
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {overall && (
            <motion.button type="button" whileTap={{ scale: 0.985 }} onClick={() => nav.sheet("budget", { editId: overall.id })} className="panel rounded-xl p-4 text-left">
              <div className="text-footnote font-medium text-ink-2">{tr("Все расходы за месяц")}</div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <Money value={overall.spent} variant="hero" className="text-title-2 font-semibold" />
                <span className="text-footnote text-ink-2">{tr("из")}{" "}<Money value={overall.limit} />
                </span>
              </div>
              <ProgressBar value={overall.progress} tone={toneOf(overall, monthShare)} height={8} className="mt-3" marker={monthShare} />
              <div className="mt-2.5 text-footnote text-ink-2">
                {overall.remaining >= 0 ? (
                  <>{tr("Осталось")}{" "}<span className="font-semibold text-ink">{formatMoney(overall.remaining)}</span>{" "}{tr("· примерно")}{" "}{formatMoney(Math.floor(overall.remaining / daysLeft / 100) * 100)}{" "}{tr("в день")}</>
                ) : (
                  <span className="text-negative">{tr("Превышен на")}{" "}{formatMoney(-overall.remaining)}</span>
                )}
              </div>
              {overall.level === "ok" && overall.projected > overall.limit && (
                <div className="mt-1 text-footnote text-warning">{tr("При текущем темпе к концу месяца выйдет около")}{" "}{formatMoney(Math.round(overall.projected / 10_000) * 10_000)}</div>
              )}
            </motion.button>
          )}
          {items.map((b, i) => {
            const c = b.categoryId ? cats.get(b.categoryId) : undefined;
            const st = statusOf(b, monthShare, daysLeft);
            return (
              <motion.button
                key={b.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.smooth, delay: i * 0.03 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => nav.sheet("budget", { editId: b.id })}
                className="panel rounded-lg px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <IconChip name={c?.icon} color={c?.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium">{c?.name ?? tr("Категория")}</div>
                    <div className="text-footnote text-ink-2">
                      <Money value={b.spent} className="text-ink" />{" "}{tr("из")}{" "}<Money value={b.limit} />
                    </div>
                  </div>
                  <span className={cn("text-callout font-semibold tnum", b.level === "over" ? "text-negative" : toneOf(b, monthShare) === "warning" ? "text-warning" : "text-ink-2")}>{Math.round(b.progress * 100)}%</span>
                </div>
                <ProgressBar value={b.progress} tone={toneOf(b, monthShare)} className="mt-3" marker={monthShare} />
                <div className={cn("mt-2 text-footnote", st.cls)}>{st.text}</div>
              </motion.button>
            );
          })}
          {unbudgeted.length > 0 && (
            <div className="mt-3">
              <div className="section-label px-1 pb-2.5">{tr("Без лимита в этом месяце")}</div>
              <Group className="!mx-0">
                {unbudgeted.map(([id, spent]) => {
                  const c = cats.get(id);
                  return (
                    <button key={id} type="button" onClick={() => nav.sheet("budget", { categoryId: id })} className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-press">
                      <IconChip name={c?.icon} color={c?.color} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{c?.name ?? tr("Категория")}</span>
                        <span className="block text-footnote text-ink-2">{tr("потрачено")}{" "}{formatMoney(spent)}</span>
                      </span>
                      <span className="tile flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-footnote font-semibold text-ink">
                        <Plus size={14} strokeWidth={2.4} />{tr("Лимит")}</span>
                    </button>
                  );
                })}
              </Group>
            </div>
          )}
          <p className="px-1 pt-1 text-caption text-ink-3">{tr("Вертикальная метка — сколько месяца уже прошло. Если полоса правее метки, вы тратите быстрее плана.")}</p>
        </div>
      )}
    </Screen>
  );
}

export function BudgetSheet({ editId, categoryId: presetCategory }: { editId?: ID; categoryId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.budgets.find((b) => b.id === editId) : undefined));
  const budgets = useData((s) => s.budgets);
  const categories = useData((s) => s.categories);
  const today = useToday();
  const { entries } = useLedger();
  const [categoryId, setCategoryId] = useState<string>(existing ? existing.categoryId ?? "__all" : presetCategory ?? "");
  const [limit, setLimit] = useState(existing ? amountToInput(existing.limit).replace(",", ".") : "");
  const taken = new Set(budgets.filter((b) => b.id !== existing?.id).map((b) => b.categoryId ?? "__all"));
  const options = [{ id: "__all", name: tr("Все расходы"), icon: "Gauge" }, ...categories.filter((c) => c.kind === "expense" && !c.archived)].filter((c) => !taken.has(c.id));

  const typical = useMemo(() => {
    if (!categoryId) return 0;
    const from = addMonths(startOfMonth(today), -3, 1);
    const to = startOfMonth(today);
    let sum = 0;
    for (const e of entries) {
      if (e.tx.kind !== "expense" || e.day < from || e.day >= to) continue;
      if (categoryId !== "__all" && e.tx.categoryId !== categoryId) continue;
      sum += e.base;
    }
    return Math.round(sum / 3);
  }, [categoryId, entries, today]);

  const amount = parseAmount(limit);
  const valid = !!categoryId && amount > 0;

  const save = () => {
    if (!valid) return;
    useData.getState().saveBudget({ id: existing?.id, categoryId: categoryId === "__all" ? null : categoryId, limit: amount });
    haptic("success");
    close();
  };

  return (
    <Sheet
      title={existing ? tr("Бюджет") : tr("Новый бюджет")}
      left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>}
      right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}
    >
      <div className="flex flex-col gap-5 pt-1">
        <Group footer={typical > 0 ? tr("Обычно вы тратите здесь около {0} в месяц.", formatMoney(typical)) : undefined}>
          <FormRow label={tr("Лимит в месяц")}>
            <input autoFocus inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          {typical > 0 && !limit && (
            <div className="px-4 pb-3">
              <button type="button" onClick={() => setLimit(String(Math.ceil(typical / 100 / 1000) * 1000))} className="text-subhead font-medium text-accent-ink">{tr("Подставить")}{" "}{formatMoney(Math.ceil(typical / 100 / 1000) * 100_000)}
              </button>
            </div>
          )}
        </Group>
        <Group header={tr("Категория")}>
          <div className="grid grid-cols-2 gap-1.5 p-2">
            {(existing ? [...options, ...(existing.categoryId ? categories.filter((c) => c.id === existing.categoryId) : [{ id: "__all", name: tr("Все расходы"), icon: "Gauge" }])].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i) : options).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn("flex h-11 items-center gap-2 rounded-md px-3 text-left text-subhead transition-colors", categoryId === c.id ? "bg-ink text-ink-inverse" : "tile")}
              >
                <NamedIcon name={c.icon} size={16} strokeWidth={1.9} className="shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </Group>
        {existing && (
          <div className="flex flex-col gap-2 px-4">
            <Button
              variant="secondary"
              block
              icon={ReceiptText}
              onClick={() => {
                close();
                useUI.getState().setTxFilter({ kind: "expense", categoryId: existing.categoryId ?? undefined, period: "month" }, true);
                nav.tab("transactions");
              }}
            >{tr("Операции за месяц")}</Button>
            <Button
              variant="danger"
              block
              onClick={() => {
                undoable(tr("Бюджет удалён"), () => useData.getState().deleteBudget(existing.id));
                close();
              }}
            >{tr("Удалить бюджет")}</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
