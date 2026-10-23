import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage, kvDel, kvGet, kvSet } from "./storage";
import { nowISO, todayKey, type DayKey } from "../lib/dates";
import { computeBalances, debtInfo } from "../lib/finance";
import { uid } from "../lib/id";
import type { Minor } from "../lib/money";
import { nextAfter } from "../lib/recurrence";
import { CHART_COLORS } from "./catalog";
import { migrateFromV1, V1_KEY } from "./migrate";
import { clearPhotos } from "./photos";
import { createDemoData, createEmptyData, defaultSettings } from "./seed";
import {
  DATA_KEYS,
  type AppData,
  type Budget,
  type Category,
  type Debt,
  type Favorite,
  type Goal,
  type ID,
  type Note,
  type Plan,
  type Recurring,
  type Settings,
  type Task,
  type Transaction,
  type Wallet
} from "./types";

export const STORAGE_KEY = "kapital-v2";

export type TxInput = Omit<Transaction, "id" | "createdAt" | "tags"> & { tags?: string[] };

export interface DataActions {
  // ledger
  addTransaction(input: TxInput): ID;
  updateTransaction(id: ID, patch: Partial<Transaction>): void;
  deleteTransaction(id: ID): void;
  // wallets
  addWallet(input: Omit<Wallet, "id" | "createdAt" | "openingBalance"> & { balance: Minor }): ID;
  updateWallet(id: ID, patch: Partial<Wallet>): void;
  setWalletBalance(id: ID, balance: Minor): void;
  deleteWallet(id: ID): void;
  moveWallet(id: ID, dir: -1 | 1): void;
  // categories
  addCategory(input: Omit<Category, "id" | "color"> & { color?: string }): ID;
  updateCategory(id: ID, patch: Partial<Category>): void;
  removeCategory(id: ID): "deleted" | "archived";
  // budgets
  saveBudget(input: { id?: ID; categoryId: ID | null; limit: Minor }): void;
  deleteBudget(id: ID): void;
  // goals
  addGoal(input: Omit<Goal, "id" | "createdAt">): ID;
  updateGoal(id: ID, patch: Partial<Goal>): void;
  deleteGoal(id: ID): void;
  setPrimaryGoal(id: ID): void;
  moveGoalMoney(goalId: ID, walletId: ID, amount: Minor, direction: "deposit" | "withdraw", date?: string): void;
  // debts
  addDebt(input: Omit<Debt, "id" | "createdAt">, openingWalletId?: ID): ID;
  updateDebt(id: ID, patch: Partial<Debt>): void;
  deleteDebt(id: ID): void;
  payDebt(debtId: ID, amount: Minor, walletId?: ID, date?: string, note?: string): void;
  setDebtClosed(id: ID, closed: boolean): void;
  // recurring
  addRecurring(input: Omit<Recurring, "id" | "createdAt">): ID;
  updateRecurring(id: ID, patch: Partial<Recurring>): void;
  deleteRecurring(id: ID): void;
  processRecurring(today: DayKey): ID[];
  postRecurringNow(id: ID): void;
  skipRecurring(id: ID): void;
  // plans
  addPlan(input: Omit<Plan, "id" | "createdAt" | "status">): ID;
  updatePlan(id: ID, patch: Partial<Plan>): void;
  deletePlan(id: ID): void;
  completePlan(id: ID, opts?: { walletId?: ID; amount?: Minor }): ID | undefined;
  setPlanStatus(id: ID, status: Plan["status"]): void;
  // tasks
  addTask(input: Omit<Task, "id" | "createdAt" | "done">): ID;
  updateTask(id: ID, patch: Partial<Task>): void;
  toggleTask(id: ID): void;
  deleteTask(id: ID): void;
  // notes
  addNote(input?: Partial<Note>): ID;
  updateNote(id: ID, patch: Partial<Note>): void;
  deleteNote(id: ID): void;
  // favorites
  addFavorite(input: Omit<Favorite, "id">): ID;
  deleteFavorite(id: ID): void;
  // settings & data
  updateSettings(patch: Partial<Settings>): void;
  replaceAll(data: AppData): void;
}

export type DataState = AppData & DataActions;

/**
 * Until saved data is read from IndexedDB (asynchronously), the store holds
 * an empty placeholder; boot.ts decides what a first launch looks like.
 */
function initialData(): AppData {
  return createEmptyData();
}

export function pickData(s: AppData): AppData {
  const out = {} as Record<string, unknown>;
  for (const k of DATA_KEYS) out[k] = s[k];
  return out as unknown as AppData;
}

const mapById = <T extends { id: ID }>(arr: T[], id: ID, patch: Partial<T>): T[] => arr.map((x) => (x.id === id ? { ...x, ...patch } : x));

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      /* ---------------- ledger ---------------- */

      addTransaction(input) {
        const now = nowISO();
        const tx: Transaction = { tags: [], ...input, id: uid("t-"), createdAt: now };
        set((s) => ({ transactions: [tx, ...s.transactions], meta: { ...s.meta } }));
        return tx.id;
      },

      updateTransaction(id, patch) {
        set((s) => ({ transactions: mapById(s.transactions, id, { ...patch, updatedAt: nowISO() }) }));
      },

      deleteTransaction(id) {
        set((s) => {
          const tx = s.transactions.find((t) => t.id === id);
          const plans = tx?.planId ? s.plans.map((p) => (p.id === tx.planId ? { ...p, status: "planned" as const, txId: undefined } : p)) : s.plans;
          return { transactions: s.transactions.filter((t) => t.id !== id), plans };
        });
      },

      /* ---------------- wallets ---------------- */

      addWallet({ balance, ...input }) {
        const id = uid("w-");
        const w: Wallet = { ...input, id, openingBalance: balance, createdAt: nowISO() };
        set((s) => ({
          wallets: [...s.wallets, w],
          settings: s.settings.defaultWalletId && s.wallets.some((x) => x.id === s.settings.defaultWalletId) ? s.settings : { ...s.settings, defaultWalletId: id }
        }));
        return id;
      },

      updateWallet(id, patch) {
        set((s) => ({ wallets: mapById(s.wallets, id, patch) }));
      },

      setWalletBalance(id, balance) {
        const s = get();
        const current = computeBalances(s.wallets, s.transactions)[id] ?? 0;
        const delta = balance - current;
        if (!delta) return;
        get().addTransaction({
          kind: "adjustment",
          amount: Math.abs(delta),
          flow: delta > 0 ? "in" : "out",
          walletId: id,
          note: "Корректировка баланса",
          date: nowISO()
        });
      },

      deleteWallet(id) {
        set((s) => {
          const name = s.wallets.find((w) => w.id === id)?.name ?? "кошелёк";
          const transactions: Transaction[] = [];
          for (const t of s.transactions) {
            const touches = t.walletId === id || t.toWalletId === id;
            if (!touches) {
              transactions.push(t);
              continue;
            }
            if (t.kind === "transfer") {
              // Keep the other side's balance intact.
              if (t.walletId === id && t.toWalletId && t.toWalletId !== id) {
                transactions.push({ id: t.id, kind: "adjustment", flow: "in", amount: t.toAmount ?? t.amount, walletId: t.toWalletId, note: `Перевод из «${name}»`, tags: t.tags, date: t.date, createdAt: t.createdAt });
              } else if (t.toWalletId === id && t.walletId && t.walletId !== id) {
                transactions.push({ id: t.id, kind: "adjustment", flow: "out", amount: t.amount, walletId: t.walletId, note: `Перевод в «${name}»`, tags: t.tags, date: t.date, createdAt: t.createdAt });
              }
              continue;
            }
            if (t.kind === "debt" || t.kind === "goal") {
              transactions.push({ ...t, walletId: undefined });
              continue;
            }
            // income / expense / adjustment of this wallet go with it
          }
          const wallets = s.wallets.filter((w) => w.id !== id);
          return {
            wallets,
            transactions,
            recurring: s.recurring.filter((r) => r.walletId !== id && r.toWalletId !== id),
            plans: s.plans.map((p) => (p.walletId === id ? { ...p, walletId: undefined } : p)),
            goals: s.goals.map((g) => (g.walletId === id ? { ...g, walletId: undefined } : g)),
            favorites: s.favorites.map((f) => (f.walletId === id ? { ...f, walletId: undefined } : f)),
            settings: s.settings.defaultWalletId === id ? { ...s.settings, defaultWalletId: wallets.find((w) => !w.archived)?.id } : s.settings
          };
        });
      },

      moveWallet(id, dir) {
        set((s) => {
          const arr = [...s.wallets];
          const i = arr.findIndex((w) => w.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= arr.length) return {};
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return { wallets: arr };
        });
      },

      /* ---------------- categories ---------------- */

      addCategory(input) {
        const id = uid("c-");
        set((s) => ({ categories: [...s.categories, { ...input, id, color: input.color ?? CHART_COLORS[s.categories.length % CHART_COLORS.length] }] }));
        return id;
      },

      updateCategory(id, patch) {
        set((s) => ({ categories: mapById(s.categories, id, patch) }));
      },

      removeCategory(id) {
        const used = get().transactions.some((t) => t.categoryId === id) || get().recurring.some((r) => r.categoryId === id);
        if (used) {
          set((s) => ({ categories: mapById(s.categories, id, { archived: true }), budgets: s.budgets.filter((b) => b.categoryId !== id) }));
          return "archived";
        }
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          budgets: s.budgets.filter((b) => b.categoryId !== id),
          favorites: s.favorites.map((f) => (f.categoryId === id ? { ...f, categoryId: undefined } : f))
        }));
        return "deleted";
      },

      /* ---------------- budgets ---------------- */

      saveBudget({ id, categoryId, limit }) {
        set((s) => {
          const existing = id ? s.budgets.find((b) => b.id === id) : s.budgets.find((b) => b.categoryId === categoryId);
          if (existing) return { budgets: mapById(s.budgets, existing.id, { categoryId, limit }) };
          const b: Budget = { id: uid("b-"), categoryId, limit, createdAt: nowISO() };
          return { budgets: categoryId === null ? [b, ...s.budgets] : [...s.budgets, b] };
        });
      },

      deleteBudget(id) {
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
      },

      /* ---------------- goals ---------------- */

      addGoal(input) {
        const id = uid("g-");
        set((s) => ({ goals: [...s.goals.map((g) => (input.primary ? { ...g, primary: false } : g)), { ...input, id, createdAt: nowISO() }] }));
        return id;
      },

      updateGoal(id, patch) {
        set((s) => ({ goals: mapById(s.goals, id, patch) }));
      },

      deleteGoal(id) {
        // Removing its records returns any set-aside money to the wallets it came from.
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          transactions: s.transactions.filter((t) => !(t.kind === "goal" && t.goalId === id)),
          notes: s.notes.map((n) => ({ ...n, links: n.links.filter((l) => !(l.type === "goal" && l.id === id)) }))
        }));
      },

      setPrimaryGoal(id) {
        set((s) => ({ goals: s.goals.map((g) => ({ ...g, primary: g.id === id ? !g.primary : false })) }));
      },

      moveGoalMoney(goalId, walletId, amount, direction, date) {
        const goal = get().goals.find((g) => g.id === goalId);
        if (!goal || amount <= 0) return;
        if (goal.walletId) {
          // Linked goal: money moves between wallets.
          if (walletId === goal.walletId) return;
          get().addTransaction({
            kind: "transfer",
            amount,
            walletId: direction === "deposit" ? walletId : goal.walletId,
            toWalletId: direction === "deposit" ? goal.walletId : walletId,
            goalId,
            note: goal.name,
            date: date ?? nowISO()
          });
          return;
        }
        get().addTransaction({
          kind: "goal",
          amount,
          walletId,
          goalId,
          flow: direction === "deposit" ? "out" : "in",
          note: goal.name,
          date: date ?? nowISO()
        });
      },

      /* ---------------- debts ---------------- */

      addDebt(input, openingWalletId) {
        const id = uid("d-");
        set((s) => ({ debts: [{ ...input, id, createdAt: nowISO() }, ...s.debts] }));
        if (openingWalletId) {
          get().addTransaction({
            kind: "debt",
            debtId: id,
            debtRole: "open",
            amount: input.amount,
            walletId: openingWalletId,
            flow: input.direction === "i_owe" ? "in" : "out",
            note: input.counterparty,
            date: `${input.date}T${nowISO().slice(11, 16)}`
          });
        }
        return id;
      },

      updateDebt(id, patch) {
        set((s) => ({ debts: mapById(s.debts, id, patch) }));
      },

      deleteDebt(id) {
        set((s) => ({
          debts: s.debts.filter((d) => d.id !== id),
          transactions: s.transactions.filter((t) => t.debtId !== id),
          notes: s.notes.map((n) => ({ ...n, links: n.links.filter((l) => !(l.type === "debt" && l.id === id)) }))
        }));
      },

      payDebt(debtId, amount, walletId, date, note) {
        const s = get();
        const debt = s.debts.find((d) => d.id === debtId);
        if (!debt || amount <= 0) return;
        s.addTransaction({
          kind: "debt",
          debtId,
          debtRole: "payment",
          amount,
          walletId,
          flow: debt.direction === "i_owe" ? "out" : "in",
          note: note || debt.counterparty,
          date: date ?? nowISO()
        });
        const info = debtInfo(debt, get().transactions, todayKey());
        if (info.remaining === 0 && !debt.closedAt) get().updateDebt(debtId, { closedAt: nowISO() });
      },

      setDebtClosed(id, closed) {
        set((s) => ({ debts: mapById(s.debts, id, { closedAt: closed ? nowISO() : undefined }) }));
      },

      /* ---------------- recurring ---------------- */

      addRecurring(input) {
        const id = uid("r-");
        set((s) => ({ recurring: [...s.recurring, { ...input, id, createdAt: nowISO() }] }));
        return id;
      },

      updateRecurring(id, patch) {
        set((s) => ({ recurring: mapById(s.recurring, id, patch) }));
      },

      deleteRecurring(id) {
        set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }));
      },

      processRecurring(today) {
        const created: Transaction[] = [];
        const s = get();
        const walletIds = new Set(s.wallets.map((w) => w.id));
        const recurring = s.recurring.map((r) => {
          if (!r.active || !r.autoPost || r.nextDate > today || !walletIds.has(r.walletId)) return r;
          let d = r.nextDate;
          let guard = 0;
          while (d <= today && guard++ < 36) {
            const date = `${d}T09:00`;
            created.push(
              r.kind === "transfer"
                ? { id: uid("t-"), kind: "transfer", amount: r.amount, walletId: r.walletId, toWalletId: r.toWalletId, note: r.title, recurringId: r.id, tags: [], date, createdAt: nowISO() }
                : { id: uid("t-"), kind: r.kind, amount: r.amount, walletId: r.walletId, categoryId: r.categoryId, note: r.title, recurringId: r.id, tags: [], date, createdAt: nowISO() }
            );
            d = nextAfter(d, r.freq, r.interval, r.anchorDay);
          }
          return { ...r, nextDate: d };
        });
        if (created.length) set({ recurring, transactions: [...created.reverse(), ...s.transactions] });
        return created.map((t) => t.id);
      },

      postRecurringNow(id) {
        const r = get().recurring.find((x) => x.id === id);
        if (!r) return;
        get().addTransaction(
          r.kind === "transfer"
            ? { kind: "transfer", amount: r.amount, walletId: r.walletId, toWalletId: r.toWalletId, note: r.title, recurringId: r.id, date: nowISO() }
            : { kind: r.kind, amount: r.amount, walletId: r.walletId, categoryId: r.categoryId, note: r.title, recurringId: r.id, date: nowISO() }
        );
        get().updateRecurring(id, { nextDate: nextAfter(r.nextDate, r.freq, r.interval, r.anchorDay) });
      },

      skipRecurring(id) {
        const r = get().recurring.find((x) => x.id === id);
        if (!r) return;
        get().updateRecurring(id, { nextDate: nextAfter(r.nextDate, r.freq, r.interval, r.anchorDay) });
      },

      /* ---------------- plans ---------------- */

      addPlan(input) {
        const id = uid("p-");
        set((s) => ({ plans: [...s.plans, { ...input, id, status: "planned", createdAt: nowISO() }] }));
        return id;
      },

      updatePlan(id, patch) {
        set((s) => ({ plans: mapById(s.plans, id, patch) }));
      },

      deletePlan(id) {
        set((s) => ({
          plans: s.plans.filter((p) => p.id !== id),
          transactions: s.transactions.map((t) => (t.planId === id ? { ...t, planId: undefined } : t)),
          notes: s.notes.map((n) => ({ ...n, links: n.links.filter((l) => !(l.type === "plan" && l.id === id)) }))
        }));
      },

      completePlan(id, opts) {
        const s = get();
        const plan = s.plans.find((p) => p.id === id);
        const walletId = opts?.walletId ?? plan?.walletId ?? s.settings.defaultWalletId;
        if (!plan || !walletId) return undefined;
        const txId = s.addTransaction({
          kind: plan.kind,
          amount: opts?.amount ?? plan.amount,
          walletId,
          categoryId: plan.categoryId,
          note: plan.title,
          planId: plan.id,
          date: nowISO()
        });
        get().updatePlan(id, { status: "done", txId });
        return txId;
      },

      setPlanStatus(id, status) {
        set((s) => {
          const plan = s.plans.find((p) => p.id === id);
          if (!plan) return {};
          const removeTx = status === "planned" && plan.txId;
          return {
            plans: mapById(s.plans, id, { status, txId: status === "done" ? plan.txId : undefined }),
            transactions: removeTx ? s.transactions.filter((t) => t.id !== plan.txId) : s.transactions
          };
        });
      },

      /* ---------------- tasks ---------------- */

      addTask(input) {
        const id = uid("k-");
        set((s) => ({ tasks: [{ ...input, id, done: false, createdAt: nowISO() }, ...s.tasks] }));
        return id;
      },

      updateTask(id, patch) {
        set((s) => ({ tasks: mapById(s.tasks, id, patch) }));
      },

      toggleTask(id) {
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return {};
          if (t.done) return { tasks: mapById(s.tasks, id, { done: false, doneAt: undefined }) };
          const tasks = mapById(s.tasks, id, { done: true, doneAt: nowISO() });
          if (t.repeat !== "none") {
            const base = t.due ?? todayKey();
            let next = nextAfter(base, t.repeat, 1);
            if (next < todayKey()) next = nextAfter(todayKey(), t.repeat, 1);
            tasks.unshift({ ...t, id: uid("k-"), due: next, done: false, doneAt: undefined, createdAt: nowISO() });
          }
          return { tasks };
        });
      },

      deleteTask(id) {
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          notes: s.notes.map((n) => ({ ...n, links: n.links.filter((l) => !(l.type === "task" && l.id === id)) }))
        }));
      },

      /* ---------------- notes ---------------- */

      addNote(input) {
        const id = uid("n-");
        const now = nowISO();
        set((s) => ({ notes: [{ title: "", body: "", pinned: false, tags: [], links: [], ...input, id, createdAt: now, updatedAt: now }, ...s.notes] }));
        return id;
      },

      updateNote(id, patch) {
        set((s) => ({ notes: mapById(s.notes, id, { ...patch, updatedAt: nowISO() }) }));
      },

      deleteNote(id) {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      },

      /* ---------------- favorites ---------------- */

      addFavorite(input) {
        const id = uid("f-");
        set((s) => ({ favorites: [...s.favorites, { ...input, id }] }));
        return id;
      },

      deleteFavorite(id) {
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
      },

      /* ---------------- settings & data ---------------- */

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      replaceAll(data) {
        set(pickData(data));
      }
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => appStorage),
      partialize: (s) => pickData(s),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>;
        return {
          ...current,
          ...p,
          settings: { ...defaultSettings(), ...(p.settings ?? current.settings) },
          meta: { ...current.meta, ...(p.meta ?? {}) }
        };
      }
    }
  )
);

/* ------------------------------------------------------------------ */
/*  Import / export / backups                                          */
/* ------------------------------------------------------------------ */

export function exportJSON(): string {
  return JSON.stringify({ app: "kapital", version: 2, exportedAt: nowISO(), data: pickData(useData.getState()) }, null, 2);
}

export function parseImport(text: string): AppData {
  const raw = JSON.parse(text);
  const data = raw && raw.data ? raw.data : raw;
  if (!data || !Array.isArray(data.wallets) || !Array.isArray(data.transactions)) {
    // Maybe a file from the first version of the app
    const migrated = migrateFromV1(text);
    if (migrated) return migrated;
    throw new Error("Файл не похож на резервную копию «Капитала»");
  }
  const base = createEmptyData();
  const out = { ...base } as Record<string, unknown>;
  for (const k of DATA_KEYS) {
    if (k === "settings") out[k] = { ...defaultSettings(), ...(data.settings ?? {}) };
    else if (k === "meta") out[k] = { ...base.meta, ...(data.meta ?? {}), demo: !!data.meta?.demo };
    else out[k] = Array.isArray(data[k]) ? data[k] : (base as unknown as Record<string, unknown>)[k];
  }
  return out as unknown as AppData;
}

const BACKUP_KEY = "kapital-backups";

export interface BackupEntry {
  at: string;
  data: AppData;
}

export async function listBackups(): Promise<BackupEntry[]> {
  try {
    const raw = await kvGet(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as BackupEntry[]) : [];
  } catch {
    return [];
  }
}

/** Keeps one automatic copy per day, the three most recent. */
export async function autoBackup(force = false): Promise<void> {
  try {
    const list = await listBackups();
    const today = todayKey();
    if (!force && list[0] && list[0].at.slice(0, 10) === today) return;
    const at = nowISO();
    const next = [{ at, data: pickData(useData.getState()) }, ...list.filter((b) => b.at !== at && (force || b.at.slice(0, 10) !== today))].slice(0, 3);
    await kvSet(BACKUP_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — backups are best effort */
  }
}

export async function clearBackups(): Promise<void> {
  await kvDel(BACKUP_KEY);
}

/** Erases everything this app keeps on the device: backups, photos, legacy data. */
export async function wipeDevice(): Promise<void> {
  await clearBackups();
  await clearPhotos();
  try {
    localStorage.removeItem(V1_KEY);
  } catch {
    /* ignore */
  }
}

export function freshData(kind: "demo" | "empty"): AppData {
  return kind === "demo" ? createDemoData() : createEmptyData();
}

