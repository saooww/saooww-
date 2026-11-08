import { create } from "zustand";
import { todayKey, type DayKey } from "../lib/dates";
import type { ID } from "./types";

export type Tab = "home" | "planner" | "wallets" | "transactions" | "analytics" | "more";

export type PlannerView = "today" | "week" | "lists" | "notes";

export type RouteName =
  | "root"
  | "wallet"
  | "goals"
  | "goal"
  | "budgets"
  | "plans"
  | "subscriptions"
  | "debts"
  | "debt"
  | "tasks"
  | "taskList"
  | "project"
  | "notes"
  | "note"
  | "settings"
  | "categories"
  | "currencies"
  | "data";

export interface Route {
  key: string;
  name: RouteName;
  params?: Record<string, unknown>;
}

export interface SheetEntry {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export interface Toast {
  id: string;
  text: string;
  action?: { label: string; run: () => void };
  tone?: "default" | "positive" | "warning";
}

export interface TxFilter {
  query: string;
  kind: "all" | "expense" | "income" | "transfer";
  walletId?: ID;
  categoryId?: ID;
  period: "all" | "month" | "prev" | "30d" | "custom";
  from?: DayKey;
  to?: DayKey;
  sort: "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
}

/** A saved amount flying from the composer into the wallet card */
export interface Flight {
  id: number;
  amount: number;
  currency: string;
  kind: "income" | "expense";
  walletId?: ID;
}

export const DEFAULT_FILTER: TxFilter = { query: "", kind: "all", period: "all", sort: "date-desc" };

interface UIState {
  tab: Tab;
  stacks: Record<Tab, Route[]>;
  /** +1 forward, −1 back — drives screen transitions */
  navDir: 1 | -1;
  /** Increments when the active tab is tapped again (scroll to top / pop to root) */
  retap: Record<Tab, number>;
  sheets: SheetEntry[];
  toasts: Toast[];
  today: DayKey;
  txFilter: TxFilter;
  /** Wallet card currently being shown by the carousel */
  homeCardIndex: number;
  /** Wallet whose card is flying into a detail screen — its source stays hidden */
  heroWalletId: ID | null;
  /** Saved data has been read and the first-launch decision made */
  booted: boolean;
  /** First launch: the welcome flow is showing */
  onboarding: boolean;
  /** App lock screen is up */
  locked: boolean;
  flight: Flight | null;
  /** Month (any day in it) whose summary story is open */
  story: DayKey | null;
  /** Which part of the planner tab is shown */
  plannerView: PlannerView;

  setTab(tab: Tab): void;
  push(name: RouteName, params?: Record<string, unknown>, tab?: Tab): void;
  pop(): void;
  popToRoot(tab?: Tab): void;
  openSheet(type: string, props?: Record<string, unknown>): string;
  closeSheet(id?: string): void;
  toast(text: string, opts?: Omit<Toast, "id" | "text">): void;
  dismissToast(id: string): void;
  setToday(day: DayKey): void;
  setTxFilter(f: Partial<TxFilter>, replace?: boolean): void;
  setHomeCardIndex(i: number): void;
  setHeroWallet(id: ID | null): void;
  setPlannerView(v: PlannerView): void;
}

const root = (): Route => ({ key: "root", name: "root" });
let seq = 0;
const key = () => `r${++seq}`;

export const useUI = create<UIState>()((set, get) => ({
  tab: "home",
  stacks: { home: [root()], planner: [root()], wallets: [root()], transactions: [root()], analytics: [root()], more: [root()] },
  navDir: 1,
  retap: { home: 0, planner: 0, wallets: 0, transactions: 0, analytics: 0, more: 0 },
  sheets: [],
  toasts: [],
  today: todayKey(),
  txFilter: DEFAULT_FILTER,
  homeCardIndex: 0,
  heroWalletId: null,
  booted: false,
  onboarding: false,
  locked: false,
  flight: null,
  story: null,
  plannerView: "today",

  setTab(tab) {
    const s = get();
    if (s.tab === tab) {
      const stack = s.stacks[tab];
      if (stack.length > 1) set({ navDir: -1, stacks: { ...s.stacks, [tab]: [stack[0]] } });
      else set({ retap: { ...s.retap, [tab]: s.retap[tab] + 1 } });
      return;
    }
    set({ tab });
  },

  push(name, params, tab) {
    const s = get();
    const t = tab ?? s.tab;
    set({ tab: t, navDir: 1, stacks: { ...s.stacks, [t]: [...s.stacks[t], { key: key(), name, params }] } });
  },

  pop() {
    const s = get();
    const stack = s.stacks[s.tab];
    if (stack.length <= 1) return;
    set({ navDir: -1, stacks: { ...s.stacks, [s.tab]: stack.slice(0, -1) } });
  },

  popToRoot(tab) {
    const s = get();
    const t = tab ?? s.tab;
    set({ navDir: -1, stacks: { ...s.stacks, [t]: [s.stacks[t][0]] } });
  },

  openSheet(type, props = {}) {
    // A double tap — or Space on a still-focused button while the sheet loads —
    // must not stack the same sheet on top of itself.
    const top = get().sheets[get().sheets.length - 1];
    if (top && top.type === type && JSON.stringify(top.props) === JSON.stringify(props)) return top.id;
    const id = `s${++seq}`;
    set((s) => ({ sheets: [...s.sheets, { id, type, props }] }));
    return id;
  },

  closeSheet(id) {
    set((s) => {
      if (!s.sheets.length) return {};
      const target = id ?? s.sheets[s.sheets.length - 1].id;
      return { sheets: s.sheets.filter((x) => x.id !== target) };
    });
  },

  toast(text, opts = {}) {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts.slice(-1), { id, text, ...opts }] }));
    window.setTimeout(() => get().dismissToast(id), opts.action ? 5200 : 2800);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setToday(day) {
    if (get().today !== day) set({ today: day });
  },

  setTxFilter(f, replace) {
    set((s) => ({ txFilter: replace ? { ...DEFAULT_FILTER, ...f } : { ...s.txFilter, ...f } }));
  },

  setHomeCardIndex(i) {
    set({ homeCardIndex: i });
  },

  setHeroWallet(id) {
    set({ heroWalletId: id });
  },

  setPlannerView(v) {
    set({ plannerView: v });
  }
}));

export const nav = {
  push: (name: RouteName, params?: Record<string, unknown>, tab?: Tab) => useUI.getState().push(name, params, tab),
  pop: () => useUI.getState().pop(),
  tab: (tab: Tab) => useUI.getState().setTab(tab),
  sheet: (type: string, props?: Record<string, unknown>) => useUI.getState().openSheet(type, props),
  close: (id?: string) => useUI.getState().closeSheet(id),
  toast: (text: string, opts?: Omit<Toast, "id" | "text">) => useUI.getState().toast(text, opts),
  fly: (f: Omit<Flight, "id">) => useUI.setState({ flight: { ...f, id: ++seq } }),
  story: (month: DayKey) => useUI.setState({ story: month }),
  /** Opens the planner tab on a given view, back at its first screen */
  planner: (view: PlannerView = "today") => {
    const s = useUI.getState();
    useUI.setState({ plannerView: view, tab: "planner", stacks: { ...s.stacks, planner: [s.stacks.planner[0]] } });
  }
};
