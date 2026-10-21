import { useMemo } from "react";
import { buildLedger, computeBalances, goalEnvelopes, netWorth, sumWallets, totalWallets, type LedgerEntry } from "../lib/finance";
import { pickData, useData } from "./store";
import { useUI } from "./ui";
import type { AppData, Category, ID, Wallet } from "./types";

export function useToday() {
  return useUI((s) => s.today);
}

export function useSettings() {
  return useData((s) => s.settings);
}

export function useBalances(): Record<ID, number> {
  const wallets = useData((s) => s.wallets);
  const transactions = useData((s) => s.transactions);
  return useMemo(() => computeBalances(wallets, transactions), [wallets, transactions]);
}

export function useWalletMap(): Map<ID, Wallet> {
  const wallets = useData((s) => s.wallets);
  return useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
}

export function useCategoryMap(): Map<ID, Category> {
  const categories = useData((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

export function useEnvelopes() {
  const transactions = useData((s) => s.transactions);
  return useMemo(() => goalEnvelopes(transactions), [transactions]);
}

/** Snapshot of all data fields; recomputed only when any of them changes. */
export function useAppData(): AppData {
  const s = useData();
  return useMemo(
    () => pickData(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.wallets, s.transactions, s.categories, s.budgets, s.goals, s.recurring, s.plans, s.debts, s.tasks, s.notes, s.favorites, s.settings, s.meta]
  );
}

export function useLedger(): { entries: LedgerEntry[]; skipped: number } {
  const wallets = useData((s) => s.wallets);
  const transactions = useData((s) => s.transactions);
  const settings = useData((s) => s.settings);
  return useMemo(
    () => buildLedger({ wallets, transactions, settings } as AppData),
    [wallets, transactions, settings]
  );
}

export function useTotalBalance() {
  const wallets = useData((s) => s.wallets);
  const settings = useData((s) => s.settings);
  const balances = useBalances();
  return useMemo(() => sumWallets(totalWallets(wallets), balances, settings), [wallets, balances, settings]);
}

export function useNetWorth() {
  const data = useAppData();
  const balances = useBalances();
  const today = useToday();
  return useMemo(() => netWorth(data, balances, today), [data, balances, today]);
}

/** Most used categories first, for quick pickers. */
export function useCategoryUsage(kind: "income" | "expense"): ID[] {
  const transactions = useData((s) => s.transactions);
  const categories = useData((s) => s.categories);
  return useMemo(() => {
    const count = new Map<ID, number>();
    const recent = transactions.slice(0, 400);
    for (const t of recent) {
      if (t.kind !== kind || !t.categoryId) continue;
      count.set(t.categoryId, (count.get(t.categoryId) ?? 0) + 1);
    }
    return categories
      .filter((c) => c.kind === kind && !c.archived)
      .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))
      .map((c) => c.id);
  }, [transactions, categories, kind]);
}
