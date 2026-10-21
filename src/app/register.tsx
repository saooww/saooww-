import { registerRoutes } from "../nav/StackView";
import { registerSheets } from "../sheets/SheetHost";
import { ConfirmSheet } from "../sheets/ConfirmSheet";
import { PickerSheet } from "../sheets/PickerSheet";
import { CategorySheet } from "../sheets/CategorySheet";
import { RangeSheet } from "../sheets/RangeSheet";
import { HomeScreen } from "../features/home/HomeScreen";
import { ComposerSheet } from "../features/transactions/Composer";
import { TxDetailSheet } from "../features/transactions/TxDetailSheet";
import { TransactionsScreen } from "../features/transactions/TransactionsScreen";
import { WalletsScreen } from "../features/wallets/WalletsScreen";
import { WalletDetail } from "../features/wallets/WalletDetail";
import { WalletSheet } from "../features/wallets/WalletSheet";
import { AnalyticsScreen } from "../features/analytics/AnalyticsScreen";
import { MoreScreen } from "../features/more/MoreScreen";
import { GoalsScreen } from "../features/goals/GoalsScreen";
import { GoalDetail } from "../features/goals/GoalDetail";
import { GoalMoneySheet, GoalSheet } from "../features/goals/GoalSheets";
import { BudgetSheet, BudgetsScreen } from "../features/budgets/Budgets";
import { PlanActionsSheet, PlanSheet, PlansScreen } from "../features/plans/Plans";
import { RecurringSheet, SubscriptionsScreen } from "../features/subscriptions/Subscriptions";
import { DebtDetail, DebtPaySheet, DebtSheet, DebtsScreen } from "../features/debts/Debts";
import { TaskSheet, TasksScreen } from "../features/tasks/Tasks";
import { LinkPickerSheet, NoteEditor, NotesScreen } from "../features/notes/Notes";
import { CategoriesScreen, CurrenciesScreen, DataScreen, SettingsScreen } from "../features/settings/Settings";
import { SearchSheet } from "../features/search/SearchSheet";

registerRoutes({
  roots: {
    home: HomeScreen,
    wallets: WalletsScreen,
    transactions: TransactionsScreen,
    analytics: AnalyticsScreen,
    more: MoreScreen
  },
  routes: {
    wallet: WalletDetail,
    goals: GoalsScreen,
    goal: GoalDetail,
    budgets: BudgetsScreen,
    plans: PlansScreen,
    subscriptions: SubscriptionsScreen,
    debts: DebtsScreen,
    debt: DebtDetail,
    tasks: TasksScreen,
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
  linkPicker: LinkPickerSheet,
  search: SearchSheet
});
