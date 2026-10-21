import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, CalendarRange, Plus, Search, SearchX, Shapes, Wallet as WalletIcon, X, ReceiptText, ListFilter } from "lucide-react";
import { addDays, addMonths, dayOf, endOfMonth, formatDate, formatDayHeading, startOfMonth } from "../../lib/dates";
import { toBase } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { pluralN } from "../../lib/dates";
import { useData } from "../../store/store";
import type { Transaction } from "../../store/types";
import { DEFAULT_FILTER, nav, useUI, type TxFilter } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { Button, Chip, EmptyState, IconButton } from "../../ui/primitives";
import { TxRow, usePresentCtx } from "./TxRow";
import { useToday } from "../../store/hooks";

const PAGE = 80;

export function periodBounds(f: TxFilter, today: string): { from?: string; to?: string } {
  switch (f.period) {
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "prev": {
      const from = addMonths(startOfMonth(today), -1, 1);
      return { from, to: endOfMonth(from) };
    }
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "custom":
      return { from: f.from, to: f.to };
    default:
      return {};
  }
}

const PERIOD_LABEL: Record<TxFilter["period"], string> = { all: "Всё время", month: "Этот месяц", prev: "Прошлый месяц", "30d": "30 дней", custom: "Период" };
const KIND_LABEL: Record<TxFilter["kind"], string> = { all: "Все типы", expense: "Расходы", income: "Доходы", transfer: "Переводы" };
const SORT_LABEL: Record<TxFilter["sort"], string> = { "date-desc": "Сначала новые", "date-asc": "Сначала старые", "amount-desc": "Сначала крупные", "amount-asc": "Сначала мелкие" };

export function TransactionsScreen() {
  const filter = useUI((s) => s.txFilter);
  const setFilter = useUI((s) => s.setTxFilter);
  const transactions = useData((s) => s.transactions);
  const wallets = useData((s) => s.wallets);
  const categories = useData((s) => s.categories);
  const settings = useData((s) => s.settings);
  const today = useToday();
  const ctx = usePresentCtx();
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = filter.query.trim().toLowerCase();
    const { from, to } = periodBounds(filter, today);
    const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
    const wName = new Map(wallets.map((w) => [w.id, w.name.toLowerCase()]));
    const digits = q.replace(/[^\d]/g, "");
    const list = transactions.filter((t) => {
      const day = dayOf(t.date);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (filter.kind !== "all" && t.kind !== filter.kind) return false;
      if (filter.walletId && t.walletId !== filter.walletId && t.toWalletId !== filter.walletId) return false;
      if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
      if (q) {
        const hay = [t.note ?? "", t.categoryId ? catName.get(t.categoryId) ?? "" : "", t.walletId ? wName.get(t.walletId) ?? "" : "", t.toWalletId ? wName.get(t.toWalletId) ?? "" : "", t.tags.map((x) => `#${x}`).join(" ")]
          .join(" ")
          .toLowerCase();
        const amountHit = digits.length >= 2 && String(Math.round(t.amount / 100)).includes(digits);
        if (!hay.includes(q) && !amountHit) return false;
      }
      return true;
    });
    const sorters: Record<TxFilter["sort"], (a: Transaction, b: Transaction) => number> = {
      "date-desc": (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
      "date-asc": (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
      "amount-desc": (a, b) => b.amount - a.amount,
      "amount-asc": (a, b) => a.amount - b.amount
    };
    return list.sort(sorters[filter.sort]);
  }, [transactions, filter, categories, wallets, today]);

  const totals = useMemo(() => {
    const cur = new Map(wallets.map((w) => [w.id, w.currency]));
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.kind !== "income" && t.kind !== "expense") continue;
      const v = toBase(t.amount, (t.walletId && cur.get(t.walletId)) || settings.baseCurrency, settings);
      if (v === null) continue;
      if (t.kind === "income") income += v;
      else expense += v;
    }
    return { income, expense };
  }, [filtered, wallets, settings]);

  useEffect(() => setLimit(PAGE), [filter]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setLimit((l) => l + PAGE), { root: scrollRef.current, rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const byDate = filter.sort.startsWith("date");
  const visible = filtered.slice(0, limit);
  const groups = useMemo(() => {
    if (!byDate) return [{ day: "", items: visible }];
    const out: Array<{ day: string; items: Transaction[] }> = [];
    for (const t of visible) {
      const d = dayOf(t.date);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(t);
      else out.push({ day: d, items: [t] });
    }
    return out;
  }, [visible, byDate]);

  const dayNet = (items: Transaction[]) => items.reduce((s, t) => s + (t.kind === "income" ? t.amount : t.kind === "expense" ? -t.amount : 0), 0);

  const active = filter.period !== "all" || filter.kind !== "all" || !!filter.walletId || !!filter.categoryId || filter.sort !== "date-desc";
  const cat = filter.categoryId ? categories.find((c) => c.id === filter.categoryId) : undefined;
  const wal = filter.walletId ? wallets.find((w) => w.id === filter.walletId) : undefined;

  const remove = (t: Transaction) => undoable("Операция удалена", () => useData.getState().deleteTransaction(t.id));

  const pickPeriod = () =>
    nav.sheet("picker", {
      title: "Период",
      value: filter.period,
      options: [
        { value: "all", label: "Всё время" },
        { value: "month", label: "Этот месяц" },
        { value: "prev", label: "Прошлый месяц" },
        { value: "30d", label: "Последние 30 дней" },
        { value: "custom", label: "Выбрать даты…", sub: filter.period === "custom" && filter.from && filter.to ? `${formatDate(filter.from)} – ${formatDate(filter.to)}` : undefined }
      ],
      onSelect: (v: string) => {
        if (v === "custom") nav.sheet("range", { from: filter.from ?? startOfMonth(today), to: filter.to ?? today, onApply: (from: string, to: string) => setFilter({ period: "custom", from, to }) });
        else setFilter({ period: v as TxFilter["period"] });
      }
    });

  return (
    <Screen
      title="Операции"
      large
      scrollRef={scrollRef}
      actions={<IconButton icon={Plus} label="Новая операция" onClick={() => nav.sheet("composer", { kind: "expense" })} />}
    >
      <div className="px-4">
        <label className="flex h-10 items-center gap-2 rounded-sm bg-surface-3 px-3">
          <Search size={17} className="shrink-0 text-ink-3" />
          <input
            value={filter.query}
            onChange={(e) => setFilter({ query: e.target.value })}
            placeholder="Поиск по названию, сумме, тегу"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
          />
          {filter.query && (
            <button type="button" aria-label="Очистить" onClick={() => setFilter({ query: "" })} className="grid h-6 w-6 place-items-center rounded-full bg-ink-4 text-ink-inverse">
              <X size={13} strokeWidth={3} />
            </button>
          )}
        </label>
      </div>

      <div className="scroll-x mt-3 flex gap-2 px-4 pb-1">
        <Chip icon={CalendarRange} selected={filter.period !== "all"} onClick={pickPeriod}>
          {filter.period === "custom" && filter.from && filter.to ? `${formatDate(filter.from)} – ${formatDate(filter.to)}` : PERIOD_LABEL[filter.period]}
        </Chip>
        <Chip
          icon={ListFilter}
          selected={filter.kind !== "all"}
          onClick={() =>
            nav.sheet("picker", {
              title: "Тип операций",
              value: filter.kind,
              options: (["all", "expense", "income", "transfer"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] })),
              onSelect: (v: string) => setFilter({ kind: v as TxFilter["kind"] })
            })
          }
        >
          {KIND_LABEL[filter.kind]}
        </Chip>
        <Chip
          icon={Shapes}
          selected={!!cat}
          onClick={() =>
            nav.sheet("picker", {
              title: "Категория",
              value: filter.categoryId ?? "",
              options: [
                { value: "", label: "Все категории" },
                ...categories.filter((c) => !c.archived || c.id === filter.categoryId).map((c) => ({ value: c.id, label: c.name, iconName: c.icon, sub: c.kind === "income" ? "Доход" : undefined }))
              ],
              onSelect: (v: string) => setFilter({ categoryId: v || undefined })
            })
          }
        >
          {cat?.name ?? "Категория"}
        </Chip>
        <Chip
          icon={WalletIcon}
          selected={!!wal}
          onClick={() =>
            nav.sheet("picker", {
              title: "Кошелёк",
              value: filter.walletId ?? "",
              options: [{ value: "", label: "Все кошельки" }, ...wallets.map((w) => ({ value: w.id, label: w.name, sub: w.archived ? "В архиве" : undefined }))],
              onSelect: (v: string) => setFilter({ walletId: v || undefined })
            })
          }
        >
          {wal?.name ?? "Кошелёк"}
        </Chip>
        <Chip
          icon={ArrowUpDown}
          selected={filter.sort !== "date-desc"}
          onClick={() =>
            nav.sheet("picker", {
              title: "Сортировка",
              value: filter.sort,
              options: (Object.keys(SORT_LABEL) as TxFilter["sort"][]).map((k) => ({ value: k, label: SORT_LABEL[k] })),
              onSelect: (v: string) => setFilter({ sort: v as TxFilter["sort"] })
            })
          }
        >
          {SORT_LABEL[filter.sort]}
        </Chip>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-5 pb-1 pt-3 text-footnote text-ink-2">
          <span>{pluralN(filtered.length, ["операция", "операции", "операций"])}</span>
          <span className="flex gap-3">
            {totals.income > 0 && <Money value={totals.income} sign="always" tone="positive" currency={settings.baseCurrency} />}
            {totals.expense > 0 && <Money value={-totals.expense} currency={settings.baseCurrency} />}
          </span>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Пока нет операций"
          text="Записывайте доходы и расходы — здесь появится вся история с поиском и фильтрами."
          action={<Button size="md" icon={Plus} onClick={() => nav.sheet("composer", { kind: "expense" })}>Добавить операцию</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Ничего не найдено"
          text="Попробуйте изменить запрос или фильтры."
          action={
            active || filter.query ? (
              <Button size="md" variant="secondary" onClick={() => setFilter(DEFAULT_FILTER, true)}>
                Сбросить фильтры
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="pt-1">
          {groups.map((g) => (
            <section key={g.day || "all"} className="mt-3">
              {g.day && (
                <div className="flex items-baseline justify-between px-5 pb-2 pt-1">
                  <span className="text-footnote font-semibold text-ink-2">{formatDayHeading(g.day)}</span>
                  <Money value={dayNet(g.items)} sign="always" currency={settings.baseCurrency} className="text-footnote text-ink-3" />
                </div>
              )}
              <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
                {g.items.map((t) => (
                  <TxRow key={t.id} tx={t} ctx={ctx} onOpen={(x) => { haptic(); nav.sheet("tx", { id: x.id }); }} onDelete={remove} />
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinel} className="h-px" />
          {limit < filtered.length && <div className="py-6 text-center text-footnote text-ink-3">Загружаем…</div>}
        </div>
      )}
    </Screen>
  );
}
