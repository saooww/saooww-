import type { Category, Debt, Goal, ID, Transaction, Wallet } from "../store/types";
import { timeOf } from "./dates";
import type { Minor } from "./money";

export interface TxView {
  icon: string;
  /** Category colour for the icon tile; neutral when absent */
  color?: string;
  title: string;
  subtitle: string;
  time: string;
  /** Signed amount as it should be shown */
  amount: Minor;
  sign: "auto" | "always" | "never";
  tone: "default" | "positive" | "muted";
  currency: string;
}

export interface PresentCtx {
  wallets: Map<ID, Wallet>;
  categories: Map<ID, Category>;
  goals?: Map<ID, Goal>;
  debts?: Map<ID, Debt>;
  baseCurrency: string;
  /** The wallet most operations use — omitted from subtitles to keep rows quiet */
  defaultWalletId?: ID;
}

export const KIND_LABEL: Record<Transaction["kind"], string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  adjustment: "Корректировка",
  debt: "Долг",
  goal: "Цель"
};

export function presentTx(tx: Transaction, ctx: PresentCtx, opts: { time?: boolean; walletId?: ID } = {}): TxView {
  const w = tx.walletId ? ctx.wallets.get(tx.walletId) : undefined;
  const to = tx.toWalletId ? ctx.wallets.get(tx.toWalletId) : undefined;
  const cat = tx.categoryId ? ctx.categories.get(tx.categoryId) : undefined;
  const currency = w?.currency ?? ctx.baseCurrency;
  const clock = opts.time !== false ? timeOf(tx.date) : "";
  const join = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" · ");

  switch (tx.kind) {
    case "income":
    case "expense": {
      const title = tx.note || cat?.name || KIND_LABEL[tx.kind];
      return {
        icon: cat?.icon ?? (tx.kind === "income" ? "HandCoins" : "CircleDashed"),
        color: cat?.color,
        title,
        subtitle: join(tx.note && cat && tx.note !== cat.name ? cat.name : undefined, w && w.id !== ctx.defaultWalletId ? w.name : undefined),
        amount: tx.kind === "income" ? tx.amount : -tx.amount,
        sign: "always",
        tone: tx.kind === "income" ? "positive" : "default",
        currency,
        time: clock
      };
    }
    case "transfer": {
      // Seen from one wallet, a transfer is money out or in.
      if (opts.walletId && opts.walletId === tx.toWalletId) {
        return { icon: "ArrowLeftRight", title: tx.note || "Перевод", subtitle: join(`из «${w?.name ?? "—"}»`), amount: tx.toAmount ?? tx.amount, sign: "always", tone: "default", currency: to?.currency ?? currency, time: clock };
      }
      if (opts.walletId && opts.walletId === tx.walletId) {
        return { icon: "ArrowLeftRight", title: tx.note || "Перевод", subtitle: join(`в «${to?.name ?? "—"}»`), amount: -tx.amount, sign: "always", tone: "default", currency, time: clock };
      }
      return { icon: "ArrowLeftRight", title: tx.note || "Перевод", subtitle: join(`${w?.name ?? "—"} → ${to?.name ?? "—"}`), amount: tx.amount, sign: "never", tone: "muted", currency, time: clock };
    }
    case "adjustment":
      return { icon: "SlidersHorizontal", title: tx.note || "Корректировка баланса", subtitle: join(w?.name), amount: tx.flow === "out" ? -tx.amount : tx.amount, sign: "always", tone: "muted", currency, time: clock };
    case "debt": {
      const d = tx.debtId ? ctx.debts?.get(tx.debtId) : undefined;
      const who = d?.counterparty ?? tx.note ?? "";
      let title: string;
      if (tx.debtRole === "open") title = d?.direction === "i_owe" ? `Долг получен: ${who}` : `Долг выдан: ${who}`;
      else title = d?.direction === "i_owe" ? `Погашение долга: ${who}` : `Возврат долга: ${who}`;
      return { icon: "HandCoins", title, subtitle: join(w?.name ?? "Без кошелька"), amount: tx.flow === "out" ? -tx.amount : tx.amount, sign: tx.walletId ? "always" : "never", tone: "muted", currency, time: clock };
    }
    case "goal": {
      const g = tx.goalId ? ctx.goals?.get(tx.goalId) : undefined;
      const name = g?.name ?? tx.note ?? "Цель";
      return {
        icon: "Target",
        title: tx.flow === "out" ? `В цель «${name}»` : `Из цели «${name}»`,
        subtitle: join(w?.name),
        amount: tx.flow === "out" ? -tx.amount : tx.amount,
        sign: tx.walletId ? "always" : "never",
        tone: "muted",
        currency,
        time: clock
      };
    }
  }
}
