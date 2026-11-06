import { useMemo, useRef } from "react";
import { buildLedger, computeBalances, goalEnvelopes, netWorth, sumWallets, totalWallets, type LedgerEntry } from "../lib/finance";
import { pickData, useData } from "./store";
import { useUI } from "./ui";
import { DATA_KEYS, type AppData, type Category, type ID, type Wallet } from "./types";

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

// The planner's lists change on every keystroke while a task or note is typed;
// money screens don't read them, so they don't wake those screens up.
const MONEY_KEYS = DATA_KEYS.filter((k) => k !== "tasks" && k !== "projects" && k !== "notes");

/**
 * Snapshot of the data for money screens. It changes only when a money
 * field changes (wallets, transactions, settings…); the planner's lists in
 * it may lag behind — read those with their own selectors.
 */
export function useAppData(): AppData {
  const cache = useRef<{ src: unknown[]; out: AppData } | null>(null);
  return useData((s) => {
    const src = MONEY_KEYS.map((k) => s[k]);
    const c = cache.current;
    if (c && src.every((v, i) => v === c.src[i])) return c.out;
    const out = pickData(s);
    cache.current = { src, out };
    return out;
  });
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
