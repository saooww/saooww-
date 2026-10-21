import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { addMonths, diffDays, endOfMonth, monthTitle, pluralN, startOfMonth } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { budgetStates, type BudgetState } from "../../lib/insights";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { useAppData, useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, FormRow, Group, IconButton, ProgressBar, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

const toneOf = (b: BudgetState) => (b.level === "over" ? "negative" : b.level === "near" ? "warning" : "accent");

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

  return (
    <Screen title="Бюджеты" large actions={<IconButton icon={Plus} label="Новый бюджет" onClick={() => nav.sheet("budget")} />}>
      <div className="-mt-2 px-5 pb-4 text-subhead text-ink-2">
        {monthTitle(today)} · осталось {pluralN(daysLeft, ["день", "дня", "дней"])}
      </div>

      {states.length === 0 ? (
        <EmptyState icon={Gauge} title="Бюджетов пока нет" text="Задайте месячный лимит для категории — например, «Продукты — 30 000 ₽». Мы подскажем, когда он будет близок." action={<Button size="md" icon={Plus} onClick={() => nav.sheet("budget")}>Создать бюджет</Button>} />
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {overall && (
            <motion.button type="button" whileTap={{ scale: 0.985 }} onClick={() => nav.sheet("budget", { editId: overall.id })} className="rounded-xl bg-surface p-4 text-left">
              <div className="text-footnote font-medium text-ink-2">Все расходы за месяц</div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <Money value={overall.spent} variant="hero" className="text-title-2 font-semibold" />
                <span className="text-footnote text-ink-2">
                  из <Money value={overall.limit} />
                </span>
              </div>
              <ProgressBar value={overall.progress} tone={toneOf(overall)} height={8} className="mt-3" marker={monthShare} />
              <div className="mt-2.5 text-footnote text-ink-2">
                {overall.remaining >= 0 ? (
                  <>
                    Осталось <span className="font-semibold text-ink">{formatMoney(overall.remaining)}</span> · примерно {formatMoney(Math.floor(overall.remaining / daysLeft / 100) * 100)} в день
                  </>
                ) : (
                  <span className="text-negative">Превышен на {formatMoney(-overall.remaining)}</span>
                )}
              </div>
              {overall.level === "ok" && overall.projected > overall.limit && (
                <div className="mt-1 text-footnote text-warning">При текущем темпе к концу месяца выйдет около {formatMoney(overall.projected)}</div>
              )}
            </motion.button>
          )}
          {items.map((b, i) => {
            const c = b.categoryId ? cats.get(b.categoryId) : undefined;
            return (
              <motion.button
                key={b.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.smooth, delay: i * 0.03 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => nav.sheet("budget", { editId: b.id })}
                className="rounded-lg bg-surface px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <NamedIcon name={c?.icon} size={18} strokeWidth={1.9} className="shrink-0 text-ink-2" />
                  <span className="min-w-0 flex-1 truncate text-body font-medium">{c?.name ?? "Категория"}</span>
                  <span className={cn("text-footnote font-semibold tnum", b.level === "over" ? "text-negative" : b.level === "near" ? "text-warning" : "text-ink-2")}>{Math.round(b.progress * 100)}%</span>
                </div>
                <ProgressBar value={b.progress} tone={toneOf(b)} className="mt-2.5" marker={monthShare} />
                <div className="mt-2 flex justify-between text-footnote text-ink-2">
                  <span>
                    <Money value={b.spent} className="text-ink" /> из <Money value={b.limit} />
                  </span>
                  <span className={b.remaining < 0 ? "text-negative" : ""}>{b.remaining >= 0 ? `осталось ${formatMoney(b.remaining)}` : `+${formatMoney(-b.remaining)}`}</span>
                </div>
              </motion.button>
            );
          })}
          <p className="px-1 pt-1 text-caption text-ink-3">Вертикальная метка — сколько месяца уже прошло. Если полоса правее метки, вы тратите быстрее плана.</p>
        </div>
      )}
    </Screen>
  );
}

export function BudgetSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.budgets.find((b) => b.id === editId) : undefined));
  const budgets = useData((s) => s.budgets);
  const categories = useData((s) => s.categories);
  const today = useToday();
  const { entries } = useLedger();
  const [categoryId, setCategoryId] = useState<string>(existing ? existing.categoryId ?? "__all" : "");
  const [limit, setLimit] = useState(existing ? amountToInput(existing.limit).replace(",", ".") : "");
  const taken = new Set(budgets.filter((b) => b.id !== existing?.id).map((b) => b.categoryId ?? "__all"));
  const options = [{ id: "__all", name: "Все расходы", icon: "Gauge" }, ...categories.filter((c) => c.kind === "expense" && !c.archived)].filter((c) => !taken.has(c.id));

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
      title={existing ? "Бюджет" : "Новый бюджет"}
      left={<SheetAction onClick={close}>Отмена</SheetAction>}
      right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}
    >
      <div className="flex flex-col gap-5 pt-1">
        <Group footer={typical > 0 ? `Обычно вы тратите здесь около ${formatMoney(typical)} в месяц.` : undefined}>
          <FormRow label="Лимит в месяц">
            <input autoFocus inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          {typical > 0 && !limit && (
            <div className="px-4 pb-3">
              <button type="button" onClick={() => setLimit(String(Math.ceil(typical / 100 / 1000) * 1000))} className="text-subhead font-medium text-accent-ink">
                Подставить {formatMoney(Math.ceil(typical / 100 / 1000) * 100_000)}
              </button>
            </div>
          )}
        </Group>
        <Group header="Категория">
          <div className="grid grid-cols-2 gap-1.5 p-2">
            {(existing ? [...options, ...(existing.categoryId ? categories.filter((c) => c.id === existing.categoryId) : [{ id: "__all", name: "Все расходы", icon: "Gauge" }])].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i) : options).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn("flex h-11 items-center gap-2 rounded-md px-3 text-left text-subhead transition-colors", categoryId === c.id ? "bg-ink text-ink-inverse" : "bg-surface-3")}
              >
                <NamedIcon name={c.icon} size={16} strokeWidth={1.9} className="shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </Group>
        {existing && (
          <div className="px-4">
            <Button
              variant="danger"
              block
              onClick={() => {
                undoable("Бюджет удалён", () => useData.getState().deleteBudget(existing.id));
                close();
              }}
            >
              Удалить бюджет
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
