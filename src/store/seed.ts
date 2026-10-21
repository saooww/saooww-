import { addDays, addMonths, endOfMonth, nowISO, parseDay, todayKey, type DayKey } from "../lib/dates";
import { mulberry32 } from "../lib/id";
import { computeBalances } from "../lib/finance";
import { nextAfter } from "../lib/recurrence";
import { defaultCategories } from "./catalog";
import type { AppData, Budget, Debt, Favorite, Goal, Note, Plan, Recurring, Settings, Task, Transaction, Wallet } from "./types";

export function defaultSettings(): Settings {
  return {
    name: "",
    baseCurrency: "RUB",
    rates: { USD: 95, EUR: 103, CNY: 13.2 },
    theme: "dark",
    animations: true,
    haptics: true,
    dateStyle: "short",
    numberFormat: "ru",
    kopecks: "auto",
    hideAmounts: false,
    hideOnLaunch: false,
    autoBackup: true
  };
}

/** A clean slate: default categories, one empty wallet, nothing else. */
export function createEmptyData(): AppData {
  const now = nowISO();
  return {
    wallets: [
      {
        id: "w-main",
        name: "Основная карта",
        kind: "card",
        currency: "RUB",
        style: "graphite",
        openingBalance: 0,
        includeInTotal: true,
        createdAt: now
      }
    ],
    transactions: [],
    categories: defaultCategories(),
    budgets: [],
    goals: [],
    recurring: [],
    plans: [],
    debts: [],
    tasks: [],
    notes: [],
    favorites: [],
    settings: { ...defaultSettings(), defaultWalletId: "w-main" },
    meta: { demo: false, createdAt: now }
  };
}

const rub = (major: number) => Math.round(major * 100);

/**
 * Seven months of believable history in roubles, generated deterministically
 * relative to today. Wallet balances are then pinned to round targets by
 * solving for each wallet's opening balance.
 */
export function createDemoData(today: DayKey = todayKey()): AppData {
  const rnd = mulberry32(20261021);
  const between = (a: number, b: number, step = 10) => Math.round((a + rnd() * (b - a)) / step) * step;
  const chance = (p: number) => rnd() < p;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  const now = nowISO();
  const nowTime = now.slice(11, 16);
  const created = `${addMonths(today, -7, 1)}T09:00`;

  const wallets: Wallet[] = [
    { id: "w-main", name: "Основная карта", kind: "card", currency: "RUB", style: "ember", ident: "4821", openingBalance: 0, includeInTotal: true, createdAt: created },
    { id: "w-cash", name: "Наличные", kind: "cash", currency: "RUB", style: "sand", openingBalance: 0, includeInTotal: true, createdAt: created },
    { id: "w-savings", name: "Накопительный счёт", kind: "savings", currency: "RUB", style: "titanium", ident: "7710", openingBalance: 0, includeInTotal: true, createdAt: created },
    { id: "w-broker", name: "Брокерский счёт", kind: "investment", currency: "RUB", style: "midnight", ident: "ИИС", openingBalance: 0, includeInTotal: true, createdAt: created },
    { id: "w-usd", name: "Валютный счёт", kind: "bank", currency: "USD", style: "ivory", ident: "0392", openingBalance: 0, includeInTotal: true, createdAt: created }
  ];

  const targets: Record<string, number> = {
    "w-main": rub(184_350),
    "w-cash": rub(12_400),
    "w-savings": rub(1_420_000),
    "w-broker": rub(635_250),
    "w-usd": rub(2_400) // $2 400 × 95 = 228 000 ₽ → total 2 480 000 ₽
  };

  const recurring: Recurring[] = [
    { id: "r-advance", kind: "income", title: "Аванс", amount: rub(72_000), walletId: "w-main", categoryId: "i-salary", freq: "month", interval: 1, anchorDay: 10, nextDate: "", autoPost: true, isSubscription: false, active: true, createdAt: created },
    { id: "r-salary", kind: "income", title: "Зарплата", amount: rub(118_000), walletId: "w-main", categoryId: "i-salary", freq: "month", interval: 1, anchorDay: 25, nextDate: "", autoPost: true, isSubscription: false, active: true, createdAt: created },
    { id: "r-mobile", kind: "expense", title: "Мобильная связь", amount: rub(590), walletId: "w-main", categoryId: "c-connect", freq: "month", interval: 1, anchorDay: 5, nextDate: "", autoPost: true, isSubscription: false, active: true, createdAt: created },
    { id: "r-internet", kind: "expense", title: "Домашний интернет", amount: rub(750), walletId: "w-main", categoryId: "c-connect", freq: "month", interval: 1, anchorDay: 18, nextDate: "", autoPost: true, isSubscription: false, active: true, createdAt: created },
    { id: "r-plus", kind: "expense", title: "Яндекс Плюс", amount: rub(449), walletId: "w-main", categoryId: "c-subs", freq: "month", interval: 1, anchorDay: 7, nextDate: "", autoPost: true, isSubscription: true, usage: "often", active: true, createdAt: created },
    { id: "r-cloud", kind: "expense", title: "Облачное хранилище", amount: rub(149), walletId: "w-main", categoryId: "c-subs", freq: "month", interval: 1, anchorDay: 15, nextDate: "", autoPost: true, isSubscription: true, usage: "often", active: true, createdAt: created },
    { id: "r-cinema", kind: "expense", title: "Онлайн-кинотеатр", amount: rub(399), walletId: "w-main", categoryId: "c-subs", freq: "month", interval: 1, anchorDay: 22, nextDate: "", autoPost: true, isSubscription: true, usage: "rarely", active: true, createdAt: created },
    { id: "r-fitness", kind: "expense", title: "Фитнес-клуб", amount: rub(3_900), walletId: "w-main", categoryId: "c-sport", freq: "month", interval: 1, anchorDay: 1, nextDate: "", autoPost: true, isSubscription: true, usage: "never", active: true, createdAt: created },
    { id: "r-save", kind: "transfer", title: "Откладываю на подушку", amount: rub(30_000), walletId: "w-main", toWalletId: "w-savings", freq: "month", interval: 1, anchorDay: 26, nextDate: "", autoPost: true, isSubscription: false, active: true, createdAt: created }
  ];

  const txs: Transaction[] = [];
  let seq = 0;
  const time = (day: DayKey, h0 = 8, h1 = 22) => {
    let t: string;
    do {
      const h = Math.floor(h0 + rnd() * (h1 - h0));
      const m = Math.floor(rnd() * 60);
      t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    } while (day === today && t > nowTime && h0 < Number(nowTime.slice(0, 2)));
    return `${day}T${t}`;
  };
  const push = (day: DayKey, tx: Omit<Transaction, "id" | "createdAt" | "tags" | "date"> & { tags?: string[]; at?: string }) => {
    const date = tx.at ?? time(day);
    if (day === today && date.slice(11, 16) > nowTime) return;
    const { at: _at, ...rest } = tx;
    txs.push({ tags: [], ...rest, id: `t-${(seq++).toString(36)}`, date, createdAt: date });
  };

  const start = addMonths(today, -7, 1);
  const tripMonth = addMonths(today, -4, 1).slice(0, 7);
  let fuelIn = 3;
  let petIn = 5;
  let beautyIn = 9;

  for (let day = start; day <= today; day = addDays(day, 1)) {
    const d = parseDay(day);
    const dom = d.getDate();
    const dow = (d.getDay() + 6) % 7;
    const weekend = dow >= 5;

    // Recurring series that already happened
    for (const r of recurring) {
      if (dom !== r.anchorDay) continue;
      if (r.kind === "transfer") {
        push(day, { kind: "transfer", amount: r.amount, walletId: r.walletId, toWalletId: r.toWalletId, note: r.title, recurringId: r.id, at: `${day}T10:00` });
      } else {
        push(day, { kind: r.kind, amount: r.amount, walletId: r.walletId, categoryId: r.categoryId, note: r.title, recurringId: r.id, at: `${day}T${r.kind === "income" ? "09:30" : "07:15"}` });
      }
    }

    // Groceries
    if (chance(weekend ? 0.55 : 0.32)) {
      push(day, { kind: "expense", amount: rub(between(640, weekend ? 5200 : 3400)), walletId: chance(0.88) ? "w-main" : "w-cash", categoryId: "c-groceries", note: pick(["ВкусВилл", "Перекрёсток", "Доставка продуктов", "Рынок", "Пекарня", "Овощи и фрукты"]) });
    }
    // Coffee and cafés
    if (chance(weekend ? 0.3 : 0.5)) {
      const coffee = chance(0.55);
      push(day, {
        kind: "expense",
        amount: rub(coffee ? between(220, 420) : between(520, 2600)),
        walletId: chance(0.85) ? "w-main" : "w-cash",
        categoryId: "c-cafe",
        note: coffee ? "Кофе" : pick(["Бизнес-ланч", "Обед", "Ужин", "Завтрак", "Суши"])
      });
    }
    // Transport
    if (!weekend && chance(0.12)) push(day, { kind: "expense", amount: rub(pick([1500, 1000, 2000])), walletId: "w-main", categoryId: "c-transport", note: "Пополнение «Тройки»" });
    if (chance(weekend ? 0.18 : 0.2)) push(day, { kind: "expense", amount: rub(between(320, 1380)), walletId: "w-main", categoryId: "c-taxi", note: pick(["Такси", "Такси до офиса", "Такси домой"]) });
    if (--fuelIn <= 0) {
      fuelIn = 9 + Math.floor(rnd() * 4);
      push(day, { kind: "expense", amount: rub(between(3200, 4600)), walletId: "w-main", categoryId: "c-car", note: "АЗС" });
    }
    if (chance(0.025)) push(day, { kind: "expense", amount: rub(between(200, 600)), walletId: "w-main", categoryId: "c-car", note: "Парковка" });
    // Home
    if (dom === 12) push(day, { kind: "expense", amount: rub(between(7200, 9400)), walletId: "w-main", categoryId: "c-home", note: "Квартплата и коммунальные" });
    if (chance(0.04)) push(day, { kind: "expense", amount: rub(between(600, 3600)), walletId: "w-main", categoryId: "c-home", note: pick(["Хозтовары", "Для дома", "Ремонт"]) });
    // Health & body
    if (chance(0.045)) push(day, { kind: "expense", amount: rub(between(450, 3800)), walletId: "w-main", categoryId: "c-health", note: pick(["Аптека", "Анализы", "Витамины"]) });
    if (--beautyIn <= 0) {
      beautyIn = 24 + Math.floor(rnd() * 6);
      push(day, { kind: "expense", amount: rub(2200), walletId: "w-main", categoryId: "c-beauty", note: "Барбершоп" });
    }
    if (--petIn <= 0) {
      petIn = 13 + Math.floor(rnd() * 3);
      push(day, { kind: "expense", amount: rub(between(1700, 2300)), walletId: "w-main", categoryId: "c-pets", note: "Корм для кота" });
    }
    // Lifestyle
    if (chance(0.055)) push(day, { kind: "expense", amount: rub(between(1500, 13_900, 100)), walletId: "w-main", categoryId: "c-shopping", note: pick(["Маркетплейс", "Электроника", "Книги", "Товары для дома"]) });
    if (chance(0.025)) push(day, { kind: "expense", amount: rub(between(2900, 11_900, 100)), walletId: "w-main", categoryId: "c-clothes", note: pick(["Кроссовки", "Куртка", "Одежда"]) });
    if (chance(weekend ? 0.14 : 0.04)) push(day, { kind: "expense", amount: rub(between(600, 3800)), walletId: chance(0.7) ? "w-main" : "w-cash", categoryId: "c-fun", note: pick(["Кино", "Концерт", "Боулинг", "Музей", "Театр"]) });
    if (chance(0.02)) push(day, { kind: "expense", amount: rub(between(1500, 6000, 100)), walletId: "w-main", categoryId: "c-gifts", note: pick(["Подарок маме", "Подарок другу", "Цветы"]) });

    // One trip, four months ago
    if (day.slice(0, 7) === tripMonth && dom === 8) {
      push(day, { kind: "expense", amount: rub(38_400), walletId: "w-main", categoryId: "c-travel", note: "Авиабилеты в Казань", tags: ["отпуск"] });
      push(day, { kind: "expense", amount: rub(24_600), walletId: "w-main", categoryId: "c-travel", note: "Отель, 4 ночи", tags: ["отпуск"] });
    }

    // Income beyond salary
    if (dom === 3) push(day, { kind: "income", amount: rub(between(900, 2400)), walletId: "w-main", categoryId: "i-cashback", note: "Кешбэк за месяц" });
    if (dom === 1) push(day, { kind: "income", amount: rub(between(17_800, 19_600)), walletId: "w-savings", categoryId: "i-invest", note: "Проценты по накопительному счёту" });
    if (chance(0.045)) push(day, { kind: "income", amount: rub(between(12_000, 42_000, 500)), walletId: "w-main", categoryId: "i-freelance", note: pick(["Дизайн лендинга", "Консультация", "Проект для студии"]) });
    if ([2, 5, 8, 11].includes(d.getMonth()) && dom === 20) push(day, { kind: "income", amount: rub(between(6400, 11_000)), walletId: "w-broker", categoryId: "i-invest", note: "Дивиденды" });

    // Own transfers
    if (dom === 11) push(day, { kind: "transfer", amount: rub(10_000), walletId: "w-main", toWalletId: "w-cash", note: "Снятие наличных" });
    if (dom === 14 && d.getMonth() % 2 === 0) push(day, { kind: "transfer", amount: rub(25_000), walletId: "w-main", toWalletId: "w-broker", note: "Пополнение брокерского счёта" });

    // Money set aside for goals
    if (dom === 27) push(day, { kind: "goal", flow: "out", amount: rub(25_000), walletId: "w-main", goalId: "g-japan", note: "Отпуск в Японии", at: `${day}T11:00` });
  }

  // Foreign-currency activity
  const usdDays = [addDays(today, -150), addDays(today, -88), addDays(today, -31)];
  usdDays.forEach((day, i) => push(day, { kind: "income", amount: [35_000, 42_000, 38_000][i], walletId: "w-usd", categoryId: "i-freelance", note: "Зарубежный клиент", at: `${day}T16:20` }));
  push(addDays(today, -40), { kind: "expense", amount: 4_500, walletId: "w-usd", categoryId: "c-education", note: "Онлайн-курс", at: `${addDays(today, -40)}T20:05` });

  // Goals
  push(start, { kind: "goal", flow: "out", amount: rub(20_000), walletId: "w-main", goalId: "g-japan", note: "Отпуск в Японии", at: `${start}T12:00` });
  push(addDays(today, -95), { kind: "goal", flow: "out", amount: rub(60_000), walletId: "w-savings", goalId: "g-car", note: "Новый автомобиль", at: `${addDays(today, -95)}T12:00` });
  push(addDays(today, -35), { kind: "goal", flow: "out", amount: rub(60_000), walletId: "w-savings", goalId: "g-car", note: "Новый автомобиль", at: `${addDays(today, -35)}T12:00` });

  // Debts
  const debts: Debt[] = [
    { id: "d-andrey", direction: "owed_to_me", counterparty: "Андрей", amount: rub(25_000), currency: "RUB", date: addDays(today, -41), dueDate: addDays(today, 12), note: "На ремонт машины", createdAt: created },
    { id: "d-olga", direction: "i_owe", counterparty: "Ольга", amount: rub(8_000), currency: "RUB", date: addDays(today, -9), dueDate: addDays(today, 3), note: "Билеты на концерт", createdAt: created },
    { id: "d-dmitry", direction: "owed_to_me", counterparty: "Дмитрий", amount: rub(5_000), currency: "RUB", date: addDays(today, -70), dueDate: addDays(today, -40), createdAt: created, closedAt: `${addDays(today, -50)}T18:00` }
  ];
  push(addDays(today, -41), { kind: "debt", debtId: "d-andrey", debtRole: "open", flow: "out", amount: rub(25_000), walletId: "w-main", note: "Андрей", at: `${addDays(today, -41)}T19:10` });
  push(addDays(today, -12), { kind: "debt", debtId: "d-andrey", debtRole: "payment", flow: "in", amount: rub(10_000), walletId: "w-main", note: "Андрей вернул часть", at: `${addDays(today, -12)}T13:40` });
  push(addDays(today, -9), { kind: "debt", debtId: "d-olga", debtRole: "open", flow: "in", amount: rub(8_000), walletId: "w-cash", note: "Ольга", at: `${addDays(today, -9)}T21:00` });
  push(addDays(today, -70), { kind: "debt", debtId: "d-dmitry", debtRole: "open", flow: "out", amount: rub(5_000), walletId: "w-main", note: "Дмитрий", at: `${addDays(today, -70)}T15:00` });
  push(addDays(today, -50), { kind: "debt", debtId: "d-dmitry", debtRole: "payment", flow: "in", amount: rub(5_000), walletId: "w-main", note: "Дмитрий вернул", at: `${addDays(today, -50)}T18:00` });

  // A plan that has already been carried out
  const doneTaxDay = addDays(today, -20);
  push(doneTaxDay, { kind: "expense", amount: rub(4_300), walletId: "w-main", categoryId: "c-home", note: "Налог на имущество", planId: "p-tax", at: `${doneTaxDay}T12:30` });

  // A one-off sale
  push(addDays(today, -58), { kind: "income", amount: rub(18_000), walletId: "w-cash", categoryId: "i-sale", note: "Продажа велосипеда", at: `${addDays(today, -58)}T17:45` });

  // Pin balances: opening = target − Σ effects
  const flows = computeBalances(wallets, txs);
  for (const w of wallets) w.openingBalance = targets[w.id] - flows[w.id];

  // Next due date for every series
  for (const r of recurring) {
    let d = `${today.slice(0, 8)}${String(r.anchorDay).padStart(2, "0")}`;
    if (d <= today) d = nextAfter(d, r.freq, r.interval, r.anchorDay);
    r.nextDate = d;
  }

  const goals: Goal[] = [
    { id: "g-japan", name: "Отпуск в Японии", icon: "Plane", target: rub(450_000), currency: "RUB", deadline: addMonths(today, 7), primary: true, createdAt: created },
    { id: "g-cushion", name: "Финансовая подушка", icon: "LifeBuoy", target: rub(1_800_000), currency: "RUB", walletId: "w-savings", createdAt: created },
    { id: "g-car", name: "Новый автомобиль", icon: "Car", target: rub(3_200_000), currency: "RUB", deadline: addMonths(today, 30), createdAt: created }
  ];

  const budgets: Budget[] = [
    { id: "b-all", categoryId: null, limit: rub(140_000), createdAt: created },
    { id: "b-groceries", categoryId: "c-groceries", limit: rub(32_000), createdAt: created },
    { id: "b-cafe", categoryId: "c-cafe", limit: rub(11_000), createdAt: created },
    { id: "b-taxi", categoryId: "c-taxi", limit: rub(6_000), createdAt: created },
    { id: "b-shopping", categoryId: "c-shopping", limit: rub(15_000), createdAt: created },
    { id: "b-fun", categoryId: "c-fun", limit: rub(8_000), createdAt: created }
  ];

  const plans: Plan[] = [
    { id: "p-osago", kind: "expense", title: "Страховка ОСАГО", amount: rub(9_800), date: addDays(today, 12), walletId: "w-main", categoryId: "c-car", status: "planned", createdAt: created },
    { id: "p-service", kind: "expense", title: "ТО автомобиля", amount: rub(16_500), date: addDays(today, 24), walletId: "w-main", categoryId: "c-car", status: "planned", createdAt: created },
    { id: "p-bonus", kind: "income", title: "Квартальная премия", amount: rub(60_000), date: addDays(endOfMonth(today), 10), walletId: "w-main", categoryId: "i-salary", status: "planned", createdAt: created },
    { id: "p-tickets", kind: "expense", title: "Авиабилеты в Токио", amount: rub(96_000), date: addDays(today, 70), walletId: "w-main", categoryId: "c-travel", note: "Брать заранее — дешевле", status: "planned", createdAt: created },
    { id: "p-tax", kind: "expense", title: "Налог на имущество", amount: rub(4_300), date: doneTaxDay, walletId: "w-main", categoryId: "c-home", status: "done", txId: txs.find((t) => t.planId === "p-tax")?.id, createdAt: created }
  ];

  const nextDay27 = (() => {
    let d = `${today.slice(0, 8)}27`;
    if (d < today) d = addMonths(d, 1, 27);
    return d;
  })();

  const tasks: Task[] = [
    { id: "k-1", title: "Вернуть долг Ольге", due: addDays(today, 3), priority: 2, repeat: "none", done: false, createdAt: now },
    { id: "k-2", title: "Оплатить коммунальные услуги", due: addDays(today, 2), priority: 1, repeat: "month", done: false, createdAt: now },
    { id: "k-3", title: "Проверить подписки", note: "В фитнес-клуб не хожу с лета — отменить или заморозить", due: addDays(today, 5), priority: 1, repeat: "none", done: false, createdAt: now },
    { id: "k-4", title: "Отложить 25 000 ₽ на отпуск", due: nextDay27, priority: 1, repeat: "month", done: false, createdAt: now },
    { id: "k-5", title: "Пересмотреть бюджет на следующий месяц", due: endOfMonth(today), priority: 0, repeat: "month", done: false, createdAt: now },
    { id: "k-6", title: "Заказать справку для налогового вычета", priority: 0, repeat: "none", done: false, createdAt: now },
    { id: "k-7", title: "Подать декларацию 3-НДФЛ", due: addDays(today, -6), priority: 1, repeat: "none", done: true, doneAt: `${addDays(today, -6)}T20:00`, createdAt: now }
  ];

  const notes: Note[] = [
    {
      id: "n-1",
      title: "Как я распределяю доход",
      body: "50% — обязательные расходы: дом, связь, продукты, транспорт.\n30% — жизнь: кафе, развлечения, покупки.\n20% — будущее: подушка, отпуск, автомобиль.\n\nОткладываю в день зарплаты, а не в конце месяца.",
      pinned: true,
      tags: ["бюджет"],
      links: [{ type: "goal", id: "g-cushion" }],
      createdAt: `${addDays(today, -60)}T21:00`,
      updatedAt: `${addDays(today, -4)}T22:10`
    },
    {
      id: "n-2",
      title: "Япония: смета",
      body: "Билеты — около 96 000 ₽ на двоих.\nЖильё — 12 ночей, ~180 000 ₽.\nJR Pass — 45 000 ₽.\nЕда и транспорт — 90 000 ₽.\nЗапас — 40 000 ₽.",
      pinned: false,
      tags: ["отпуск"],
      links: [{ type: "goal", id: "g-japan" }, { type: "plan", id: "p-tickets" }],
      createdAt: `${addDays(today, -30)}T20:15`,
      updatedAt: `${addDays(today, -2)}T23:05`
    },
    {
      id: "n-3",
      title: "Налоговый вычет",
      body: "Лечение зубов и спорт — до 150 000 ₽ расходов в год.\nНужны: справка об оплате, лицензия клиники, договор.",
      pinned: false,
      tags: ["налоги"],
      links: [{ type: "task", id: "k-6" }],
      createdAt: `${addDays(today, -15)}T19:40`,
      updatedAt: `${addDays(today, -15)}T19:40`
    },
    {
      id: "n-4",
      title: "Где можно сэкономить",
      body: "Кофе навынос — ~6 000 ₽ в месяц. Взять термокружку.\nТакси по утрам заменить метро.\nФитнес-клуб не использую — заморозить.",
      pinned: false,
      tags: ["экономия"],
      links: [],
      createdAt: `${addDays(today, -8)}T09:30`,
      updatedAt: `${addDays(today, -8)}T09:30`
    }
  ];

  const favorites: Favorite[] = [
    { id: "f-coffee", kind: "expense", title: "Кофе", amount: rub(290), walletId: "w-main", categoryId: "c-cafe", note: "Кофе" },
    { id: "f-lunch", kind: "expense", title: "Бизнес-ланч", amount: rub(650), walletId: "w-main", categoryId: "c-cafe", note: "Бизнес-ланч" },
    { id: "f-taxi", kind: "expense", title: "Такси до офиса", amount: rub(540), walletId: "w-main", categoryId: "c-taxi", note: "Такси до офиса" },
    { id: "f-groceries", kind: "expense", title: "Продукты", walletId: "w-main", categoryId: "c-groceries" }
  ];

  txs.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    wallets,
    transactions: txs,
    categories: defaultCategories(),
    budgets,
    goals,
    recurring,
    plans,
    debts,
    tasks,
    notes,
    favorites,
    settings: { ...defaultSettings(), name: "Алекс", defaultWalletId: "w-main" },
    meta: { demo: true, createdAt: now }
  };
}

