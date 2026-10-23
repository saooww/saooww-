/**
 * Accounting invariants. Run with `npm test`.
 * Everything here goes through the real store actions and finance helpers.
 */
import "./setup";
import assert from "node:assert/strict";
import { useData, pickData } from "../src/store/store";
import { createDemoData } from "../src/store/seed";
import { migrateFromV1 } from "../src/store/migrate";
import { buildLedger, computeBalances, debtInfo, goalEnvelopes, netWorth, periodRange, periodStats, sumWallets, totalWallets } from "../src/lib/finance";
import { addDays, todayKey } from "../src/lib/dates";
import { formatMoney, parseAmount } from "../src/lib/money";
import type { AppData } from "../src/store/types";
import { safeToSpend } from "../src/lib/safeToSpend";
import { parseCbr, ratesFor } from "../src/lib/rates";
import { monthSummary } from "../src/lib/story";

let passed = 0;
function test(name: string, fn: () => void) {
  useData.getState().replaceAll(createDemoData());
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

const st = () => useData.getState();
const data = (): AppData => pickData(st());
const bal = (id: string) => computeBalances(st().wallets, st().transactions)[id];
const today = todayKey();
const month = () => periodStats(buildLedger(data()).entries, periodRange("month", 0, today), today);

console.log("Капитал — проверка учёта");

test("демо-данные сходятся к 2 480 000 ₽", () => {
  const b = computeBalances(st().wallets, st().transactions);
  const t = sumWallets(totalWallets(st().wallets), b, st().settings);
  assert.equal(t.total, 248_000_000);
  assert.deepEqual(t.missing, []);
});

test("расход уменьшает баланс и попадает в аналитику", () => {
  const before = bal("w-main");
  const exp0 = month().expense;
  st().addTransaction({ kind: "expense", amount: 125_000, walletId: "w-main", categoryId: "c-groceries", date: `${today}T00:01` });
  assert.equal(bal("w-main"), before - 125_000);
  assert.equal(month().expense, exp0 + 125_000);
});

test("перевод меняет оба баланса и не считается доходом или расходом", () => {
  const m0 = bal("w-main");
  const c0 = bal("w-cash");
  const s0 = month();
  st().addTransaction({ kind: "transfer", amount: 1_000_000, walletId: "w-main", toWalletId: "w-cash", date: `${today}T00:02` });
  assert.equal(bal("w-main"), m0 - 1_000_000);
  assert.equal(bal("w-cash"), c0 + 1_000_000);
  const s1 = month();
  assert.equal(s1.income, s0.income);
  assert.equal(s1.expense, s0.expense);
});

test("перевод между валютами зачисляет указанную сумму", () => {
  const u0 = bal("w-usd");
  st().addTransaction({ kind: "transfer", amount: 950_000, toAmount: 10_000, walletId: "w-main", toWalletId: "w-usd", date: `${today}T00:03` });
  assert.equal(bal("w-usd"), u0 + 10_000);
});

test("редактирование и удаление пересчитывают баланс", () => {
  const before = bal("w-main");
  const id = st().addTransaction({ kind: "expense", amount: 50_000, walletId: "w-main", categoryId: "c-cafe", date: `${today}T00:04` });
  st().updateTransaction(id, { amount: 80_000 });
  assert.equal(bal("w-main"), before - 80_000);
  st().updateTransaction(id, { kind: "income", categoryId: "i-other" });
  assert.equal(bal("w-main"), before + 80_000);
  st().deleteTransaction(id);
  assert.equal(bal("w-main"), before);
});

test("валюта без курса не складывается с рублями", () => {
  const { [`USD`]: _, ...rest } = st().settings.rates;
  st().updateSettings({ rates: rest });
  const t = sumWallets(totalWallets(st().wallets), computeBalances(st().wallets, st().transactions), st().settings);
  assert.deepEqual(t.missing, ["USD"]);
  assert.equal(t.total, 248_000_000 - 22_800_000);
});

test("долг: выдача и возврат двигают деньги, но не аналитику; полный возврат закрывает", () => {
  const m0 = bal("w-main");
  const s0 = month();
  const id = st().addDebt({ direction: "owed_to_me", counterparty: "Тест", amount: 300_000, currency: "RUB", date: today }, "w-main");
  assert.equal(bal("w-main"), m0 - 300_000);
  st().payDebt(id, 100_000, "w-main");
  let info = debtInfo(st().debts.find((d) => d.id === id)!, st().transactions, today);
  assert.equal(info.remaining, 200_000);
  st().payDebt(id, 200_000, "w-main");
  info = debtInfo(st().debts.find((d) => d.id === id)!, st().transactions, today);
  assert.equal(info.status, "closed");
  assert.equal(bal("w-main"), m0);
  assert.equal(month().expense, s0.expense);
  assert.equal(month().income, s0.income);
});

test("цель с собственным балансом: деньги переносятся, капитал не меняется", () => {
  const nw0 = netWorth(data(), computeBalances(st().wallets, st().transactions), today).total;
  const m0 = bal("w-main");
  const e0 = goalEnvelopes(st().transactions)["g-japan"] ?? 0;
  st().moveGoalMoney("g-japan", "w-main", 1_500_000, "deposit");
  assert.equal(bal("w-main"), m0 - 1_500_000);
  assert.equal(goalEnvelopes(st().transactions)["g-japan"], e0 + 1_500_000);
  const nw1 = netWorth(data(), computeBalances(st().wallets, st().transactions), today).total;
  assert.equal(nw1, nw0);
});

test("удаление цели возвращает деньги в кошельки", () => {
  const before = computeBalances(st().wallets, st().transactions);
  const env = goalEnvelopes(st().transactions)["g-japan"];
  st().deleteGoal("g-japan");
  const after = computeBalances(st().wallets, st().transactions);
  assert.equal(after["w-main"] - before["w-main"], env);
});

test("регулярный платёж записывается в срок и сдвигает следующую дату", () => {
  st().updateRecurring("r-plus", { nextDate: addDays(today, -40) });
  const created = st().processRecurring(today);
  assert.ok(created.length >= 2);
  const r = st().recurring.find((x) => x.id === "r-plus")!;
  assert.ok(r.nextDate > today);
  assert.equal(st().processRecurring(today).length, 0, "повторный запуск ничего не дублирует");
});

test("план: проведение создаёт операцию, возврат в план её удаляет", () => {
  const before = bal("w-main");
  const txId = st().completePlan("p-osago");
  assert.ok(txId);
  assert.equal(bal("w-main"), before - 980_000);
  st().setPlanStatus("p-osago", "planned");
  assert.equal(bal("w-main"), before);
  assert.equal(st().transactions.some((t) => t.id === txId), false);
});

test("удаление кошелька не меняет балансы других кошельков", () => {
  const before = computeBalances(st().wallets, st().transactions);
  st().deleteWallet("w-cash");
  const after = computeBalances(st().wallets, st().transactions);
  for (const id of Object.keys(after)) assert.equal(after[id], before[id], id);
});

test("корректировка баланса задаёт точное значение", () => {
  st().setWalletBalance("w-main", 10_000_000);
  assert.equal(bal("w-main"), 10_000_000);
  const s = month();
  st().setWalletBalance("w-main", 5_000_000);
  assert.equal(month().expense, s.expense, "корректировка — не расход");
});

test("отмена возвращает предыдущее состояние", () => {
  const snapshot = pickData(st());
  const before = bal("w-main");
  st().deleteWallet("w-main");
  st().replaceAll(snapshot);
  assert.equal(bal("w-main"), before);
});

test("задача с повтором создаёт следующую", () => {
  const n = st().tasks.length;
  st().toggleTask("k-2");
  assert.equal(st().tasks.length, n + 1);
  const next = st().tasks[0];
  assert.equal(next.done, false);
  assert.ok(next.due! > addDays(today, 2));
});

test("перенос данных первой версии сохраняет балансы", () => {
  const v1 = {
    wallets: [
      { id: "w1", name: "Карта", icon: "CreditCard", color: "#000", balance: 84500 },
      { id: "w2", name: "Наличные", icon: "Banknote", color: "#000", balance: 12300 }
    ],
    transactions: [
      { id: "a", type: "income", amount: 130000, walletId: "w1", category: "Зарплата", description: "Зарплата", tags: [], date: new Date().toISOString() },
      { id: "b", type: "expense", amount: 3200, walletId: "w1", category: "Еда", description: "Продукты", tags: ["дом"], date: new Date().toISOString() },
      { id: "c", type: "expense", amount: 850, walletId: "w2", category: "Семья", description: "", tags: [], date: new Date().toISOString() }
    ],
    debts: [{ direction: "owed_to_me", person: "Иван", amount: 15000, paidAmount: 5000, history: [{ amount: 5000, date: new Date().toISOString() }], status: "active" }],
    goals: [{ name: "Авто", targetAmount: 900000, savedAmount: 210000 }],
    isDark: true
  };
  const m = migrateFromV1(JSON.stringify(v1))!;
  const b = computeBalances(m.wallets, m.transactions);
  assert.equal(b["w1"], 8_450_000);
  assert.equal(b["w2"], 1_230_000);
  assert.ok(m.categories.some((c) => c.name === "Семья"));
  assert.equal(debtInfo(m.debts[0], m.transactions, today).remaining, 1_000_000);
  assert.equal(goalEnvelopes(m.transactions)[m.goals[0].id], 21_000_000);
});

test("ввод и формат сумм", () => {
  assert.equal(parseAmount("1250,5"), 125_050);
  assert.equal(parseAmount("0,07"), 7);
  assert.equal(formatMoney(248_000_000), "2 480 000 ₽");
  assert.equal(formatMoney(-125_050), "−1 250,50 ₽");
});

/* ---------------- new in 2.1 ---------------- */

const safe = () => safeToSpend(data(), computeBalances(st().wallets, st().transactions), buildLedger(data()).entries, today)!;
const nowTime = () => `${today}T12:00`;

test("«можно потратить сегодня» уменьшается ровно на сегодняшнюю трату", () => {
  const before = safe();
  st().addTransaction({ kind: "expense", amount: 123_400, walletId: "w-main", categoryId: "c-cafe", date: nowTime() });
  const after = safe();
  assert.equal(after.today, before.today - 123_400);
  assert.equal(after.allowance, before.allowance);
});

test("перевод между своими кошельками не меняет «можно потратить»", () => {
  const before = safe();
  st().addTransaction({ kind: "transfer", amount: 500_000, walletId: "w-main", toWalletId: "w-cash", date: nowTime() });
  assert.equal(safe().today, before.today);
});

test("доход сегодня увеличивает норму на день", () => {
  const before = safe();
  st().addTransaction({ kind: "income", amount: 3_000_000, walletId: "w-main", categoryId: "i-freelance", date: nowTime() });
  const after = safe();
  if (after.basis === "cash") assert.ok(after.allowance > before.allowance);
  else assert.ok(after.allowance >= before.allowance);
});

test("разделённый чек: части в своих категориях, сумма сходится", () => {
  const b0 = bal("w-main");
  const m0 = month();
  const splitId = "s-test";
  st().addTransaction({ kind: "expense", amount: 300_000, walletId: "w-main", categoryId: "c-groceries", date: nowTime(), splitId });
  st().addTransaction({ kind: "expense", amount: 45_000, walletId: "w-main", categoryId: "c-home", date: nowTime(), splitId });
  const m1 = month();
  assert.equal(bal("w-main"), b0 - 345_000);
  assert.equal(m1.expense - m0.expense, 345_000);
  assert.equal((m1.expenseByCategory.get("c-groceries") ?? 0) - (m0.expenseByCategory.get("c-groceries") ?? 0), 300_000);
  assert.equal((m1.expenseByCategory.get("c-home") ?? 0) - (m0.expenseByCategory.get("c-home") ?? 0), 45_000);
});

test("курсы ЦБ: разбор ответа и пересчёт в основную валюту", () => {
  const cbr = parseCbr({ Date: "2026-10-23T11:30:00+03:00", Valute: { USD: { CharCode: "USD", Nominal: 1, Value: 81.5 }, AMD: { CharCode: "AMD", Nominal: 100, Value: 21.2 }, EUR: { CharCode: "EUR", Nominal: 1, Value: 94.1 } } });
  assert.equal(cbr.date, "2026-10-23");
  assert.deepEqual(ratesFor("RUB", ["USD", "AMD", "RUB", "XXX"], cbr.rub), { USD: 81.5, AMD: 0.212 });
  // Base in dollars: a euro is EUR/USD, a rouble is 1/USD.
  const r = ratesFor("USD", ["EUR", "RUB"], cbr.rub);
  assert.equal(r.EUR, Math.round((94.1 / 81.5) * 1e6) / 1e6);
  assert.equal(r.RUB, Math.round((1 / 81.5) * 1e6) / 1e6);
});

test("итоги месяца сходятся с аналитикой", () => {
  const prevMonthDay = addDays(today.slice(0, 8) + "01", -1);
  const s = monthSummary(buildLedger(data()).entries, new Map(st().categories.map((c) => [c.id, c])), prevMonthDay, today);
  const stats = periodStats(buildLedger(data()).entries, periodRange("month", -1, today), today);
  assert.equal(s.expense, stats.expense);
  assert.equal(s.income, stats.income);
  assert.ok(s.top.length > 0 && s.top[0].amount >= (s.top[1]?.amount ?? 0));
  assert.ok(s.biggest && s.biggest.amount > 0);
});

console.log(`\nВсе проверки пройдены: ${passed}`);
