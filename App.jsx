import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Wallet, TrendingUp, TrendingDown, Search, Plus, Moon, Sun, PiggyBank,
  Users, BarChart3, ArrowLeftRight, X, Trash2, Pencil, Check, CalendarDays,
  Tag, LayoutGrid, ChevronRight, ChevronDown, Banknote, CreditCard, Gem,
  Landmark, ShoppingBag, Sparkles, ArrowUpRight, ArrowDownRight, ArrowRight,
  Target, Clock, ChevronLeft, Filter, MoreHorizontal
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar, Legend
} from "recharts";

/* ---------------------------------------------------------------------- */
/*  DESIGN TOKENS                                                          */
/* ---------------------------------------------------------------------- */

const PALETTE = {
  dark: {
    bg: "#0B0E14", surface: "#131722", surfaceAlt: "#1A1F2C", surfaceHi: "#20263A",
    border: "#232838", borderSoft: "#1B2030", text: "#F2F4F8", textSub: "#8B93A7",
    textFaint: "#5B6272", shadow: "0 8px 30px rgba(0,0,0,0.45)"
  },
  light: {
    bg: "#F5F6F8", surface: "#FFFFFF", surfaceAlt: "#EEF0F4", surfaceHi: "#E6E9F0",
    border: "#E3E6EC", borderSoft: "#EBEDF2", text: "#12141A", textSub: "#6B7280",
    textFaint: "#9CA3AF", shadow: "0 8px 30px rgba(20,22,30,0.08)"
  }
};

const ACCENT = {
  brand: "#5B5FEF", brandSoft: "#5B5FEF22",
  income: "#2FBF8F", incomeSoft: "#2FBF8F1E",
  expense: "#F1654A", expenseSoft: "#F1654A1E",
  warning: "#F0A93A", warningSoft: "#F0A93A1E",
  goal: "#5B5FEF", goalSoft: "#5B5FEF1E"
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const fmtMoney = (n) => {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " ₽";
};

const MONTHS_RU = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const MONTHS_RU_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const DOW_RU = ["вс","пн","вт","ср","чт","пт","сб"];

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateShort(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`;
}
function daysBetween(a, b) {
  return Math.ceil((new Date(b) - new Date(a)) / 86400000);
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ---------------------------------------------------------------------- */
/*  SEED DATA                                                              */
/* ---------------------------------------------------------------------- */

const ICONS_WALLET = { Banknote, CreditCard, Landmark, Gem, PiggyBank, ShoppingBag, Wallet };
const WALLET_ICON_KEYS = Object.keys(ICONS_WALLET);
const WALLET_COLORS = ["#5B5FEF", "#2FBF8F", "#F1654A", "#F0A93A", "#3AA6D9", "#B65FE0", "#6B7280"];

const seedWallets = [
  { id: "w1", name: "Карта", icon: "CreditCard", color: "#5B5FEF", balance: 84500 },
  { id: "w2", name: "Наличные", icon: "Banknote", color: "#2FBF8F", balance: 12300 },
  { id: "w3", name: "Сбережения", icon: "PiggyBank", color: "#F0A93A", balance: 210000 },
  { id: "w4", name: "Крипта", icon: "Gem", color: "#B65FE0", balance: 45800 }
];

const INCOME_CATEGORIES = ["Зарплата", "Подработка", "Дивиденды", "Возврат долга", "Подарок", "Продажа"];
const EXPENSE_CATEGORIES = ["Еда", "Транспорт", "Такси", "Кафе", "Покупки", "Подписки", "Развлечения", "Семья", "Здоровье", "ЖКХ"];

function daysAgoISO(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString();
}

const seedTransactions = [
  { id: uid(), type: "income", amount: 130000, walletId: "w1", category: "Зарплата", description: "Зарплата за июнь", tags: [], date: daysAgoISO(3) },
  { id: uid(), type: "expense", amount: 3200, walletId: "w1", category: "Еда", description: "Продукты, Перекрёсток", tags: ["дом"], date: daysAgoISO(0) },
  { id: uid(), type: "expense", amount: 850, walletId: "w2", category: "Такси", description: "Такси до офиса", tags: [], date: daysAgoISO(0) },
  { id: uid(), type: "expense", amount: 12990, walletId: "w1", category: "Покупки", description: "Наушники", tags: ["техника"], date: daysAgoISO(2) },
  { id: uid(), type: "income", amount: 25000, walletId: "w2", category: "Подработка", description: "Дизайн-проект", tags: [], date: daysAgoISO(5) },
  { id: uid(), type: "expense", amount: 1490, walletId: "w1", category: "Подписки", description: "Яндекс Плюс + Кино", tags: [], date: daysAgoISO(6) },
  { id: uid(), type: "expense", amount: 4600, walletId: "w2", category: "Кафе", description: "Ужин с друзьями", tags: ["друзья"], date: daysAgoISO(8) },
  { id: uid(), type: "expense", amount: 2100, walletId: "w1", category: "Транспорт", description: "Бензин", tags: [], date: daysAgoISO(11) },
  { id: uid(), type: "income", amount: 8000, walletId: "w4", category: "Дивиденды", description: "Крипто-стейкинг", tags: [], date: daysAgoISO(14) },
  { id: uid(), type: "expense", amount: 15400, walletId: "w1", category: "Семья", description: "Подарок маме", tags: ["подарок"], date: daysAgoISO(20) },
  { id: uid(), type: "expense", amount: 6700, walletId: "w2", category: "Развлечения", description: "Кино и боулинг", tags: [], date: daysAgoISO(25) },
  { id: uid(), type: "income", amount: 130000, walletId: "w1", category: "Зарплата", description: "Зарплата за май", tags: [], date: daysAgoISO(33) }
];

const seedDebts = [
  { id: uid(), direction: "owed_to_me", person: "Иван Петров", amount: 15000, paidAmount: 5000, dueDate: daysAgoISO(-10).slice(0,10), description: "Одолжил на ремонт", status: "active", history: [{ id: uid(), amount: 5000, date: daysAgoISO(4) }] },
  { id: uid(), direction: "i_owe", person: "Мария", amount: 8000, paidAmount: 0, dueDate: daysAgoISO(-4).slice(0,10), description: "Заняла на билеты", status: "active", history: [] }
];

const seedGoals = [
  { id: uid(), name: "Новый автомобиль", targetAmount: 900000, savedAmount: 210000, deadline: daysAgoISO(-240).slice(0,10), description: "Kia Ceed или аналог", walletId: "w3", history: [{id: uid(), amount: 210000, date: daysAgoISO(40)}] },
  { id: uid(), name: "Отпуск в Японии", targetAmount: 250000, savedAmount: 45800, deadline: daysAgoISO(-150).slice(0,10), description: "2 недели, весна", walletId: "w4", history: [{id: uid(), amount: 45800, date: daysAgoISO(60)}] }
];

/* ---------------------------------------------------------------------- */
/*  SMALL UI PRIMITIVES                                                    */
/* ---------------------------------------------------------------------- */

function IconBadge({ icon: Icon, color, size = 40, ringSize = 18 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32, background: color + "20",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>
      <Icon size={ringSize} color={color} strokeWidth={2.2} />
    </div>
  );
}

function Card({ children, theme, style, className = "", onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl ${className}`}
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function Pill({ children, color, theme }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
      style={{ background: (color || ACCENT.brand) + "1E", color: color || ACCENT.brand }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, theme, style, small }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-transform active:scale-95 ${small ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm"}`}
      style={{ background: ACCENT.brand, color: "#fff", ...style }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, theme, style, small }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors active:scale-95 ${small ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm"}`}
      style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}`, ...style }}
    >
      {children}
    </button>
  );
}

function Field({ label, children, theme }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium mb-1.5" style={{ color: theme.textSub }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle(theme) {
  return {
    background: theme.surfaceAlt, border: `1px solid ${theme.border}`, color: theme.text,
    borderRadius: 12, padding: "10px 12px", width: "100%", outline: "none", fontSize: 14
  };
}

function Modal({ title, onClose, theme, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(8,10,16,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto`}
        style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0" style={{ background: theme.surface }}>
          <h3 className="font-bold text-lg" style={{ color: theme.text, fontFamily: "Manrope" }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ background: theme.surfaceAlt }}>
            <X size={18} color={theme.textSub} />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

function SegButton({ options, value, onChange, theme }) {
  return (
    <div className="inline-flex p-1 rounded-xl gap-1" style={{ background: theme.surfaceAlt }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: value === o.value ? (o.color || ACCENT.brand) : "transparent",
            color: value === o.value ? "#fff" : theme.textSub
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  MAIN APP                                                               */
/* ---------------------------------------------------------------------- */

const NAV = [
  { key: "dashboard", label: "Обзор", icon: LayoutGrid },
  { key: "wallets", label: "Кошельки", icon: Wallet },
  { key: "transactions", label: "Операции", icon: ArrowLeftRight },
  { key: "debts", label: "Долги", icon: Users },
  { key: "goals", label: "Цели", icon: Target },
  { key: "stats", label: "Статистика", icon: BarChart3 }
];

export default function FinanceDashboard() {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? PALETTE.dark : PALETTE.light;
  const [tab, setTab] = useState("dashboard");

  const [wallets, setWallets] = useState(seedWallets);
  const [transactions, setTransactions] = useState(seedTransactions);
  const [debts, setDebts] = useState(seedDebts);
  const [goals, setGoals] = useState(seedGoals);
  const [incomeCats, setIncomeCats] = useState(INCOME_CATEGORIES);
  const [expenseCats, setExpenseCats] = useState(EXPENSE_CATEGORIES);

  const [modal, setModal] = useState(null); // {type, payload}
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  /* ---- persistent storage: localStorage, loaded once on mount, saved on every change ---- */
  const STORAGE_KEY = "finance-data-v1";
  const [dataLoaded, setDataLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.wallets) setWallets(p.wallets);
        if (p.transactions) setTransactions(p.transactions);
        if (p.debts) setDebts(p.debts);
        if (p.goals) setGoals(p.goals);
        if (p.incomeCats) setIncomeCats(p.incomeCats);
        if (p.expenseCats) setExpenseCats(p.expenseCats);
        if (typeof p.isDark === "boolean") setIsDark(p.isDark);
      }
    } catch (e) {
      // nothing saved yet, or storage unavailable — keep defaults
    } finally {
      setDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    try {
      const payload = JSON.stringify({ wallets, transactions, debts, goals, incomeCats, expenseCats, isDark });
      localStorage.setItem(STORAGE_KEY, payload);
      setStorageError(false);
    } catch (e) {
      setStorageError(true);
    }
  }, [dataLoaded, wallets, transactions, debts, goals, incomeCats, expenseCats, isDark]);

  function resetAllData() {
    setWallets(seedWallets); setTransactions(seedTransactions); setDebts(seedDebts);
    setGoals(seedGoals); setIncomeCats(INCOME_CATEGORIES); setExpenseCats(EXPENSE_CATEGORIES);
    notify("Данные сброшены к примеру");
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (msg) => setToast(msg);

  /* ---- derived numbers ---- */
  const totalBalance = useMemo(() => wallets.reduce((s, w) => s + w.balance, 0), [wallets]);

  const isSameDay = (iso, d0) => {
    const d = new Date(iso);
    return d.getFullYear() === d0.getFullYear() && d.getMonth() === d0.getMonth() && d.getDate() === d0.getDate();
  };
  const isSameMonth = (iso, d0) => {
    const d = new Date(iso);
    return d.getFullYear() === d0.getFullYear() && d.getMonth() === d0.getMonth();
  };

  const now = new Date();
  const todayIncome = useMemo(() => transactions.filter(t => t.type === "income" && isSameDay(t.date, now)).reduce((s, t) => s + t.amount, 0), [transactions]);
  const todayExpense = useMemo(() => transactions.filter(t => t.type === "expense" && isSameDay(t.date, now)).reduce((s, t) => s + t.amount, 0), [transactions]);
  const monthIncome = useMemo(() => transactions.filter(t => t.type === "income" && isSameMonth(t.date, now)).reduce((s, t) => s + t.amount, 0), [transactions]);
  const monthExpense = useMemo(() => transactions.filter(t => t.type === "expense" && isSameMonth(t.date, now)).reduce((s, t) => s + t.amount, 0), [transactions]);
  const monthProfit = monthIncome - monthExpense;

  const totalOwedToMe = useMemo(() => debts.filter(d => d.direction === "owed_to_me" && d.status !== "closed").reduce((s, d) => s + (d.amount - d.paidAmount), 0), [debts]);
  const totalIOwe = useMemo(() => debts.filter(d => d.direction === "i_owe" && d.status !== "closed").reduce((s, d) => s + (d.amount - d.paidAmount), 0), [debts]);

  const recentTx = useMemo(() => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6), [transactions]);

  /* ---- actions ---- */
  function walletById(id) { return wallets.find(w => w.id === id); }

  function addTransaction(tx) {
    setTransactions(prev => [{ ...tx, id: uid() }, ...prev]);
    setWallets(prev => prev.map(w => {
      if (w.id !== tx.walletId) return w;
      return { ...w, balance: w.balance + (tx.type === "income" ? tx.amount : -tx.amount) };
    }));
    notify(tx.type === "income" ? "Доход добавлен" : "Расход добавлен");
  }

  function deleteTransaction(tx) {
    setTransactions(prev => prev.filter(t => t.id !== tx.id));
    setWallets(prev => prev.map(w => {
      if (w.id !== tx.walletId) return w;
      return { ...w, balance: w.balance - (tx.type === "income" ? tx.amount : -tx.amount) };
    }));
    notify("Операция удалена");
  }

  function addWallet(w) {
    setWallets(prev => [...prev, { ...w, id: uid() }]);
    notify("Кошелёк создан");
  }
  function updateWallet(id, patch) {
    setWallets(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }
  function deleteWallet(id) {
    setWallets(prev => prev.filter(w => w.id !== id));
    notify("Кошелёк удалён");
  }
  function transferFunds({ fromId, toId, amount }) {
    setWallets(prev => prev.map(w => {
      if (w.id === fromId) return { ...w, balance: w.balance - amount };
      if (w.id === toId) return { ...w, balance: w.balance + amount };
      return w;
    }));
    notify("Перевод выполнен");
  }

  function addDebt(d) {
    setDebts(prev => [{ ...d, id: uid(), paidAmount: 0, status: "active", history: [] }, ...prev]);
    notify("Долг добавлен");
  }
  function repayDebt(id, amount) {
    setDebts(prev => prev.map(d => {
      if (d.id !== id) return d;
      const paid = Math.min(d.amount, d.paidAmount + amount);
      return { ...d, paidAmount: paid, status: paid >= d.amount ? "closed" : "active", history: [...d.history, { id: uid(), amount, date: new Date().toISOString() }] };
    }));
    notify("Погашение записано");
  }
  function deleteDebt(id) {
    setDebts(prev => prev.filter(d => d.id !== id));
    notify("Запись удалена");
  }

  function addGoal(g) {
    setGoals(prev => [...prev, { ...g, id: uid(), savedAmount: 0, history: [] }]);
    notify("Цель создана");
  }
  function contributeGoal(id, amount, walletId) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, savedAmount: g.savedAmount + amount, history: [...g.history, { id: uid(), amount, date: new Date().toISOString() }] } : g));
    if (walletId) setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance - amount } : w));
    notify("Пополнение засчитано");
  }
  function withdrawGoal(id, amount, walletId) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, savedAmount: Math.max(0, g.savedAmount - amount), history: [...g.history, { id: uid(), amount: -amount, date: new Date().toISOString() }] } : g));
    if (walletId) setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance + amount } : w));
    notify("Средства сняты с цели");
  }
  function deleteGoal(id) {
    setGoals(prev => prev.filter(g => g.id !== id));
    notify("Цель удалена");
  }

  /* ---- global search ---- */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const txMatches = transactions.filter(t => {
      const monthName = MONTHS_RU[new Date(t.date).getMonth()];
      return (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        monthName.includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    });
    const debtMatches = debts.filter(d => d.person.toLowerCase().includes(q) || String(d.amount).includes(q) || d.description.toLowerCase().includes(q));
    const goalMatches = goals.filter(g => g.name.toLowerCase().includes(q));
    return { txMatches, debtMatches, goalMatches };
  }, [searchQuery, transactions, debts, goals]);

  /* ---------------------------------------------------------------------- */

  if (!dataLoaded) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", background: theme.bg, color: theme.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONT_IMPORT}</style>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ACCENT.brand }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <p className="text-sm" style={{ color: theme.textSub }}>Загружаем ваши данные…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: theme.bg, color: theme.text, minHeight: "100vh" }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 8px; }
        .num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .disp { font-family: 'Manrope', sans-serif; }
        .ledger-bg {
          background-image: repeating-linear-gradient(${isDark ? "rgba(255,255,255,0.035)" : "rgba(20,22,30,0.045)"} 0px, transparent 1px, transparent 27px, ${isDark ? "rgba(255,255,255,0.035)" : "rgba(20,22,30,0.045)"} 28px);
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        .fade-up { animation: fadeUp 0.35s ease both; }
      `}</style>

      <div className="flex">
        {/* ---------- Desktop sidebar ---------- */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 min-h-screen px-4 py-6 sticky top-0" style={{ borderRight: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2 px-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT.brand }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <span className="disp font-extrabold text-lg">Капитал</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(n => {
              const active = tab === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: active ? theme.surfaceAlt : "transparent", color: active ? theme.text : theme.textSub }}
                >
                  <n.icon size={18} strokeWidth={2.2} color={active ? ACCENT.brand : theme.textSub} />
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-2">
            {storageError && (
              <p className="text-xs px-1" style={{ color: ACCENT.expense }}>Не удалось сохранить данные. Проверьте соединение.</p>
            )}
            <GhostButton theme={theme} onClick={() => setIsDark(!isDark)} style={{ justifyContent: "flex-start" }}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? "Светлая тема" : "Тёмная тема"}
            </GhostButton>
            <GhostButton theme={theme} small onClick={() => { if (confirm("Сбросить все данные к примеру? Это нельзя отменить.")) resetAllData(); }} style={{ justifyContent: "flex-start", color: theme.textFaint }}>
              <Trash2 size={14} /> Сбросить данные
            </GhostButton>
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="flex-1 min-w-0 pb-24 md:pb-8">
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-4" style={{ background: theme.bg + "F5", backdropFilter: "blur(8px)", borderBottom: `1px solid ${theme.border}` }}>
            <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ACCENT.brand }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 flex-1 max-w-md px-3.5 py-2.5 rounded-xl text-sm"
              style={{ background: theme.surfaceAlt, color: theme.textSub, border: `1px solid ${theme.border}` }}
            >
              <Search size={16} /> Поиск операций, долгов, целей…
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setIsDark(!isDark)} className="md:hidden p-2.5 rounded-xl" style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
                {isDark ? <Sun size={16} color={theme.text} /> : <Moon size={16} color={theme.text} />}
              </button>
              <PrimaryButton theme={theme} onClick={() => setModal({ type: "addTx", payload: { type: "expense" } })}>
                <Plus size={16} /> <span className="hidden sm:inline">Добавить</span>
              </PrimaryButton>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
            {tab === "dashboard" && (
              <DashboardView
                theme={theme} isDark={isDark}
                totalBalance={totalBalance} wallets={wallets}
                todayIncome={todayIncome} todayExpense={todayExpense}
                monthIncome={monthIncome} monthExpense={monthExpense} monthProfit={monthProfit}
                totalOwedToMe={totalOwedToMe} totalIOwe={totalIOwe}
                recentTx={recentTx} walletById={walletById} debts={debts} goals={goals}
                transactions={transactions}
                setModal={setModal} setTab={setTab}
              />
            )}
            {tab === "wallets" && (
              <WalletsView theme={theme} wallets={wallets} setModal={setModal} deleteWallet={deleteWallet} totalBalance={totalBalance} />
            )}
            {tab === "transactions" && (
              <TransactionsView theme={theme} transactions={transactions} wallets={wallets} walletById={walletById} setModal={setModal} deleteTransaction={deleteTransaction} />
            )}
            {tab === "debts" && (
              <DebtsView theme={theme} debts={debts} setModal={setModal} repayDebt={repayDebt} deleteDebt={deleteDebt} />
            )}
            {tab === "goals" && (
              <GoalsView theme={theme} goals={goals} wallets={wallets} setModal={setModal} deleteGoal={deleteGoal} />
            )}
            {tab === "stats" && (
              <StatsView theme={theme} isDark={isDark} transactions={transactions} />
            )}
          </div>
        </div>
      </div>

      {/* ---------- Mobile bottom nav ---------- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch px-2 py-2" style={{ background: theme.surface, borderTop: `1px solid ${theme.border}` }}>
        {NAV.map(n => {
          const active = tab === n.key;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl">
              <n.icon size={19} strokeWidth={2.3} color={active ? ACCENT.brand : theme.textFaint} />
              <span className="text-[10px] font-medium" style={{ color: active ? theme.text : theme.textFaint }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- Toast ---------- */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium fade-up" style={{ background: theme.text, color: theme.bg }}>
          {toast}
        </div>
      )}

      {/* ---------- Search overlay ---------- */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme.bg }}>
          <div className="flex items-center gap-3 px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <Search size={18} color={theme.textSub} />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Иван, 5000, еда, май…"
              className="flex-1 bg-transparent outline-none text-base"
              style={{ color: theme.text }}
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-2 rounded-full" style={{ background: theme.surfaceAlt }}>
              <X size={18} color={theme.textSub} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full">
            {!searchResults && <p className="text-sm" style={{ color: theme.textFaint }}>Начните вводить, чтобы найти операции, долги или цели.</p>}
            {searchResults && (
              <>
                {searchResults.txMatches.length === 0 && searchResults.debtMatches.length === 0 && searchResults.goalMatches.length === 0 && (
                  <p className="text-sm" style={{ color: theme.textFaint }}>Ничего не найдено.</p>
                )}
                {searchResults.txMatches.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.textFaint }}>Операции</p>
                    <div className="flex flex-col gap-2">
                      {searchResults.txMatches.map(t => <TxRow key={t.id} tx={t} theme={theme} wallet={wallets.find(w => w.id === t.walletId)} />)}
                    </div>
                  </div>
                )}
                {searchResults.debtMatches.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.textFaint }}>Долги</p>
                    <div className="flex flex-col gap-2">
                      {searchResults.debtMatches.map(d => (
                        <Card key={d.id} theme={theme} className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{d.person}</p>
                            <p className="text-xs" style={{ color: theme.textSub }}>{d.description}</p>
                          </div>
                          <span className="num text-sm font-semibold" style={{ color: d.direction === "owed_to_me" ? ACCENT.income : ACCENT.expense }}>{fmtMoney(d.amount - d.paidAmount)}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.goalMatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.textFaint }}>Цели</p>
                    <div className="flex flex-col gap-2">
                      {searchResults.goalMatches.map(g => (
                        <Card key={g.id} theme={theme} className="p-3 flex items-center justify-between">
                          <p className="text-sm font-semibold">{g.name}</p>
                          <span className="num text-sm" style={{ color: theme.textSub }}>{fmtMoney(g.savedAmount)} / {fmtMoney(g.targetAmount)}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- Modals ---------- */}
      {modal?.type === "addTx" && (
        <AddTransactionModal
          theme={theme} initial={modal.payload} wallets={wallets}
          incomeCats={incomeCats} expenseCats={expenseCats}
          setIncomeCats={setIncomeCats} setExpenseCats={setExpenseCats}
          debts={debts}
          onClose={() => setModal(null)}
          onSave={(tx, linkedDebtId) => {
            addTransaction(tx);
            if (linkedDebtId) repayDebt(linkedDebtId, tx.amount);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "addWallet" && (
        <AddWalletModal theme={theme} onClose={() => setModal(null)} onSave={(w) => { addWallet(w); setModal(null); }} />
      )}
      {modal?.type === "editWallet" && (
        <AddWalletModal theme={theme} editing={modal.payload} onClose={() => setModal(null)} onSave={(w) => { updateWallet(modal.payload.id, w); setModal(null); notify("Кошелёк обновлён"); }} />
      )}
      {modal?.type === "transfer" && (
        <TransferModal theme={theme} wallets={wallets} onClose={() => setModal(null)} onSave={(payload) => { transferFunds(payload); setModal(null); }} />
      )}
      {modal?.type === "addDebt" && (
        <AddDebtModal theme={theme} initial={modal.payload} onClose={() => setModal(null)} onSave={(d) => { addDebt(d); setModal(null); }} />
      )}
      {modal?.type === "repayDebt" && (
        <RepayDebtModal theme={theme} debt={modal.payload} onClose={() => setModal(null)} onSave={(amt) => { repayDebt(modal.payload.id, amt); setModal(null); }} />
      )}
      {modal?.type === "addGoal" && (
        <AddGoalModal theme={theme} wallets={wallets} onClose={() => setModal(null)} onSave={(g) => { addGoal(g); setModal(null); }} />
      )}
      {modal?.type === "goalFund" && (
        <GoalFundModal theme={theme} goal={modal.payload.goal} mode={modal.payload.mode} wallets={wallets}
          onClose={() => setModal(null)}
          onSave={(amount, walletId) => {
            if (modal.payload.mode === "add") contributeGoal(modal.payload.goal.id, amount, walletId);
            else withdrawGoal(modal.payload.goal.id, amount, walletId);
            setModal(null);
          }} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DASHBOARD VIEW                                                         */
/* ---------------------------------------------------------------------- */

function StatCard({ theme, label, value, icon: Icon, color, sub }) {
  return (
    <Card theme={theme} className="p-4 flex flex-col gap-2 fade-up">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: theme.textSub }}>{label}</span>
        <IconBadge icon={Icon} color={color} size={30} ringSize={15} />
      </div>
      <span className="num text-xl font-bold disp">{fmtMoney(value)}</span>
      {sub && <span className="text-xs" style={{ color: theme.textFaint }}>{sub}</span>}
    </Card>
  );
}

function TxRow({ tx, theme, wallet, onDelete }) {
  const isIncome = tx.type === "income";
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <IconBadge icon={isIncome ? ArrowUpRight : ArrowDownRight} color={isIncome ? ACCENT.income : ACCENT.expense} size={36} ringSize={17} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{tx.description || tx.category}</p>
        <p className="text-xs truncate" style={{ color: theme.textSub }}>{tx.category} · {wallet?.name} · {fmtDateShort(tx.date)}</p>
      </div>
      <span className="num text-sm font-bold shrink-0" style={{ color: isIncome ? ACCENT.income : ACCENT.expense }}>
        {isIncome ? "+" : "−"}{Math.abs(tx.amount).toLocaleString("ru-RU")} ₽
      </span>
      {onDelete && (
        <button onClick={() => onDelete(tx)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1.5 rounded-lg shrink-0" style={{ background: theme.surfaceAlt }}>
          <Trash2 size={14} color={theme.textFaint} />
        </button>
      )}
    </div>
  );
}

function DashboardView({ theme, isDark, totalBalance, wallets, todayIncome, todayExpense, monthIncome, monthExpense, monthProfit, totalOwedToMe, totalIOwe, recentTx, walletById, debts, goals, transactions, setModal, setTab }) {
  const catBreakdown = useMemo(() => {
    const now = new Date();
    const map = {};
    transactions.filter(t => t.type === "expense" && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const activeGoals = goals.slice(0, 2);
  const activeDebts = debts.filter(d => d.status !== "closed").slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero balance */}
      <Card theme={theme} className="p-6 sm:p-8 relative overflow-hidden ledger-bg fade-up">
        <div className="relative z-10">
          <p className="text-sm font-medium mb-2" style={{ color: theme.textSub }}>Общий капитал</p>
          <p className="disp num font-extrabold tracking-tight" style={{ fontSize: "clamp(2.2rem, 6vw, 3.4rem)", lineHeight: 1 }}>
            {fmtMoney(totalBalance)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {wallets.map(w => {
              const Icon = ICONS_WALLET[w.icon] || Wallet;
              return (
                <div key={w.id} className="flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full" style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
                  <IconBadge icon={Icon} color={w.color} size={22} ringSize={11} />
                  <span className="text-xs font-medium" style={{ color: theme.textSub }}>{w.name}</span>
                  <span className="num text-xs font-bold">{fmtMoney(w.balance)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-5">
            <PrimaryButton theme={theme} onClick={() => setModal({ type: "addTx", payload: { type: "income" } })} style={{ background: ACCENT.income }}>
              <Plus size={15} /> Доход
            </PrimaryButton>
            <PrimaryButton theme={theme} onClick={() => setModal({ type: "addTx", payload: { type: "expense" } })} style={{ background: ACCENT.expense }}>
              <Plus size={15} /> Расход
            </PrimaryButton>
            <GhostButton theme={theme} onClick={() => setModal({ type: "transfer" })}>
              <ArrowLeftRight size={15} /> Перевод
            </GhostButton>
          </div>
        </div>
      </Card>

      {/* Today / month stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard theme={theme} label="Доход сегодня" value={todayIncome} icon={TrendingUp} color={ACCENT.income} />
        <StatCard theme={theme} label="Расход сегодня" value={todayExpense} icon={TrendingDown} color={ACCENT.expense} />
        <StatCard theme={theme} label="Доход за месяц" value={monthIncome} icon={TrendingUp} color={ACCENT.income} />
        <StatCard theme={theme} label="Расход за месяц" value={monthExpense} icon={TrendingDown} color={ACCENT.expense} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: profit + categories */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card theme={theme} className="p-5 fade-up">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Чистая прибыль за месяц</p>
              <Pill theme={theme} color={monthProfit >= 0 ? ACCENT.income : ACCENT.expense}>
                {monthProfit >= 0 ? "в плюсе" : "в минусе"}
              </Pill>
            </div>
            <p className="num disp font-extrabold text-3xl" style={{ color: monthProfit >= 0 ? ACCENT.income : ACCENT.expense }}>
              {fmtMoney(monthProfit)}
            </p>
          </Card>

          <Card theme={theme} className="p-5 fade-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Куда уходят деньги</p>
              <button onClick={() => setTab("stats")} className="text-xs font-medium flex items-center gap-0.5" style={{ color: ACCENT.brand }}>
                Вся статистика <ChevronRight size={13} />
              </button>
            </div>
            {catBreakdown.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Пока нет расходов в этом месяце.</p>}
            <div className="flex flex-col gap-2.5">
              {catBreakdown.map(([cat, amt]) => {
                const max = catBreakdown[0][1];
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: theme.textSub }}>{cat}</span>
                      <span className="num font-semibold">{fmtMoney(amt)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.surfaceAlt }}>
                      <div className="h-full rounded-full" style={{ width: `${(amt / max) * 100}%`, background: ACCENT.expense }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card theme={theme} className="p-5 fade-up">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Последние операции</p>
              <button onClick={() => setTab("transactions")} className="text-xs font-medium flex items-center gap-0.5" style={{ color: ACCENT.brand }}>
                Все операции <ChevronRight size={13} />
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {recentTx.map(t => <TxRow key={t.id} tx={t} theme={theme} wallet={walletById(t.walletId)} />)}
            </div>
          </Card>
        </div>

        {/* Right: debts + goals */}
        <div className="flex flex-col gap-4">
          <Card theme={theme} className="p-5 fade-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Долги</p>
              <button onClick={() => setTab("debts")} className="text-xs font-medium flex items-center gap-0.5" style={{ color: ACCENT.brand }}>
                Все <ChevronRight size={13} />
              </button>
            </div>
            <div className="flex justify-between mb-3">
              <div>
                <p className="text-xs" style={{ color: theme.textSub }}>Мне должны</p>
                <p className="num font-bold" style={{ color: ACCENT.income }}>{fmtMoney(totalOwedToMe)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: theme.textSub }}>Я должен</p>
                <p className="num font-bold" style={{ color: ACCENT.expense }}>{fmtMoney(totalIOwe)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {activeDebts.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate" style={{ color: theme.textSub }}>{d.person}</span>
                  <span className="num font-semibold" style={{ color: d.direction === "owed_to_me" ? ACCENT.income : ACCENT.expense }}>{fmtMoney(d.amount - d.paidAmount)}</span>
                </div>
              ))}
              {activeDebts.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Долгов нет — отличная работа.</p>}
            </div>
          </Card>

          <Card theme={theme} className="p-5 fade-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Ближайшие цели</p>
              <button onClick={() => setTab("goals")} className="text-xs font-medium flex items-center gap-0.5" style={{ color: ACCENT.brand }}>
                Все <ChevronRight size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {activeGoals.map(g => {
                const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{ color: theme.text }}>{g.name}</span>
                      <span style={{ color: theme.textSub }}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: theme.surfaceAlt }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT.goal }} />
                    </div>
                    <p className="text-xs num" style={{ color: theme.textFaint }}>{fmtMoney(g.savedAmount)} из {fmtMoney(g.targetAmount)}</p>
                  </div>
                );
              })}
              {activeGoals.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Пока нет целей.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  WALLETS VIEW                                                           */
/* ---------------------------------------------------------------------- */

function WalletsView({ theme, wallets, setModal, deleteWallet, totalBalance }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="disp font-extrabold text-2xl">Кошельки</h2>
          <p className="text-sm" style={{ color: theme.textSub }}>Всего: <span className="num font-semibold">{fmtMoney(totalBalance)}</span></p>
        </div>
        <div className="flex gap-2">
          <GhostButton theme={theme} onClick={() => setModal({ type: "transfer" })}><ArrowLeftRight size={15} /> Перевод</GhostButton>
          <PrimaryButton theme={theme} onClick={() => setModal({ type: "addWallet" })}><Plus size={15} /> Кошелёк</PrimaryButton>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(w => {
          const Icon = ICONS_WALLET[w.icon] || Wallet;
          return (
            <Card key={w.id} theme={theme} className="p-5 fade-up">
              <div className="flex items-center justify-between mb-4">
                <IconBadge icon={Icon} color={w.color} size={44} ringSize={21} />
                <div className="flex gap-1">
                  <button onClick={() => setModal({ type: "editWallet", payload: w })} className="p-1.5 rounded-lg" style={{ background: theme.surfaceAlt }}>
                    <Pencil size={13} color={theme.textFaint} />
                  </button>
                  <button onClick={() => deleteWallet(w.id)} className="p-1.5 rounded-lg" style={{ background: theme.surfaceAlt }}>
                    <Trash2 size={13} color={theme.textFaint} />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: theme.textSub }}>{w.name}</p>
              <p className="num disp font-extrabold text-2xl">{fmtMoney(w.balance)}</p>
            </Card>
          );
        })}
        <button
          onClick={() => setModal({ type: "addWallet" })}
          className="rounded-2xl flex flex-col items-center justify-center gap-2 py-10 fade-up"
          style={{ border: `2px dashed ${theme.border}`, color: theme.textFaint }}
        >
          <Plus size={22} />
          <span className="text-sm font-medium">Новый кошелёк</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  TRANSACTIONS VIEW                                                      */
/* ---------------------------------------------------------------------- */

function TransactionsView({ theme, transactions, wallets, walletById, setModal, deleteTransaction }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return transactions
      .filter(t => typeFilter === "all" || t.type === typeFilter)
      .filter(t => walletFilter === "all" || t.walletId === walletFilter)
      .filter(t => !query || t.description.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, typeFilter, walletFilter, query]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const key = fmtDate(t.date);
      map[key] = map[key] || [];
      map[key].push(t);
    });
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="disp font-extrabold text-2xl">Операции</h2>
        <div className="flex gap-2">
          <GhostButton theme={theme} onClick={() => setModal({ type: "addTx", payload: { type: "income" } })} style={{ color: ACCENT.income }}><Plus size={15} /> Доход</GhostButton>
          <PrimaryButton theme={theme} onClick={() => setModal({ type: "addTx", payload: { type: "expense" } })} style={{ background: ACCENT.expense }}><Plus size={15} /> Расход</PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegButton theme={theme} value={typeFilter} onChange={setTypeFilter} options={[
          { value: "all", label: "Все" }, { value: "income", label: "Доходы", color: ACCENT.income }, { value: "expense", label: "Расходы", color: ACCENT.expense }
        ]} />
        <select value={walletFilter} onChange={e => setWalletFilter(e.target.value)} className="text-sm rounded-xl px-3 py-2" style={{ background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}` }}>
          <option value="all">Все кошельки</option>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[160px] px-3 py-2 rounded-xl" style={{ background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
          <Search size={14} color={theme.textFaint} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти операцию…" className="bg-transparent outline-none text-sm flex-1" style={{ color: theme.text }} />
        </div>
      </div>

      <Card theme={theme} className="p-4 sm:p-5">
        {Object.keys(grouped).length === 0 && <p className="text-sm py-6 text-center" style={{ color: theme.textFaint }}>Операций не найдено.</p>}
        {Object.entries(grouped).map(([date, txs]) => (
          <div key={date} className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: theme.textFaint }}>{date}</p>
            <div className="divide-y" style={{ borderColor: theme.border }}>
              {txs.map(t => <TxRow key={t.id} tx={t} theme={theme} wallet={walletById(t.walletId)} onDelete={deleteTransaction} />)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DEBTS VIEW                                                             */
/* ---------------------------------------------------------------------- */

function DebtsView({ theme, debts, setModal, repayDebt, deleteDebt }) {
  const owedToMe = debts.filter(d => d.direction === "owed_to_me");
  const iOwe = debts.filter(d => d.direction === "i_owe");

  const Column = ({ title, items, color, direction }) => (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color }}>{title}</p>
        <button onClick={() => setModal({ type: "addDebt", payload: { direction } })} className="p-1.5 rounded-lg" style={{ background: theme.surfaceAlt }}>
          <Plus size={14} color={theme.text} />
        </button>
      </div>
      {items.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Пока пусто.</p>}
      {items.map(d => {
        const remaining = d.amount - d.paidAmount;
        const pct = Math.round((d.paidAmount / d.amount) * 100);
        const overdue = d.status !== "closed" && new Date(d.dueDate) < new Date();
        return (
          <Card key={d.id} theme={theme} className="p-4 fade-up">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{d.person}</p>
                <p className="text-xs" style={{ color: theme.textSub }}>{d.description}</p>
              </div>
              <button onClick={() => deleteDebt(d.id)} className="p-1 rounded-lg" style={{ background: theme.surfaceAlt }}>
                <Trash2 size={13} color={theme.textFaint} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="num font-bold text-lg" style={{ color }}>{fmtMoney(remaining)}</span>
              {d.status === "closed" ? (
                <Pill theme={theme} color={ACCENT.income}><Check size={11} /> Погашено</Pill>
              ) : overdue ? (
                <Pill theme={theme} color={ACCENT.expense}><Clock size={11} /> Просрочено</Pill>
              ) : (
                <Pill theme={theme} color={theme.textFaint}>до {fmtDateShort(d.dueDate)}</Pill>
              )}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: theme.surfaceAlt }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            {d.status !== "closed" && (
              <GhostButton theme={theme} small onClick={() => setModal({ type: "repayDebt", payload: d })} style={{ width: "100%" }}>
                Отметить погашение
              </GhostButton>
            )}
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <h2 className="disp font-extrabold text-2xl">Долги</h2>
      <div className="flex flex-col lg:flex-row gap-6">
        <Column title="Мне должны" items={owedToMe} color={ACCENT.income} direction="owed_to_me" />
        <Column title="Я должен" items={iOwe} color={ACCENT.expense} direction="i_owe" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  GOALS VIEW                                                             */
/* ---------------------------------------------------------------------- */

function GoalsView({ theme, goals, wallets, setModal, deleteGoal }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="disp font-extrabold text-2xl">Финансовые цели</h2>
        <PrimaryButton theme={theme} onClick={() => setModal({ type: "addGoal" })}><Plus size={15} /> Новая цель</PrimaryButton>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
          const daysLeft = daysBetween(new Date(), g.deadline);
          const remaining = Math.max(0, g.targetAmount - g.savedAmount);
          const perDay = daysLeft > 0 ? remaining / daysLeft : remaining;
          const perWeek = perDay * 7;
          const perMonth = perDay * 30;
          return (
            <Card key={g.id} theme={theme} className="p-5 fade-up">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-base">{g.name}</p>
                  <p className="text-xs" style={{ color: theme.textSub }}>{g.description}</p>
                </div>
                <button onClick={() => deleteGoal(g.id)} className="p-1.5 rounded-lg" style={{ background: theme.surfaceAlt }}>
                  <Trash2 size={13} color={theme.textFaint} />
                </button>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="num disp font-extrabold text-2xl">{fmtMoney(g.savedAmount)}</span>
                <span className="text-sm" style={{ color: theme.textSub }}>из {fmtMoney(g.targetAmount)}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: theme.surfaceAlt }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT.goal }} />
              </div>
              <div className="flex justify-between text-xs mb-4" style={{ color: theme.textFaint }}>
                <span>{pct}% готово</span>
                <span>{daysLeft > 0 ? `${daysLeft} дн. до цели` : "срок прошёл"}</span>
              </div>
              {remaining > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[["в день", perDay], ["в неделю", perWeek], ["в месяц", perMonth]].map(([label, val]) => (
                    <div key={label} className="rounded-xl p-2 text-center" style={{ background: theme.surfaceAlt }}>
                      <p className="num text-xs font-bold">{fmtMoney(val)}</p>
                      <p className="text-[10px]" style={{ color: theme.textFaint }}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <PrimaryButton theme={theme} small onClick={() => setModal({ type: "goalFund", payload: { goal: g, mode: "add" } })} style={{ flex: 1 }}>Пополнить</PrimaryButton>
                <GhostButton theme={theme} small onClick={() => setModal({ type: "goalFund", payload: { goal: g, mode: "withdraw" } })} style={{ flex: 1 }}>Снять</GhostButton>
              </div>
            </Card>
          );
        })}
        <button onClick={() => setModal({ type: "addGoal" })} className="rounded-2xl flex flex-col items-center justify-center gap-2 py-10 fade-up" style={{ border: `2px dashed ${theme.border}`, color: theme.textFaint }}>
          <Target size={22} /><span className="text-sm font-medium">Новая цель</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  STATS VIEW                                                             */
/* ---------------------------------------------------------------------- */

const PIE_COLORS = ["#5B5FEF", "#2FBF8F", "#F1654A", "#F0A93A", "#3AA6D9", "#B65FE0", "#6B7280", "#E0607A"];

function StatsView({ theme, isDark, transactions }) {
  const [period, setPeriod] = useState("month");

  const range = useMemo(() => {
    const now = new Date();
    let start = new Date();
    if (period === "week") start.setDate(now.getDate() - 7);
    else if (period === "month") start.setMonth(now.getMonth() - 1);
    else if (period === "quarter") start.setMonth(now.getMonth() - 3);
    else if (period === "year") start.setFullYear(now.getFullYear() - 1);
    else start = new Date(0);
    return { start, end: now };
  }, [period]);

  const filtered = useMemo(() => transactions.filter(t => new Date(t.date) >= range.start && new Date(t.date) <= range.end), [transactions, range]);

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const expenseCount = filtered.filter(t => t.type === "expense").length;
  const incomeCount = filtered.filter(t => t.type === "income").length;
  const avgExpense = expenseCount ? totalExpense / expenseCount : 0;
  const avgIncome = incomeCount ? totalIncome / incomeCount : 0;

  const expenseByCat = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === "expense").forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const incomeByCat = useMemo(() => {
    const map = {};
    filtered.filter(t => t.type === "income").forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const trend = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`;
      map[key] = map[key] || { name: key, income: 0, expense: 0, sortKey: d.getTime() };
      map[key][t.type] += t.amount;
    });
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
  }, [filtered]);

  const topExpenses = useMemo(() => [...filtered].filter(t => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5), [filtered]);
  const topIncomes = useMemo(() => [...filtered].filter(t => t.type === "income").sort((a, b) => b.amount - a.amount).slice(0, 5), [filtered]);

  const tooltipStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="disp font-extrabold text-2xl">Статистика</h2>
        <SegButton theme={theme} value={period} onChange={setPeriod} options={[
          { value: "week", label: "Неделя" }, { value: "month", label: "Месяц" }, { value: "quarter", label: "Квартал" }, { value: "year", label: "Год" }, { value: "all", label: "Всё время" }
        ]} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard theme={theme} label="Доход" value={totalIncome} icon={TrendingUp} color={ACCENT.income} />
        <StatCard theme={theme} label="Расход" value={totalExpense} icon={TrendingDown} color={ACCENT.expense} />
        <StatCard theme={theme} label="Прибыль" value={totalIncome - totalExpense} icon={Banknote} color={ACCENT.brand} />
        <StatCard theme={theme} label="Средний расход" value={avgExpense} icon={BarChart3} color={ACCENT.warning} sub={`ср. доход ${fmtMoney(avgIncome)}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card theme={theme} className="p-5">
          <p className="text-sm font-semibold mb-3">Расходы по категориям</p>
          {expenseByCat.length === 0 ? <p className="text-sm py-10 text-center" style={{ color: theme.textFaint }}>Нет данных</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expenseByCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-2">
            {expenseByCat.slice(0, 6).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{c.name}</span>
                <span className="num font-semibold">{fmtMoney(c.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card theme={theme} className="p-5">
          <p className="text-sm font-semibold mb-3">Источники дохода</p>
          {incomeByCat.length === 0 ? <p className="text-sm py-10 text-center" style={{ color: theme.textFaint }}>Нет данных</p> : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={incomeByCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {incomeByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-2">
            {incomeByCat.slice(0, 6).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} />{c.name}</span>
                <span className="num font-semibold">{fmtMoney(c.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card theme={theme} className="p-5">
        <p className="text-sm font-semibold mb-3">Динамика доходов и расходов</p>
        {trend.length === 0 ? <p className="text-sm py-10 text-center" style={{ color: theme.textFaint }}>Нет данных</p> : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.textFaint }} />
                <YAxis tick={{ fontSize: 11, fill: theme.textFaint }} width={40} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income" name="Доход" stroke={ACCENT.income} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="expense" name="Расход" stroke={ACCENT.expense} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card theme={theme} className="p-5">
          <p className="text-sm font-semibold mb-3">Самые большие траты</p>
          <div className="flex flex-col gap-2">
            {topExpenses.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Нет данных</p>}
            {topExpenses.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="truncate" style={{ color: theme.textSub }}>{t.description || t.category}</span>
                <span className="num font-semibold" style={{ color: ACCENT.expense }}>{fmtMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card theme={theme} className="p-5">
          <p className="text-sm font-semibold mb-3">Самые большие доходы</p>
          <div className="flex flex-col gap-2">
            {topIncomes.length === 0 && <p className="text-sm" style={{ color: theme.textFaint }}>Нет данных</p>}
            {topIncomes.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="truncate" style={{ color: theme.textSub }}>{t.description || t.category}</span>
                <span className="num font-semibold" style={{ color: ACCENT.income }}>{fmtMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  MODALS                                                                 */
/* ---------------------------------------------------------------------- */

const DEBT_RETURN_CATEGORY = "Возврат долга";

function AddTransactionModal({ theme, initial, wallets, incomeCats, expenseCats, setIncomeCats, setExpenseCats, debts, onClose, onSave }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(wallets[0]?.id || "");
  const cats = type === "income" ? incomeCats : expenseCats;
  const [category, setCategory] = useState(cats[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [tagsInput, setTagsInput] = useState("");
  const [newCat, setNewCat] = useState("");
  const [linkedDebtId, setLinkedDebtId] = useState("");

  useEffect(() => { setCategory((type === "income" ? incomeCats : expenseCats)[0]); }, [type]);

  const addCategory = () => {
    if (!newCat.trim()) return;
    if (type === "income") setIncomeCats(prev => [...prev, newCat.trim()]);
    else setExpenseCats(prev => [...prev, newCat.trim()]);
    setCategory(newCat.trim());
    setNewCat("");
  };

  const isDebtReturn = type === "income" && category === DEBT_RETURN_CATEGORY;
  const openDebts = useMemo(() => (debts || []).filter(d => d.direction === "owed_to_me" && d.status !== "closed"), [debts]);
  const selectedDebt = openDebts.find(d => d.id === linkedDebtId);
  const selectedDebtRemaining = selectedDebt ? selectedDebt.amount - selectedDebt.paidAmount : 0;

  function pickDebt(debtId) {
    setLinkedDebtId(debtId);
    const d = openDebts.find(x => x.id === debtId);
    if (d) {
      const remaining = d.amount - d.paidAmount;
      setAmount(String(remaining));
      setDescription(`Возврат долга — ${d.person}`);
    }
  }

  useEffect(() => { if (!isDebtReturn) setLinkedDebtId(""); }, [isDebtReturn]);

  const canSave = amount && Number(amount) > 0 && walletId && category;

  return (
    <Modal title={type === "income" ? "Новый доход" : "Новый расход"} onClose={onClose} theme={theme}>
      <SegButton theme={theme} value={type} onChange={setType} options={[
        { value: "expense", label: "Расход", color: ACCENT.expense }, { value: "income", label: "Доход", color: ACCENT.income }
      ]} />
      <div className="mt-4">
        <Field label="Сумма, ₽" theme={theme}>
          <input autoFocus type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ ...inputStyle(theme), fontSize: 20, fontFamily: "JetBrains Mono", fontWeight: 600 }} />
        </Field>
        <Field label="Кошелёк" theme={theme}>
          <select value={walletId} onChange={e => setWalletId(e.target.value)} style={inputStyle(theme)}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Категория" theme={theme}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {cats.map(c => (
              <button key={c} onClick={() => setCategory(c)} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: category === c ? (type === "income" ? ACCENT.income : ACCENT.expense) : theme.surfaceAlt, color: category === c ? "#fff" : theme.textSub }}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Своя категория…" style={{ ...inputStyle(theme), flex: 1 }} />
            <GhostButton theme={theme} small onClick={addCategory}><Plus size={13} /></GhostButton>
          </div>
        </Field>
        {isDebtReturn && (
          <Field label="Кто вернул долг" theme={theme}>
            {openDebts.length === 0 ? (
              <p className="text-xs" style={{ color: theme.textFaint }}>Нет открытых долгов «мне должны» — можно оформить как обычный доход.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {openDebts.map(d => {
                  const remaining = d.amount - d.paidAmount;
                  const active = linkedDebtId === d.id;
                  return (
                    <button
                      key={d.id} onClick={() => pickDebt(d.id)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-left"
                      style={{ background: active ? ACCENT.income + "1E" : theme.surfaceAlt, border: active ? `1.5px solid ${ACCENT.income}` : `1px solid ${theme.border}` }}
                    >
                      <div>
                        <p className="text-sm font-semibold">{d.person}</p>
                        <p className="text-xs" style={{ color: theme.textSub }}>{d.description}</p>
                      </div>
                      <span className="num text-sm font-bold" style={{ color: ACCENT.income }}>{fmtMoney(remaining)}</span>
                    </button>
                  );
                })}
                {linkedDebtId && (
                  <button onClick={() => setLinkedDebtId("")} className="text-xs self-start" style={{ color: theme.textFaint }}>Не привязывать к долгу</button>
                )}
              </div>
            )}
            {linkedDebtId && Number(amount) > selectedDebtRemaining && (
              <p className="text-xs mt-2" style={{ color: ACCENT.warning }}>
                Сумма больше остатка долга ({fmtMoney(selectedDebtRemaining)}) — долг закроется полностью, остальное запишется как доход.
              </p>
            )}
            {linkedDebtId && Number(amount) > 0 && Number(amount) < selectedDebtRemaining && (
              <p className="text-xs mt-2" style={{ color: theme.textSub }}>
                Долг будет погашен частично, останется {fmtMoney(selectedDebtRemaining - Number(amount))}.
              </p>
            )}
          </Field>
        )}
        <Field label="Описание" theme={theme}>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Например: продукты на неделю" style={inputStyle(theme)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата" theme={theme}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle(theme)} />
          </Field>
          <Field label="Теги (через запятую)" theme={theme}>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="дом, друзья" style={inputStyle(theme)} />
          </Field>
        </div>
        <PrimaryButton
          theme={theme} style={{ width: "100%", marginTop: 8, background: canSave ? (type === "income" ? ACCENT.income : ACCENT.expense) : theme.surfaceAlt, opacity: canSave ? 1 : 0.6 }}
          onClick={() => canSave && onSave({ type, amount: Number(amount), walletId, category, description, tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean), date: new Date(date).toISOString(), debtId: linkedDebtId || undefined }, linkedDebtId || null)}
        >
          Сохранить операцию
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function AddWalletModal({ theme, editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || "");
  const [icon, setIcon] = useState(editing?.icon || "Wallet");
  const [color, setColor] = useState(editing?.color || WALLET_COLORS[0]);
  const [balance, setBalance] = useState(editing?.balance ?? "");

  return (
    <Modal title={editing ? "Редактировать кошелёк" : "Новый кошелёк"} onClose={onClose} theme={theme}>
      <Field label="Название" theme={theme}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Например: Депозит" style={inputStyle(theme)} />
      </Field>
      <Field label="Иконка" theme={theme}>
        <div className="flex gap-2 flex-wrap">
          {WALLET_ICON_KEYS.map(k => {
            const Icon = ICONS_WALLET[k];
            return (
              <button key={k} onClick={() => setIcon(k)} className="p-2.5 rounded-xl" style={{ background: icon === k ? color + "30" : theme.surfaceAlt, border: icon === k ? `1.5px solid ${color}` : `1px solid ${theme.border}` }}>
                <Icon size={18} color={icon === k ? color : theme.textSub} />
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Цвет" theme={theme}>
        <div className="flex gap-2 flex-wrap">
          {WALLET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full" style={{ background: c, outline: color === c ? `2px solid ${theme.text}` : "none", outlineOffset: 2 }} />
          ))}
        </div>
      </Field>
      {!editing && (
        <Field label="Начальный баланс, ₽" theme={theme}>
          <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" style={inputStyle(theme)} />
        </Field>
      )}
      <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, opacity: name ? 1 : 0.6 }} onClick={() => name && onSave({ name, icon, color, balance: Number(balance) || 0 })}>
        {editing ? "Сохранить" : "Создать кошелёк"}
      </PrimaryButton>
    </Modal>
  );
}

function TransferModal({ theme, wallets, onClose, onSave }) {
  const [fromId, setFromId] = useState(wallets[0]?.id);
  const [toId, setToId] = useState(wallets[1]?.id || wallets[0]?.id);
  const [amount, setAmount] = useState("");
  const canSave = fromId && toId && fromId !== toId && Number(amount) > 0;

  return (
    <Modal title="Перевод между кошельками" onClose={onClose} theme={theme}>
      <Field label="Откуда" theme={theme}>
        <select value={fromId} onChange={e => setFromId(e.target.value)} style={inputStyle(theme)}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name} · {fmtMoney(w.balance)}</option>)}
        </select>
      </Field>
      <div className="flex justify-center my-1"><ArrowRight size={16} color={theme.textFaint} style={{ transform: "rotate(90deg)" }} /></div>
      <Field label="Куда" theme={theme}>
        <select value={toId} onChange={e => setToId(e.target.value)} style={inputStyle(theme)}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name} · {fmtMoney(w.balance)}</option>)}
        </select>
      </Field>
      <Field label="Сумма, ₽" theme={theme}>
        <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ ...inputStyle(theme), fontSize: 18, fontFamily: "JetBrains Mono", fontWeight: 600 }} />
      </Field>
      <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, opacity: canSave ? 1 : 0.6 }} onClick={() => canSave && onSave({ fromId, toId, amount: Number(amount) })}>
        Перевести
      </PrimaryButton>
    </Modal>
  );
}

function AddDebtModal({ theme, initial, onClose, onSave }) {
  const [direction, setDirection] = useState(initial?.direction || "owed_to_me");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const canSave = person.trim() && Number(amount) > 0;

  return (
    <Modal title="Новая запись о долге" onClose={onClose} theme={theme}>
      <SegButton theme={theme} value={direction} onChange={setDirection} options={[
        { value: "owed_to_me", label: "Мне должны", color: ACCENT.income }, { value: "i_owe", label: "Я должен", color: ACCENT.expense }
      ]} />
      <div className="mt-4">
        <Field label="Имя человека" theme={theme}>
          <input autoFocus value={person} onChange={e => setPerson(e.target.value)} placeholder="Иван Петров" style={inputStyle(theme)} />
        </Field>
        <Field label="Сумма, ₽" theme={theme}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle(theme)} />
        </Field>
        <Field label="Срок возврата" theme={theme}>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle(theme)} />
        </Field>
        <Field label="Описание" theme={theme}>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="За что долг" style={inputStyle(theme)} />
        </Field>
        <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, background: direction === "owed_to_me" ? ACCENT.income : ACCENT.expense, opacity: canSave ? 1 : 0.6 }} onClick={() => canSave && onSave({ direction, person, amount: Number(amount), dueDate, description })}>
          Сохранить
        </PrimaryButton>
      </div>
    </Modal>
  );
}

function RepayDebtModal({ theme, debt, onClose, onSave }) {
  const remaining = debt.amount - debt.paidAmount;
  const [amount, setAmount] = useState(remaining);
  const canSave = Number(amount) > 0 && Number(amount) <= remaining;

  return (
    <Modal title={`Погашение: ${debt.person}`} onClose={onClose} theme={theme}>
      <p className="text-sm mb-4" style={{ color: theme.textSub }}>Остаток долга: <span className="num font-semibold" style={{ color: theme.text }}>{fmtMoney(remaining)}</span></p>
      <Field label="Сумма погашения, ₽" theme={theme}>
        <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle(theme)} />
      </Field>
      <div className="flex gap-2 mb-2">
        <GhostButton theme={theme} small onClick={() => setAmount(Math.round(remaining / 2))}>Половина</GhostButton>
        <GhostButton theme={theme} small onClick={() => setAmount(remaining)}>Весь остаток</GhostButton>
      </div>
      <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, opacity: canSave ? 1 : 0.6 }} onClick={() => canSave && onSave(Number(amount))}>
        Подтвердить погашение
      </PrimaryButton>
    </Modal>
  );
}

function AddGoalModal({ theme, wallets, onClose, onSave }) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); });
  const [description, setDescription] = useState("");
  const [walletId, setWalletId] = useState(wallets[0]?.id || "");
  const canSave = name.trim() && Number(targetAmount) > 0;

  return (
    <Modal title="Новая финансовая цель" onClose={onClose} theme={theme}>
      <Field label="Название цели" theme={theme}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Купить автомобиль" style={inputStyle(theme)} />
      </Field>
      <Field label="Нужная сумма, ₽" theme={theme}>
        <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="0" style={inputStyle(theme)} />
      </Field>
      <Field label="Дедлайн" theme={theme}>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle(theme)} />
      </Field>
      <Field label="Копить из кошелька" theme={theme}>
        <select value={walletId} onChange={e => setWalletId(e.target.value)} style={inputStyle(theme)}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="Описание" theme={theme}>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Заметка о цели" style={inputStyle(theme)} />
      </Field>
      <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, opacity: canSave ? 1 : 0.6 }} onClick={() => canSave && onSave({ name, targetAmount: Number(targetAmount), deadline, description, walletId })}>
        Создать цель
      </PrimaryButton>
    </Modal>
  );
}

function GoalFundModal({ theme, goal, mode, wallets, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(goal.walletId || wallets[0]?.id);
  const canSave = Number(amount) > 0;

  return (
    <Modal title={mode === "add" ? `Пополнить «${goal.name}»` : `Снять с «${goal.name}»`} onClose={onClose} theme={theme}>
      <Field label="Сумма, ₽" theme={theme}>
        <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle(theme)} />
      </Field>
      <Field label={mode === "add" ? "Списать с кошелька" : "Зачислить на кошелёк"} theme={theme}>
        <select value={walletId} onChange={e => setWalletId(e.target.value)} style={inputStyle(theme)}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name} · {fmtMoney(w.balance)}</option>)}
        </select>
      </Field>
      <PrimaryButton theme={theme} style={{ width: "100%", marginTop: 8, opacity: canSave ? 1 : 0.6 }} onClick={() => canSave && onSave(Number(amount), walletId)}>
        {mode === "add" ? "Пополнить цель" : "Снять средства"}
      </PrimaryButton>
    </Modal>
  );
}
