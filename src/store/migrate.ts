import { nowISO, toLocalISO } from "../lib/dates";
import { computeBalances } from "../lib/finance";
import { uid } from "../lib/id";
import { CHART_COLORS, defaultCategories } from "./catalog";
import { defaultSettings } from "./seed";
import type { AppData, CardStyle, Category, Debt, Goal, Transaction, Wallet, WalletKind } from "./types";

/**
 * Imports data saved by the first version of the app (localStorage key
 * "finance-data-v1"). Amounts there are whole roubles; wallet balances are
 * taken as they were and history is attached without changing them.
 */
export const V1_KEY = "finance-data-v1";

const NAME_MAP: Record<string, string> = {
  "еда": "c-groceries",
  "продукты": "c-groceries",
  "кафе": "c-cafe",
  "транспорт": "c-transport",
  "такси": "c-taxi",
  "покупки": "c-shopping",
  "подписки": "c-subs",
  "развлечения": "c-fun",
  "здоровье": "c-health",
  "жкх": "c-home",
  "зарплата": "i-salary",
  "подработка": "i-freelance",
  "дивиденды": "i-invest",
  "продажа": "i-sale"
};

const KIND_BY_ICON: Record<string, WalletKind> = {
  CreditCard: "card",
  Banknote: "cash",
  PiggyBank: "savings",
  Landmark: "bank",
  Gem: "investment"
};

const STYLES: CardStyle[] = ["graphite", "ember", "titanium", "midnight", "forest", "plum", "sand"];

interface V1 {
  wallets?: Array<{ id: string; name: string; icon?: string; balance: number }>;
  transactions?: Array<{ id?: string; type: "income" | "expense"; amount: number; walletId: string; category?: string; description?: string; tags?: string[]; date: string }>;
  debts?: Array<{ direction: "owed_to_me" | "i_owe"; person: string; amount: number; paidAmount?: number; dueDate?: string; description?: string; status?: string; history?: Array<{ amount: number; date: string }> }>;
  goals?: Array<{ name: string; targetAmount: number; savedAmount?: number; deadline?: string }>;
  incomeCats?: string[];
  expenseCats?: string[];
  isDark?: boolean;
}

const toLocal = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? nowISO() : toLocalISO(d);
};

export function migrateFromV1(raw: string): AppData | null {
  let p: V1;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!p || !Array.isArray(p.wallets)) return null;

  const now = nowISO();
  const categories: Category[] = defaultCategories();
  const byName = new Map<string, Category>();
  for (const c of categories) byName.set(`${c.kind}:${c.name.toLowerCase()}`, c);

  const categoryFor = (name: string | undefined, kind: "income" | "expense"): string | undefined => {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    const mapped = NAME_MAP[lower];
    if (mapped && categories.some((c) => c.id === mapped && c.kind === kind)) return mapped;
    const existing = byName.get(`${kind}:${lower}`);
    if (existing) return existing.id;
    const created: Category = {
      id: uid("c-"),
      kind,
      name,
      icon: kind === "income" ? "HandCoins" : "CircleDashed",
      color: CHART_COLORS[categories.length % CHART_COLORS.length]
    };
    categories.push(created);
    byName.set(`${kind}:${lower}`, created);
    return created.id;
  };

  const wallets: Wallet[] = p.wallets.map((w, i) => ({
    id: String(w.id),
    name: w.name || `Кошелёк ${i + 1}`,
    kind: KIND_BY_ICON[w.icon ?? ""] ?? "other",
    currency: "RUB",
    style: STYLES[i % STYLES.length],
    openingBalance: 0,
    includeInTotal: true,
    createdAt: now
  }));
  const target: Record<string, number> = {};
  p.wallets.forEach((w) => (target[String(w.id)] = Math.round((Number(w.balance) || 0) * 100)));

  const transactions: Transaction[] = (p.transactions ?? [])
    .filter((t) => t && (t.type === "income" || t.type === "expense") && Number(t.amount) > 0)
    .map((t) => {
      const date = toLocal(t.date);
      return {
        id: t.id ? String(t.id) : uid("t-"),
        kind: t.type,
        amount: Math.round(Number(t.amount) * 100),
        walletId: wallets.some((w) => w.id === String(t.walletId)) ? String(t.walletId) : undefined,
        categoryId: categoryFor(t.category, t.type),
        note: t.description || undefined,
        tags: Array.isArray(t.tags) ? t.tags : [],
        date,
        createdAt: date
      };
    });

  const debts: Debt[] = [];
  for (const d of p.debts ?? []) {
    const id = uid("d-");
    debts.push({
      id,
      direction: d.direction === "i_owe" ? "i_owe" : "owed_to_me",
      counterparty: d.person || "Без имени",
      amount: Math.round((Number(d.amount) || 0) * 100),
      currency: "RUB",
      date: now.slice(0, 10),
      dueDate: d.dueDate ? d.dueDate.slice(0, 10) : undefined,
      note: d.description || undefined,
      closedAt: d.status === "closed" ? now : undefined,
      createdAt: now
    });
    // Payments are recorded without a wallet: the old balances already include them.
    const history = d.history && d.history.length ? d.history : d.paidAmount ? [{ amount: d.paidAmount, date: new Date().toISOString() }] : [];
    for (const h of history) {
      const date = toLocal(h.date);
      transactions.push({ id: uid("t-"), kind: "debt", debtId: id, debtRole: "payment", flow: d.direction === "i_owe" ? "out" : "in", amount: Math.round(Number(h.amount) * 100), tags: [], date, createdAt: date });
    }
  }

  const goals: Goal[] = [];
  for (const g of p.goals ?? []) {
    const id = uid("g-");
    goals.push({
      id,
      name: g.name || "Цель",
      icon: "Target",
      target: Math.round((Number(g.targetAmount) || 0) * 100),
      currency: "RUB",
      deadline: g.deadline ? g.deadline.slice(0, 10) : undefined,
      createdAt: now
    });
    if (g.savedAmount && g.savedAmount > 0) {
      transactions.push({ id: uid("t-"), kind: "goal", goalId: id, flow: "out", amount: Math.round(g.savedAmount * 100), note: "Перенесено из прошлой версии", tags: [], date: now, createdAt: now });
    }
  }

  const flows = computeBalances(wallets, transactions);
  for (const w of wallets) w.openingBalance = (target[w.id] ?? 0) - flows[w.id];

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    wallets,
    transactions,
    categories,
    budgets: [],
    goals,
    recurring: [],
    plans: [],
    debts,
    tasks: [],
    notes: [],
    favorites: [],
    settings: { ...defaultSettings(), theme: p.isDark === false ? "light" : "dark", defaultWalletId: wallets[0]?.id },
    meta: { demo: false, createdAt: now, importedFromV1: true }
  };
}
