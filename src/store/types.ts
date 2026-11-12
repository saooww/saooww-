import type { Minor } from "../lib/money";
import type { DayKey, LocalISO } from "../lib/dates";

export type ID = string;

/* ------------------------------------------------------------------ */
/*  Wallets                                                            */
/* ------------------------------------------------------------------ */

export type WalletKind = "card" | "cash" | "savings" | "bank" | "investment" | "other";
/** Blocks of the home screen that can be hidden. */
export type HomeBlock = "cards" | "today" | "feed" | "recent" | "goal";

/** Line-work on a wallet card */
export type CardPattern = "sail" | "waves" | "dots" | "none";

/** Current card colours, then retired ones still found in older data (shown as their nearest current colour). */
export type CardStyle = "ardessa" | "obsidian" | "graphite" | "titanium" | "bordeaux" | "ivory" | "ember" | "midnight" | "forest" | "plum" | "sand";

export interface Wallet {
  id: ID;
  name: string;
  kind: WalletKind;
  currency: string;
  style: CardStyle;
  /** «Свой цвет»: any colour for the card, #rrggbb (overrides style) */
  customColor?: string;
  /** Line-work on the card */
  pattern?: CardPattern;
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
  /** Parts of one receipt split across categories share this id */
  splitId?: ID;
  /** Receipt photos (ids in the photo store) */
  photos?: ID[];
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
  /** The goal's own colour, #rrggbb */
  color?: string;
  /** Former choice of a ring or a jar; goals are now drawn as cards */
  look?: "ring" | "jar";
  /** The task list that goes with the goal (a trip: tickets, hotels, route) */
  projectId?: ID;
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

/** One dated payment of a plan: a salary that comes in pieces (advance on the 8th, the rest on the 16th…). */
export interface PlanPart {
  id: ID;
  date: DayKey;
  amount: Minor;
}

export interface Plan {
  id: ID;
  kind: "income" | "expense";
  title: string;
  /** The whole sum; with `parts` it is always their total */
  amount: Minor;
  /** The first date; with `parts` the earliest of them */
  date: DayKey;
  /** Payments by date. Money received (transactions with this plan's id) covers them oldest first. */
  parts?: PlanPart[];
  /** The sum is a guess until it is known (a salary that is only announced on the 8th) */
  estimate?: boolean;
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

/* ------------------------------------------------------------------ */
/*  Planner                                                            */
/* ------------------------------------------------------------------ */

/** A list of tasks: an area of life («Дом») or a project with an outcome («Ремонт кухни»). */
export interface Project {
  id: ID;
  name: string;
  icon: string;
  color: string;
  note?: string;
  deadline?: DayKey;
  archived?: boolean;
  createdAt: LocalISO;
}

/** A checklist item inside a task or a note */
export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

/** "weekdays" — Monday to Friday */
export type TaskRepeat = "none" | Frequency | "weekdays";

export interface Task {
  id: ID;
  title: string;
  note?: string;
  due?: DayKey;
  /** "HH:mm", only together with a due date */
  time?: string;
  priority: 0 | 1 | 2;
  repeat: TaskRepeat;
  done: boolean;
  doneAt?: LocalISO;
  createdAt: LocalISO;
  /** List the task belongs to. No list and no date — it is in the inbox. */
  projectId?: ID;
  subtasks?: Subtask[];
  /** Picked as one of the main things of this day */
  focus?: DayKey;
  /** The next occurrence a repeating task created when it was completed */
  nextId?: ID;
}

export type LinkType = "goal" | "task" | "plan" | "debt" | "project";

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
  /** Checklist under the text */
  checklist?: Subtask[];
  /** Diary entry of this day */
  journal?: DayKey;
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
  /** Typeface for amounts */
  numberFont: "bold" | "elegant" | "strict" | "wide" | "system";
  dateStyle: "short" | "numeric";
  numberFormat: "ru" | "en";
  kopecks: "auto" | "always" | "never";
  hideAmounts: boolean;
  hideOnLaunch: boolean;
  defaultWalletId?: ID;
  autoBackup: boolean;
  /** Last time a copy was saved outside the device (Files, iCloud, AirDrop…) */
  lastExternalBackup?: LocalISO;
  /** «Remind me later» for the backup reminder */
  backupSnoozeUntil?: DayKey;
  /** App lock: a 4-digit code (salted SHA-256), optionally Face ID / Touch ID */
  lockEnabled: boolean;
  lockPinHash?: string;
  lockSalt?: string;
  /** WebAuthn credential of the device's platform authenticator */
  lockCredentialId?: string;
  /** Lock again after this many minutes in the background (0 — immediately) */
  lockAfter: number;
  /** Fetch Bank of Russia rates once a day */
  autoRates: boolean;
  /** Date the current rates are set for, YYYY-MM-DD */
  ratesDate?: string;
  ratesFetchedAt?: LocalISO;
  /** What opens when the app starts */
  launchAction: "home" | "expense";
  /** «theme» — the colour the chosen theme brings; «custom» — customAccent */
  accent: "ardessa" | "vermilion" | "indigo" | "sakura" | "gold" | "theme" | "custom";
  /** Any accent colour, #rrggbb */
  customAccent?: string;
  /** Theme: a whole palette (src/ui/palettes.ts) */
  palette?: string;
  textSize: "m" | "l" | "xl";
  /** Month (YYYY-MM) whose summary story was already shown */
  storySeen?: string;
  /** Monday of the week whose «Итоги недели» were already looked at */
  weekSeen?: DayKey;
  /** Home blocks the user chose to hide */
  homeHidden?: HomeBlock[];
  /** Home hints dismissed with ×, by id (newest last, a few kept) */
  dismissedHints?: string[];
  /** Planner: the day the morning plan was made */
  dayPlannedOn?: DayKey;
  /** Planner: the day the evening review was done */
  dayReviewedOn?: DayKey;
  /** The planner's introduction has been shown */
  plannerIntroSeen?: boolean;
  /** The move to the Ardessa brand has been applied to these settings */
  ardessa?: boolean;
  /** Version of the look the settings were moved to (5 — bold figures) */
  look?: number;
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
  projects: Project[];
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
  "projects",
  "notes",
  "favorites",
  "settings",
  "meta"
] as const satisfies readonly (keyof AppData)[];
