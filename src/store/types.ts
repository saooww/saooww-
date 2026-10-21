import type { Minor } from "../lib/money";
import type { DayKey, LocalISO } from "../lib/dates";

export type ID = string;

/* ------------------------------------------------------------------ */
/*  Wallets                                                            */
/* ------------------------------------------------------------------ */

export type WalletKind = "card" | "cash" | "savings" | "bank" | "investment" | "other";
export type CardStyle = "graphite" | "ember" | "titanium" | "midnight" | "forest" | "plum" | "sand" | "ivory";

export interface Wallet {
  id: ID;
  name: string;
  kind: WalletKind;
  currency: string;
  style: CardStyle;
  /** Short visible identifier, e.g. last four digits */
  ident?: string;
  /** Balance before the first recorded operation */
  openingBalance: Minor;
  /** Counted in the total balance and net worth */
  includeInTotal: boolean;
  archived?: boolean;
  createdAt: LocalISO;
}

/* ------------------------------------------------------------------ */
/*  Ledger                                                             */
/* ------------------------------------------------------------------ */

/**
 * income / expense — real money in/out, counted in analytics
 * transfer         — between own wallets, never income or expense
 * adjustment       — manual balance correction
 * debt             — lending/borrowing flows, linked to a Debt
 * goal             — moving money into / out of a goal's own balance
 */
export type TxKind = "income" | "expense" | "transfer" | "adjustment" | "debt" | "goal";

export interface Transaction {
  id: ID;
  kind: TxKind;
  /** Always positive. Direction is given by kind / flow. */
  amount: Minor;
  /** Wallet affected. Optional for debt/goal records that moved no money. */
  walletId?: ID;
  /** Transfer destination */
  toWalletId?: ID;
  /** Amount credited to the destination when currencies differ */
  toAmount?: Minor;
  categoryId?: ID;
  date: LocalISO;
  note?: string;
  tags: string[];
  /** For adjustment / debt / goal: direction from the wallet's point of view */
  flow?: "in" | "out";
  debtId?: ID;
  debtRole?: "open" | "payment";
  goalId?: ID;
  recurringId?: ID;
  planId?: ID;
  createdAt: LocalISO;
  updatedAt?: LocalISO;
}

export interface Category {
  id: ID;
  kind: "income" | "expense";
  name: string;
  icon: string;
  color: string;
  archived?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Planning                                                           */
/* ------------------------------------------------------------------ */

export interface Budget {
  id: ID;
  /** null = overall monthly spending budget */
  categoryId: ID | null;
  limit: Minor;
  createdAt: LocalISO;
}

export interface Goal {
  id: ID;
  name: string;
  icon: string;
  target: Minor;
  currency: string;
  deadline?: DayKey;
  /** Linked mode: progress follows this wallet's balance */
  walletId?: ID;
  primary?: boolean;
  archived?: boolean;
  createdAt: LocalISO;
}

export type Frequency = "day" | "week" | "month" | "year";

export interface Recurring {
  id: ID;
  kind: "income" | "expense" | "transfer";
  title: string;
  amount: Minor;
  walletId: ID;
  toWalletId?: ID;
  categoryId?: ID;
  note?: string;
  freq: Frequency;
  interval: number;
  /** Day of month the series is anchored to (monthly / yearly) */
  anchorDay: number;
  nextDate: DayKey;
  /** Record automatically on the due date */
  autoPost: boolean;
  isSubscription: boolean;
  /** Self-reported usage, only used to flag subscriptions worth reviewing */
  usage?: "often" | "rarely" | "never";
  active: boolean;
  createdAt: LocalISO;
}

export interface Plan {
  id: ID;
  kind: "income" | "expense";
  title: string;
  amount: Minor;
  date: DayKey;
  walletId?: ID;
  categoryId?: ID;
  note?: string;
  status: "planned" | "done" | "skipped";
  txId?: ID;
  createdAt: LocalISO;
}

export interface Debt {
  id: ID;
  direction: "i_owe" | "owed_to_me";
  counterparty: string;
  amount: Minor;
  currency: string;
  date: DayKey;
  dueDate?: DayKey;
  note?: string;
  closedAt?: LocalISO;
  createdAt: LocalISO;
}

export interface Task {
  id: ID;
  title: string;
  note?: string;
  due?: DayKey;
  priority: 0 | 1 | 2;
  repeat: "none" | Frequency;
  done: boolean;
  doneAt?: LocalISO;
  createdAt: LocalISO;
}

export type LinkType = "goal" | "task" | "plan" | "debt";

export interface EntityLink {
  type: LinkType;
  id: ID;
}

export interface Note {
  id: ID;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  links: EntityLink[];
  createdAt: LocalISO;
  updatedAt: LocalISO;
}

export interface Favorite {
  id: ID;
  kind: "income" | "expense";
  title: string;
  amount?: Minor;
  walletId?: ID;
  categoryId?: ID;
  note?: string;
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export interface Settings {
  name: string;
  baseCurrency: string;
  /** Units of base currency for one unit of the given currency */
  rates: Record<string, number>;
  theme: "dark" | "light" | "system";
  animations: boolean;
  haptics: boolean;
  dateStyle: "short" | "numeric";
  numberFormat: "ru" | "en";
  kopecks: "auto" | "always" | "never";
  hideAmounts: boolean;
  hideOnLaunch: boolean;
  defaultWalletId?: ID;
  autoBackup: boolean;
}

export interface AppData {
  wallets: Wallet[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  plans: Plan[];
  debts: Debt[];
  tasks: Task[];
  notes: Note[];
  favorites: Favorite[];
  settings: Settings;
  meta: { demo: boolean; createdAt: LocalISO; importedFromV1?: boolean };
}

export const DATA_KEYS = [
  "wallets",
  "transactions",
  "categories",
  "budgets",
  "goals",
  "recurring",
  "plans",
  "debts",
  "tasks",
  "notes",
  "favorites",
  "settings",
  "meta"
] as const satisfies readonly (keyof AppData)[];
