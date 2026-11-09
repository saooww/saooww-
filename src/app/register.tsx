import { lazy, type ComponentType } from "react";
import { registerRoutes } from "../nav/StackView";
import { registerSheets } from "../sheets/SheetHost";
import { ConfirmSheet } from "../sheets/ConfirmSheet";
import { PickerSheet } from "../sheets/PickerSheet";
import { CategorySheet } from "../sheets/CategorySheet";
import { RangeSheet } from "../sheets/RangeSheet";
import { HomeLayoutSheet, HomeScreen } from "../features/home/HomeScreen";
import { ComposerSheet } from "../features/transactions/Composer";
import { PinSheet } from "../features/lock/PinSheet";
// typed into right after a tap — must be there at once, like the composer
import { QuickAddSheet } from "../features/planner/QuickAdd";
// the «+» in the tab bar, typed into at once
import { CreateSheet } from "../features/create/CreateSheet";

/*
 * What the first screen needs — home, the composer, the lock — loads with
 * the app. Every other screen and sheet is its own chunk, fetched on first
 * use or, more often, quietly in the background right after launch.
 */
const loaders = {
  tx: () => import("../features/transactions/TxDetailSheet"),
  transactions: () => import("../features/transactions/TransactionsScreen"),
  wallets: () => import("../features/wallets/WalletsScreen"),
  wallet: () => import("../features/wallets/WalletDetail"),
  walletSheet: () => import("../features/wallets/WalletSheet"),
  analytics: () => import("../features/analytics/AnalyticsScreen"),
  more: () => import("../features/more/MoreScreen"),
  goals: () => import("../features/goals/GoalsScreen"),
  goal: () => import("../features/goals/GoalDetail"),
  goalSheets: () => import("../features/goals/GoalSheets"),
  budgets: () => import("../features/budgets/Budgets"),
  plans: () => import("../features/plans/Plans"),
  subscriptions: () => import("../features/subscriptions/Subscriptions"),
  debts: () => import("../features/debts/Debts"),
  notes: () => import("../features/notes/Notes"),
  planner: () => import("../features/planner/PlannerScreen"),
  task: () => import("../features/planner/TaskSheet"),
  datePicker: () => import("../features/planner/DatePicker"),
  projects: () => import("../features/planner/Projects"),
  rituals: () => import("../features/planner/Rituals"),
  intro: () => import("../features/planner/Intro"),
  week: () => import("../features/planner/WeekReview"),
  day: () => import("../features/home/DaySheet"),
  settings: () => import("../features/settings/Settings"),
  search: () => import("../features/search/SearchSheet"),
  assistant: () => import("../features/assistant/AssistantScreen")
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function named<M>(load: () => Promise<M>, key: keyof M): ComponentType<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(() => load().then((m) => ({ default: m[key] as unknown as ComponentType<any> })));
}

/** Fetch every screen's chunk ahead of time, so the first open is instant too. */
export function prefetchScreens() {
  for (const load of Object.values(loaders)) load().catch(() => {});
}

const L = loaders;
const TransactionsScreen = named(L.transactions, "TransactionsScreen");
const TxDetailSheet = named(L.tx, "TxDetailSheet");
const WalletsScreen = named(L.wallets, "WalletsScreen");
const WalletDetail = named(L.wallet, "WalletDetail");
const WalletSheet = named(L.walletSheet, "WalletSheet");
const AnalyticsScreen = named(L.analytics, "AnalyticsScreen");
const MoreScreen = named(L.more, "MoreScreen");
const GoalsScreen = named(L.goals, "GoalsScreen");
const GoalDetail = named(L.goal, "GoalDetail");
const GoalSheet = named(L.goalSheets, "GoalSheet");
const GoalMoneySheet = named(L.goalSheets, "GoalMoneySheet");
const BudgetsScreen = named(L.budgets, "BudgetsScreen");
const BudgetSheet = named(L.budgets, "BudgetSheet");
const PlansScreen = named(L.plans, "PlansScreen");
const PlanSheet = named(L.plans, "PlanSheet");
const PlanActionsSheet = named(L.plans, "PlanActionsSheet");
const SubscriptionsScreen = named(L.subscriptions, "SubscriptionsScreen");
const RecurringSheet = named(L.subscriptions, "RecurringSheet");
const DebtsScreen = named(L.debts, "DebtsScreen");
const DebtDetail = named(L.debts, "DebtDetail");
const DebtSheet = named(L.debts, "DebtSheet");
const DebtPaySheet = named(L.debts, "DebtPaySheet");
const NotesScreen = named(L.notes, "NotesScreen");
const NoteEditor = named(L.notes, "NoteEditor");
const LinkPickerSheet = named(L.notes, "LinkPickerSheet");
const PlannerScreen = named(L.planner, "PlannerScreen");
const TaskSheet = named(L.task, "TaskSheet");
const DatePickerSheet = named(L.datePicker, "DatePickerSheet");
const ProjectScreen = named(L.projects, "ProjectScreen");
const ProjectSheet = named(L.projects, "ProjectSheet");
const TaskListScreen = named(L.projects, "TaskListScreen");
const PlanDaySheet = named(L.rituals, "PlanDaySheet");
const ReviewDaySheet = named(L.rituals, "ReviewDaySheet");
const PlannerIntroSheet = named(L.intro, "PlannerIntroSheet");
const WeekReviewSheet = named(L.week, "WeekReviewSheet");
const DaySheet = named(L.day, "DaySheet");
const SettingsScreen = named(L.settings, "SettingsScreen");
const CategoriesScreen = named(L.settings, "CategoriesScreen");
const CurrenciesScreen = named(L.settings, "CurrenciesScreen");
const DataScreen = named(L.settings, "DataScreen");
const BackupTextSheet = named(L.settings, "BackupTextSheet");
const SearchSheet = named(L.search, "SearchSheet");
const AssistantScreen = named(L.assistant, "AssistantScreen");

registerRoutes({
  roots: {
    home: HomeScreen,
    planner: PlannerScreen,
    wallets: WalletsScreen,
    transactions: TransactionsScreen,
    analytics: AnalyticsScreen,
    more: MoreScreen
  },
  routes: {
    assistant: AssistantScreen,
    wallet: WalletDetail,
    goals: GoalsScreen,
    goal: GoalDetail,
    budgets: BudgetsScreen,
    plans: PlansScreen,
    subscriptions: SubscriptionsScreen,
    debts: DebtsScreen,
    debt: DebtDetail,
    tasks: TaskListScreen,
    taskList: TaskListScreen,
    project: ProjectScreen,
    notes: NotesScreen,
    note: NoteEditor,
    settings: SettingsScreen,
    categories: CategoriesScreen,
    currencies: CurrenciesScreen,
    data: DataScreen
  }
});

registerSheets({
  confirm: ConfirmSheet,
  picker: PickerSheet,
  category: CategorySheet,
  range: RangeSheet,
  composer: ComposerSheet,
  tx: TxDetailSheet,
  wallet: WalletSheet,
  goal: GoalSheet,
  goalMoney: GoalMoneySheet,
  budget: BudgetSheet,
  plan: PlanSheet,
  planActions: PlanActionsSheet,
  recurring: RecurringSheet,
  debt: DebtSheet,
  debtPay: DebtPaySheet,
  task: TaskSheet,
  quickAdd: QuickAddSheet,
  pickDate: DatePickerSheet,
  project: ProjectSheet,
  planDay: PlanDaySheet,
  reviewDay: ReviewDaySheet,
  plannerIntro: PlannerIntroSheet,
  linkPicker: LinkPickerSheet,
  search: SearchSheet,
  backupText: BackupTextSheet,
  pin: PinSheet,
  homeLayout: HomeLayoutSheet,
  create: CreateSheet,
  day: DaySheet,
  weekReview: WeekReviewSheet
});
