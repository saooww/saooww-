import { Copy, Pencil, Star, Trash2 } from "lucide-react";
import { formatDayHeading, dayOf, nowISO, timeOf } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { KIND_LABEL, presentTx } from "../../lib/present";
import { freqLabel } from "../../lib/recurrence";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Money } from "../../ui/Money";
import { Group, IconChip, Row } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { usePresentCtx } from "./TxRow";

export function TxDetailSheet({ id }: { id: ID }) {
  const { close } = useSheet();
  const tx = useData((s) => s.transactions.find((t) => t.id === id));
  const ctx = usePresentCtx();
  const recurring = useData((s) => (tx?.recurringId ? s.recurring.find((r) => r.id === tx.recurringId) : undefined));
  const plan = useData((s) => (tx?.planId ? s.plans.find((p) => p.id === tx.planId) : undefined));
  const favorites = useData((s) => s.favorites);

  if (!tx) {
    return (
      <Sheet ariaLabel="Операция">
        <div className="px-6 py-10 text-center text-callout text-ink-2">Операция удалена</div>
      </Sheet>
    );
  }

  const v = presentTx(tx, ctx, { time: false });
  const w = tx.walletId ? ctx.wallets.get(tx.walletId) : undefined;
  const to = tx.toWalletId ? ctx.wallets.get(tx.toWalletId) : undefined;
  const cat = tx.categoryId ? ctx.categories.get(tx.categoryId) : undefined;
  const isFlow = tx.kind === "income" || tx.kind === "expense";
  const alreadyFav = isFlow && favorites.some((f) => f.kind === tx.kind && f.categoryId === tx.categoryId && f.amount === tx.amount && (f.note ?? "") === (tx.note ?? ""));

  const edit = () => {
    close();
    nav.sheet("composer", { editId: tx.id });
  };

  const repeatNow = () => {
    haptic("success");
    undoable("Операция повторена", () =>
      useData.getState().addTransaction({ kind: tx.kind, amount: tx.amount, walletId: tx.walletId, toWalletId: tx.toWalletId, toAmount: tx.toAmount, categoryId: tx.categoryId, note: tx.note, tags: tx.tags, date: nowISO() })
    );
    close();
  };

  const remove = () =>
    confirmDelete({
      title: "Удалить операцию?",
      message: tx.recurringId ? "Регулярный платёж продолжит работать — удалится только эта запись." : "Балансы и аналитика пересчитаются автоматически.",
      onConfirm: () => {
        undoable("Операция удалена", () => useData.getState().deleteTransaction(tx.id));
        close();
      }
    });

  return (
    <Sheet ariaLabel="Операция">
      <div className="flex flex-col items-center px-6 pb-6 pt-2 text-center">
        <IconChip name={v.icon} color={v.color} size={60} />
        <div className="mt-3 text-callout text-ink-2">{KIND_LABEL[tx.kind]}</div>
        <div className="mt-1 max-w-full truncate text-headline font-semibold">{v.title}</div>
        <Money
          value={v.amount}
          currency={v.currency}
          sign={v.sign}
          variant="hero"
          tone={v.tone === "positive" ? "positive" : "default"}
          className="mt-2 text-[36px] font-semibold tracking-[-0.035em]"
        />
      </div>

      <div className="flex flex-col gap-4">
        <Group>
          {isFlow && <Row title="Категория" value={cat?.name ?? "Без категории"} />}
          {tx.kind === "transfer" ? (
            <>
              <Row title="Откуда" value={w?.name ?? "—"} />
              <Row title="Куда" value={to?.name ?? "—"} />
              {tx.toAmount !== undefined && to && <Row title="Зачислено" value={<Money value={tx.toAmount} currency={to.currency} />} />}
            </>
          ) : (
            <Row title="Кошелёк" value={w?.name ?? "Без движения по счёту"} />
          )}
          <Row title="Дата" value={`${formatDayHeading(dayOf(tx.date))}${timeOf(tx.date) ? `, ${timeOf(tx.date)}` : ""}`} />
          {tx.tags.length > 0 && <Row title="Теги" value={tx.tags.map((t) => `#${t}`).join(" ")} />}
          {recurring && (
            <Row
              title="Повтор"
              value={freqLabel(recurring.freq, recurring.interval)}
              chevron
              onClick={() => {
                close();
                nav.push("subscriptions");
              }}
            />
          )}
          {plan && <Row title="По плану" value={plan.title} />}
        </Group>

        <Group>
          {(isFlow || tx.kind === "transfer" || tx.kind === "adjustment") && <Row icon={Pencil} title="Изменить" onClick={edit} />}
          {(isFlow || tx.kind === "transfer") && <Row icon={Copy} title="Повторить сегодня" onClick={repeatNow} />}
          {isFlow && !alreadyFav && (
            <Row
              icon={Star}
              title="В избранное"
              onClick={() => {
                useData.getState().addFavorite({ kind: tx.kind as "income" | "expense", title: tx.note || cat?.name || "Избранное", amount: tx.amount, walletId: tx.walletId, categoryId: tx.categoryId, note: tx.note });
                haptic("success");
                nav.toast("Добавлено в избранное", { tone: "positive" });
              }}
            />
          )}
          <Row icon={Trash2} iconTone="negative" title="Удалить" destructive onClick={remove} />
        </Group>
      </div>
    </Sheet>
  );
}
