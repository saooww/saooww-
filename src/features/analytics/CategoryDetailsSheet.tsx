import { useMemo, useState } from "react";
import { formatDate, pluralN, type DayKey } from "../../lib/dates";
import { categoryExpenseEntries } from "../../lib/finance";
import { tr } from "../../i18n/i18n";
import { useCategoryMap, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { Money } from "../../ui/Money";
import { Button, Group } from "../../ui/primitives";
import { Sheet } from "../../ui/Sheet";
import { TxRow, usePresentCtx } from "../transactions/TxRow";

const PAGE_SIZE = 40;

export function CategoryDetailsSheet({ categoryId, from, to }: { categoryId: string; from: DayKey; to: DayKey }) {
  const { entries } = useLedger();
  const ctx = usePresentCtx();
  const category = useCategoryMap().get(categoryId);
  const today = useToday();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const rows = useMemo(() => categoryExpenseEntries(entries, categoryId, from, to, today).reverse(), [entries, categoryId, from, to, today]);
  const total = rows.reduce((sum, entry) => sum + entry.base, 0);
  const title = category?.name ?? tr("Без категории");
  const last = today < to ? today : to;

  return (
    <Sheet tall title={title}>
      <div className="px-5 pb-4">
        <div className="text-footnote text-ink-2">{formatDate(from, { year: "auto" })} — {formatDate(last, { year: "auto" })}</div>
        <Money value={total} currency={ctx.baseCurrency} variant="hero" privacy className="mt-1 block !whitespace-normal text-[32px] leading-tight" />
        <div className="mt-1 text-footnote text-ink-2">{pluralN(rows.length, ["операция", "операции", "операций"])}</div>
      </div>
      {rows.length ? (
        <Group>
          {rows.slice(0, limit).map(({ tx, base, day }) => {
            const wallet = tx.walletId ? ctx.wallets.get(tx.walletId) : undefined;
            return (
              <div key={tx.id}>
                <TxRow tx={tx} ctx={ctx} onOpen={() => nav.sheet("tx", { id: tx.id })} />
                <div className="flex items-center justify-between gap-2 px-4 pb-2 text-caption text-ink-2">
                  <span>{formatDate(day, { year: "auto" })}</span>
                  {wallet && wallet.currency !== ctx.baseCurrency && <Money value={base} currency={ctx.baseCurrency} privacy tone="muted" />}
                </div>
              </div>
            );
          })}
        </Group>
      ) : (
        <div className="px-5 py-8 text-center text-ink-2">{tr("В этом периоде расходов нет")}</div>
      )}
      {rows.length > limit && (
        <div className="px-4 py-3">
          <Button block variant="secondary" onClick={() => setLimit((count) => count + PAGE_SIZE)}>{tr("Ещё")}</Button>
        </div>
      )}
    </Sheet>
  );
}
