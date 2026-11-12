/**
 * Financial correctness on a fixed, hand-made book (no demo data, no «today»
 * from the clock). Each scenario states the money that should move and
 * checks every place that reports it: balances, net worth, analytics,
 * debts, goals and the forecast.
 *
 * `known()` records a defect that is understood but not fixed yet: it runs,
 * reports «known issue» while it fails and «fixed» once it passes, and never
 * breaks the run. Everything under `test()` must pass.
 */
import "./setup";
import assert from "node:assert/strict";
import { pickData, useData } from "../src/store/store";
import { createEmptyData } from "../src/store/seed";
import type { AppData, Plan, Recurring, Wallet } from "../src/store/types";
import { buildLedger, computeBalances, debtInfo, netWorth, periodRange, periodStats, sumWallets, toBase, totalWallets } from "../src/lib/finance";
import { capitalChange, capitalForecast, freeCash, monthForecast, scheduledBetween } from "../src/lib/analytics";
import { nextMonthPlan, nextSlot, planItems, planLeft, planReceived, planSchedule, planSurplus } from "../src/lib/plans";
import { debtPeople, splitRepayment } from "../src/lib/debts";
import { goalInfo, goalSaved, goalEnvelopes } from "../src/lib/finance";
import { goalPace, goalWhatIf, whatIfSteps } from "../src/lib/goals";
import { amountToInput, parseAmount } from "../src/lib/money";
import { addDays, addMonths, diffDays, endOfMonth, startOfMonth } from "../src/lib/dates";
import { nextAfter, occurrencesInRange } from "../src/lib/recurrence";

let passed = 0;
let knownIssues = 0;
const T0 = "2027-01-15";
const st = () => useData.getState();
const data = (): AppData => pickData(st());
const bal = () => computeBalances(st().wallets, st().transactions);
const nw = (today = T0) => netWorth(data(), bal(), today);
const month = (today = T0) => periodStats(buildLedger(data()).entries, periodRange("month", 0, today), today);

const W = (id: string, currency = "RUB", opening = 0, kind: Wallet["kind"] = "card"): Wallet => ({ id, name: id, kind, currency, style: "graphite", openingBalance: opening, includeInTotal: true, createdAt: "2026-12-01T10:00" });

function fresh() {
  const d = createEmptyData();
  d.wallets = [W("card", "RUB", 10_000_000), W("cash", "RUB", 500_000, "cash"), W("usd", "USD", 100_000, "bank"), W("save", "RUB", 0, "savings")];
  d.settings = { ...d.settings, baseCurrency: "RUB", rates: { USD: 95, EUR: 103 }, defaultWalletId: "card" };
  st().replaceAll(d);
}

function test(name: string, fn: () => void) {
  fresh();
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

function known(name: string, fn: () => void) {
  fresh();
  try {
    fn();
    console.log(`  ✓ ${name} — исправлено, перенести в test()`);
    passed++;
  } catch (e) {
    knownIssues++;
    console.log(`  ⚠ известная проблема: ${name}\n      ${String((e as Error).message).split("\n")[0]}`);
  }
}

console.log("Ardessa — финансовая корректность (фиксированная книга)");

/* ---------------- balances ---------------- */

test("баланс = начальный остаток + все записи; правка и удаление старой записи пересчитывают его", () => {
  const id = st().addTransaction({ kind: "expense", amount: 123_45, walletId: "card", date: "2026-12-20T12:00" });
  st().addTransaction({ kind: "income", amount: 50_000_00, walletId: "card", date: "2027-01-10T09:00" });
  assert.equal(bal().card, 10_000_000 - 12_345 + 5_000_000);
  st().updateTransaction(id, { amount: 200_00 });
  assert.equal(bal().card, 10_000_000 - 20_000 + 5_000_000);
  st().deleteTransaction(id);
  assert.equal(bal().card, 10_000_000 + 5_000_000);
});

test("перевод: два кошелька меняются, общий баланс, доходы и расходы — нет", () => {
  const total0 = nw().total;
  const m0 = month();
  st().addTransaction({ kind: "transfer", amount: 3_000_00, walletId: "card", toWalletId: "cash", date: "2027-01-12T10:00" });
  assert.equal(bal().card, 10_000_000 - 300_000);
  assert.equal(bal().cash, 500_000 + 300_000);
  assert.equal(nw().total, total0);
  assert.equal(month().income, m0.income);
  assert.equal(month().expense, m0.expense);
});

test("перевод между валютами: зачисляется указанная сумма, без появления дохода", () => {
  st().addTransaction({ kind: "transfer", amount: 9_500_00, walletId: "card", toWalletId: "usd", toAmount: 100_00, date: "2027-01-12T10:00" });
  assert.equal(bal().usd, 100_000 + 10_000);
  assert.equal(month().income, 0);
  assert.equal(month().expense, 0);
});

/* ---------------- money arithmetic ---------------- */

test("суммы — целые копейки: ввод, обратный показ и пересчёт валют без дробей", () => {
  for (const [s, v] of [["0,29", 29], ["19.99", 1999], ["1 234 567,89", 123_456_789], ["0,1", 10], ["7", 700]] as const) assert.equal(parseAmount(s), v, s);
  for (const v of [29, 1999, 123_456_789, 10, 700, 1]) assert.equal(parseAmount(amountToInput(v)), v);
  const s = data().settings;
  for (const v of [1, 33, 101, 99_999]) assert.ok(Number.isInteger(toBase(v, "USD", s)!));
  // the total is the sum of rounded parts, so every screen adds up the same way
  const t = sumWallets(totalWallets(st().wallets), bal(), s).total;
  assert.equal(t, 10_000_000 + 500_000 + Math.round(100_000 * 95) + 0);
});

/* ---------------- months and dates ---------------- */

test("границы месяца: операция 31-го в 23:59 — в январе, 1-го в 00:00 — в феврале", () => {
  st().addTransaction({ kind: "expense", amount: 100_00, walletId: "card", date: "2027-01-31T23:59" });
  st().addTransaction({ kind: "expense", amount: 200_00, walletId: "card", date: "2027-02-01T00:00" });
  assert.equal(month("2027-01-31").expense, 100_00);
  assert.equal(month("2027-02-01").expense, 200_00);
  const r = periodRange("month", 0, "2028-02-10");
  assert.equal(r.to, "2028-02-29");
  assert.equal(r.days, 29);
});

test("регулярный платёж 31-го: февраль → 28/29, март снова 31-е", () => {
  assert.equal(nextAfter("2027-01-31", "month", 1, 31), "2027-02-28");
  assert.equal(nextAfter("2027-02-28", "month", 1, 31), "2027-03-31");
  assert.equal(nextAfter("2028-01-31", "month", 1, 31), "2028-02-29");
  assert.equal(nextAfter("2028-02-29", "year", 1, 29), "2029-02-28");
  assert.deepEqual(occurrencesInRange({ nextDate: "2027-01-31", freq: "month", interval: 1, anchorDay: 31 }, "2027-01-01", "2027-04-30"), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
});

test("пропущенные регулярные платежи записываются ровно по разу, повторный запуск ничего не добавляет", () => {
  const r: Omit<Recurring, "id" | "createdAt"> = { kind: "expense", title: "Связь", amount: 590_00, walletId: "card", freq: "month", interval: 1, anchorDay: 31, nextDate: "2026-11-30", autoPost: true, isSubscription: false, active: true };
  st().addRecurring(r);
  const created = st().processRecurring("2027-01-31");
  assert.equal(created.length, 3);
  const dates = st().transactions.filter((t) => t.recurringId).map((t) => t.date.slice(0, 10)).sort();
  assert.deepEqual(dates, ["2026-11-30", "2026-12-31", "2027-01-31"]);
  assert.equal(st().processRecurring("2027-01-31").length, 0);
  assert.equal(st().recurring[0].nextDate, "2027-02-28");
  assert.equal(bal().card, 10_000_000 - 3 * 59_000);
});

test("часовые пояса: сложение и разница дней не сбиваются на переходе на летнее время", () => {
  const before = process.env.TZ;
  try {
    for (const tz of ["Europe/Moscow", "America/New_York", "Europe/London", "Australia/Sydney", "America/Sao_Paulo", "Pacific/Chatham"]) {
      process.env.TZ = tz;
      let d = "2026-01-01";
      for (let i = 1; i <= 366; i++) {
        const next = addDays(d, 1);
        assert.equal(diffDays(next, d), 1, `${tz} ${d}`);
        assert.ok(next > d, `${tz} ${d}`);
        d = next;
      }
      assert.equal(d, "2027-01-02", tz);
      assert.equal(addMonths("2026-03-31", 1, 31), "2026-04-30", tz);
      assert.equal(endOfMonth("2026-10-10"), "2026-10-31", tz);
    }
  } finally {
    process.env.TZ = before;
  }
});

/* ---------------- expected income in parts ---------------- */

const plan = (p: Partial<Plan> = {}) => st().addPlan({ kind: "income", title: "Зарплата", amount: 150_000_00, date: "2027-01-25", walletId: "card", ...p });

test("ожидаемый доход не меняет баланс, пока не получен", () => {
  const b0 = bal().card;
  plan();
  assert.equal(bal().card, b0);
  assert.equal(month().income, 0);
});

test("доход по частям: каждая часть — одна операция, сумма частей не превышает ожидания, прогноз ждёт остаток", () => {
  const id = plan();
  const f = () => capitalForecast(data(), bal(), buildLedger(data()).entries, T0);
  assert.equal(f().incomeLeft, 150_000_00);
  st().receivePlan(id, 90_000_00, { walletId: "card", date: "2027-01-10T12:00" });
  assert.equal(month().income, 90_000_00);
  assert.equal(f().incomeLeft, 60_000_00);
  // the money already received is in «now»; it must not be counted again as expected
  assert.equal(f().now + f().incomeLeft, 10_000_000 + 500_000 + 9_500_000 + 150_000_00);
  st().completePlan(id, { walletId: "card" });
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "done");
  assert.equal(planReceived(p, st().transactions), 150_000_00);
  assert.equal(f().incomeLeft, 0);
});

test("отмена: удаление части возвращает её в ожидание; «вернуть в план» убирает все части", () => {
  const id = plan();
  const a = st().receivePlan(id, 50_000_00, { walletId: "card", date: "2027-01-05T12:00" })!;
  st().receivePlan(id, 100_000_00, { walletId: "card", date: "2027-01-10T12:00" });
  assert.equal(st().plans.find((x) => x.id === id)!.status, "done");
  st().deleteTransaction(a);
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "planned");
  assert.equal(planLeft(p, st().transactions), 50_000_00);
  st().setPlanStatus(id, "planned");
  assert.equal(st().transactions.filter((t) => t.planId === id).length, 0);
  assert.equal(bal().card, 10_000_000);
});

test("правка полученной части вниз возвращает недостающее в ожидание, правка вверх закрывает доход", () => {
  const id = plan({ amount: 100_000_00 });
  const tx = st().receivePlan(id, 100_000_00, { walletId: "card", date: "2027-01-10T12:00" })!;
  st().updateTransaction(tx, { amount: 60_000_00 });
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "planned");
  assert.equal(planLeft(p, st().transactions), 40_000_00, "после правки части прогноз должен ждать ещё 40 000");
  assert.equal(capitalForecast(data(), bal(), buildLedger(data()).entries, T0).incomeLeft, 40_000_00);
  st().updateTransaction(tx, { amount: 100_000_00 });
  assert.equal(st().plans.find((x) => x.id === id)!.status, "done");
});

/* ---------------- debts ---------------- */

test("дал в долг: деньги ушли с карты, капитал тот же, расходов нет; возврат частями закрывает долг", () => {
  const nw0 = nw().total;
  const id = st().addDebt({ direction: "owed_to_me", counterparty: "Андрей", amount: 25_000_00, currency: "RUB", date: "2027-01-02" }, "card");
  assert.equal(bal().card, 10_000_000 - 2_500_000);
  assert.equal(nw().receivables, 2_500_000);
  assert.equal(nw().total, nw0);
  assert.equal(month().expense, 0);
  st().payDebt(id, 10_000_00, "cash", "2027-01-08T12:00");
  st().payDebt(id, 15_000_00, "card", "2027-01-12T12:00");
  const info = debtInfo(st().debts[0], st().transactions, T0);
  assert.equal(info.status, "closed");
  assert.equal(nw().receivables, 0);
  assert.equal(nw().total, nw0);
  assert.equal(month().income, 0);
});

test("взял в долг: деньги пришли, обязательство выросло, капитал тот же", () => {
  const nw0 = nw().total;
  st().addDebt({ direction: "i_owe", counterparty: "Ольга", amount: 8_000_00, currency: "RUB", date: "2027-01-05" }, "cash");
  assert.equal(bal().cash, 500_000 + 800_000);
  assert.equal(nw().liabilities, 800_000);
  assert.equal(nw().total, nw0);
});

test("простить остаток: капитал уменьшается ровно на него", () => {
  const nw0 = nw().total;
  const id = st().addDebt({ direction: "owed_to_me", counterparty: "Дмитрий", amount: 5_000_00, currency: "RUB", date: "2027-01-02" }, "card");
  st().payDebt(id, 2_000_00, "card", "2027-01-05T12:00");
  st().setDebtClosed(id, true);
  assert.equal(nw().total, nw0 - 3_000_00);
});

test("долги по людям и распределение возврата сходятся с остатками займов", () => {
  st().addDebt({ direction: "owed_to_me", counterparty: "Андрей", amount: 25_000_00, currency: "RUB", date: "2026-12-01" }, "card");
  st().addDebt({ direction: "owed_to_me", counterparty: "андрей", amount: 6_000_00, currency: "RUB", date: "2026-12-20" }, "card");
  const p = debtPeople(st().debts, st().transactions, T0)[0];
  const { parts } = splitRepayment(p, "owed_to_me", 27_000_00);
  for (const x of parts) st().payDebt(x.debtId, x.amount, "card", "2027-01-10T12:00");
  const after = debtPeople(st().debts, st().transactions, T0)[0];
  assert.equal(after.toMe, 4_000_00);
  assert.equal(after.toMe, st().debts.reduce((s, d) => s + debtInfo(d, st().transactions, T0).remaining, 0));
  assert.equal(nw().receivables, after.toMe);
});

test("слишком большой возврат в хранилище ограничивается остатком займа, лишнее не попадает на карту", () => {
  const id = st().addDebt({ direction: "owed_to_me", counterparty: "Игорь", amount: 1_000_00, currency: "RUB", date: "2027-01-02" }, "card");
  st().payDebt(id, 5_000_00, "card", "2027-01-05T12:00");
  assert.equal(bal().card, 10_000_000, "лишние 4 000 не должны попасть на карту");
  assert.equal(debtInfo(st().debts[0], st().transactions, T0).status, "closed");
  st().payDebt(id, 100_00, "card", "2027-01-06T12:00");
  assert.equal(bal().card, 10_000_000, "платёж по закрытому долгу игнорируется");
});

/* ---------------- goals ---------------- */

test("цель со своим балансом: деньги ушли из кошелька в цель, капитал не удваивается", () => {
  const nw0 = nw().total;
  const g = st().addGoal({ name: "Отпуск", icon: "Plane", target: 450_000_00, currency: "RUB" });
  st().moveGoalMoney(g, "card", 25_000_00, "deposit", "2027-01-10T12:00");
  assert.equal(nw().wallets, nw0 - 2_500_000);
  assert.equal(nw().goals, 2_500_000);
  assert.equal(nw().total, nw0);
  assert.equal(month().expense, 0);
});

test("цель, привязанная к счёту: прогресс = баланс счёта, в капитале считается один раз", () => {
  const nw0 = nw().total;
  const g = st().addGoal({ name: "Подушка", icon: "Shield", target: 1_000_000_00, currency: "RUB", walletId: "save" });
  st().moveGoalMoney(g, "card", 30_000_00, "deposit", "2027-01-10T12:00");
  assert.equal(bal().save, 3_000_000);
  assert.equal(nw().goals, 0);
  assert.equal(nw().total, nw0);
});

/* ---------------- forecast ---------------- */

test("прогноз объясним: итог = сейчас + ожидаемое − платежи − обычные траты; путь заканчивается в итоге", () => {
  plan({ amount: 60_000_00, date: "2027-01-28" });
  st().addPlan({ kind: "expense", title: "ОСАГО", amount: 9_800_00, date: "2027-01-20", walletId: "card" });
  for (let d = 1; d <= 14; d++) st().addTransaction({ kind: "expense", amount: 1_500_00, walletId: "card", date: `2027-01-${String(d).padStart(2, "0")}T12:00` });
  const f = capitalForecast(data(), bal(), buildLedger(data()).entries, T0);
  assert.equal(f.end, f.now + f.incomeLeft - f.obligations - f.everyday);
  assert.equal(f.path[f.path.length - 1].value, f.end);
  assert.equal(f.path.length, diffDays(endOfMonth(T0), T0) + 1);
  assert.equal(f.incomeLeft, 60_000_00);
  assert.equal(f.obligations, 9_800_00);
  assert.equal(f.now, sumWallets(totalWallets(st().wallets), bal(), data().settings).total);
});

test("прогнозы на разных экранах берут одинаковые платежи и одинаковый темп обычных трат", () => {
  st().addPlan({ kind: "expense", title: "ТО", amount: 16_500_00, date: "2027-01-24", walletId: "card" });
  for (let d = 1; d <= 14; d++) st().addTransaction({ kind: "expense", amount: 2_000_00, walletId: "card", date: `2027-01-${String(d).padStart(2, "0")}T12:00` });
  const e = buildLedger(data()).entries;
  const f = capitalForecast(data(), bal(), e, T0);
  const c = freeCash(data(), bal(), e, T0);
  const m = monthForecast(data(), e, T0);
  assert.equal(f.everyday, c.everyday);
  assert.equal(f.everyday, m.dailyRate * m.daysLeft);
  assert.equal(c.obligations, scheduledBetween(data(), addDays(T0, 1), endOfMonth(T0)).expense);
  assert.equal(f.obligations, c.obligations);
});

test("ожидаемый доход на сегодня или просроченный учитывается одинаково во всех прогнозах", () => {
  plan({ amount: 40_000_00, date: T0 });
  const e = buildLedger(data()).entries;
  const f = capitalForecast(data(), bal(), e, T0);
  const c = freeCash(data(), bal(), e, T0);
  assert.equal(c.income, f.incomeLeft, "«Свободно к …» и прогноз месяца видят разные ожидаемые доходы");
  plan({ title: "Просрочено", amount: 10_000_00, date: "2026-12-20" });
  st().addPlan({ kind: "expense", title: "Просроченный платёж", amount: 2_000_00, date: "2027-01-03", walletId: "card" });
  const f2 = capitalForecast(data(), bal(), e, T0);
  const c2 = freeCash(data(), bal(), e, T0);
  assert.equal(c2.income, f2.incomeLeft);
  assert.equal(c2.obligations, f2.obligations);
});

test("регулярный перевод между валютами зачисляет сумму в валюте получателя", () => {
  st().addRecurring({ kind: "transfer", title: "В доллары", amount: 9_500_00, walletId: "card", toWalletId: "usd", freq: "month", interval: 1, anchorDay: 10, nextDate: "2027-01-10", autoPost: true, isSubscription: false, active: true });
  st().processRecurring(T0);
  assert.equal(bal().usd, 100_000 + 100_00, "на долларовый счёт должно прийти 100 $, а не 9 500 $");
  assert.equal(bal().card, 10_000_000 - 9_500_00);
  st().postRecurringNow(st().recurring[0].id);
  assert.equal(bal().usd, 100_000 + 200_00);
  assert.equal(month().income + month().expense, 0);
});

test("прогноз на 7/30/90 дней и год: одна формула, путь заканчивается в итоге, месячный прогноз не меняется", () => {
  st().addRecurring({ kind: "income", title: "Зарплата", amount: 100_000_00, walletId: "card", freq: "month", interval: 1, anchorDay: 25, nextDate: "2027-01-25", autoPost: false, isSubscription: false, active: true });
  st().addRecurring({ kind: "expense", title: "Аренда", amount: 40_000_00, walletId: "card", freq: "month", interval: 1, anchorDay: 5, nextDate: "2027-02-05", autoPost: false, isSubscription: false, active: true });
  for (let d = 1; d <= 14; d++) st().addTransaction({ kind: "expense", amount: 1_000_00, walletId: "card", date: `2027-01-${String(d).padStart(2, "0")}T12:00` });
  const e = buildLedger(data()).entries;
  const month0 = capitalForecast(data(), bal(), e, T0);
  assert.equal(month0.until, endOfMonth(T0));
  for (const days of [7, 30, 90, 365]) {
    const f = capitalForecast(data(), bal(), e, T0, addDays(T0, days));
    assert.equal(f.daysLeft, days);
    assert.equal(f.end, f.now + f.incomeLeft - f.obligations - f.everyday, `${days} дн.`);
    assert.equal(f.path.length, days + 1);
    assert.equal(f.path[f.path.length - 1].value, f.end);
    assert.equal(f.everyday, f.dailyRate * days);
  }
  const y = capitalForecast(data(), bal(), e, T0, addDays(T0, 365));
  assert.equal(y.items.filter((i) => i.title === "Зарплата").length, 12);
  assert.equal(y.items.filter((i) => i.title === "Аренда").length, 12);
  assert.equal(y.incomeLeft, 12 * 100_000_00);
  // a longer horizon only adds days: the 30-day path starts where the month path starts
  const d30 = capitalForecast(data(), bal(), e, T0, addDays(T0, 30));
  assert.deepEqual(d30.path.slice(0, month0.path.length), month0.path);
});

test("нехватка денег: предупреждение появляется в первый день, когда обычные деньги уходят в минус", () => {
  // everyday money is 200 000 ₽ (card 100 000 + cash 5 000 + $1 000 at 95); a 250 000 ₽ payment on the 20th pushes it below zero
  st().addPlan({ kind: "expense", title: "Крупная покупка", amount: 250_000_00, date: "2027-01-20", walletId: "card" });
  const e = buildLedger(data()).entries;
  const f = capitalForecast(data(), bal(), e, T0);
  assert.equal(f.cashNow, 10_000_000 + 500_000 + Math.round(100_000 * 95));
  assert.ok(f.shortfall);
  assert.equal(f.shortfall!.day, "2027-01-20");
  assert.equal(f.shortfall!.inDays, 5);
  assert.ok(f.shortfall!.value < 0);
  // savings are not everyday money: moving the same sum from a savings wallet gives no warning
  fresh();
  st().addTransaction({ kind: "transfer", amount: 9_000_000, walletId: "card", toWalletId: "save", date: "2027-01-10T10:00" });
  st().addPlan({ kind: "expense", title: "Покупка", amount: 120_000_00, date: "2027-01-20", walletId: "card" });
  const g = capitalForecast(data(), bal(), buildLedger(data()).entries, T0);
  assert.equal(g.now, 10_000_000 + 500_000 + Math.round(100_000 * 95));
  assert.ok(g.shortfall, "обычных денег после перевода на накопительный счёт уже не хватает");
});

test("изменение капитала за месяц: только доходы и расходы, переводы, цели и займы его не двигают", () => {
  const month0 = capitalChange(data(), bal(), T0);
  assert.equal(month0.delta, 0);
  st().addTransaction({ kind: "income", amount: 100_000_00, walletId: "card", date: "2027-01-05T10:00" });
  st().addTransaction({ kind: "expense", amount: 10_000_00, walletId: "card", date: "2027-01-08T10:00" });
  st().addTransaction({ kind: "transfer", amount: 3_000_00, walletId: "card", toWalletId: "save", date: "2027-01-09T10:00" });
  const g = st().addGoal({ name: "Отпуск", icon: "Plane", target: 450_000_00, currency: "RUB" });
  st().moveGoalMoney(g, "card", 20_000_00, "deposit", "2027-01-10T10:00");
  const d = st().addDebt({ direction: "owed_to_me", counterparty: "Андрей", amount: 25_000_00, currency: "RUB", date: "2027-01-11" }, "card");
  st().payDebt(d, 5_000_00, "cash", "2027-01-12T10:00");
  const c = capitalChange(data(), bal(), T0);
  assert.equal(c.delta, 90_000_00);
  assert.equal(c.to, nw().total);
  assert.equal(c.from, c.to - 90_000_00);
  assert.ok(Math.abs(c.pct! - 90_000_00 / c.from) < 1e-12);
  // the month before is not mixed in
  const prev = capitalChange(data(), bal(), "2026-12-31");
  assert.equal(prev.delta, 0);
});

test("«а если откладывать больше»: дата цели от темпа и добавки, только расчёт, данные не меняются", () => {
  const g = st().addGoal({ name: "Отпуск", icon: "Plane", target: 330_000_00, currency: "RUB", deadline: "2027-12-15" });
  // 75 000 over the last 90 days → 25 000 a month
  for (const [day, v] of [["2026-11-20", 25_000_00], ["2026-12-20", 25_000_00], ["2027-01-10", 25_000_00]] as const) st().moveGoalMoney(g, "card", v, "deposit", `${day}T12:00`);
  const goal = st().goals[0];
  const pace = goalPace(goal, data(), bal(), T0);
  assert.equal(pace, 25_000_00);
  const info = goalInfo(goal, goalSaved(goal, goalEnvelopes(st().transactions), bal()), T0);
  assert.equal(info.remaining, 255_000_00);
  const before = JSON.stringify(data());
  const base = goalWhatIf(goal, info, pace, 0, T0);
  assert.equal(base.months, 11);
  assert.equal(base.eta, "2027-12-15");
  assert.equal(base.meetsDeadline, true);
  const more = goalWhatIf(goal, info, pace, 5_000_00, T0);
  assert.equal(more.monthly, 30_000_00);
  assert.equal(more.months, 9);
  assert.equal(more.earlierBy, 2);
  assert.equal(more.eta, "2027-10-15");
  // a slow pace misses the deadline and says by how much
  const slow = goalWhatIf(goal, info, 10_000_00, 0, T0);
  assert.equal(slow.months, 26);
  assert.equal(slow.meetsDeadline, false);
  assert.ok(slow.lateBy >= 12);
  // no deposits at all: the extra alone sets the pace
  const none = goalWhatIf(goal, info, 0, 20_000_00, T0);
  assert.equal(none.months, 13);
  assert.equal(none.earlierBy, null);
  assert.equal(goalWhatIf(goal, info, 0, 0, T0).months, null);
  assert.equal(JSON.stringify(data()), before);
  assert.deepEqual(whatIfSteps(450_000_00), [200_000, 500_000, 1_000_000]);
});

/* ---------------- salary that comes in pieces ---------------- */

/** 8th: 26 000, 16th: 26 000, 18th: 18 000 — 70 000 in all, expected as an estimate. */
const salary = () =>
  plan({
    title: "Зарплата",
    amount: 70_000_00,
    date: "2027-01-18",
    estimate: true,
    parts: [
      { id: "a", date: "2027-01-18", amount: 18_000_00 },
      { id: "b", date: "2027-01-16", amount: 26_000_00 },
      { id: "c", date: "2027-01-08", amount: 26_000_00 }
    ]
  });

test("зарплата по датам: деньги закрывают выплаты по порядку, остаток ждёт на своих датах", () => {
  const id = salary();
  const p = () => st().plans.find((x) => x.id === id)!;
  const slots = () => planSchedule(p(), st().transactions);
  assert.deepEqual(slots().map((x) => x.date), ["2027-01-08", "2027-01-16", "2027-01-18"]);
  // 20 000 arrive: the 8th payment is partly in
  st().receivePlan(id, 20_000_00, { walletId: "card", date: "2027-01-08T12:00" });
  assert.deepEqual(slots().map((x) => [x.state, x.left]), [["partial", 6_000_00], ["open", 26_000_00], ["open", 18_000_00]]);
  assert.deepEqual(planItems(p(), st().transactions), [
    { date: "2027-01-08", amount: 6_000_00 },
    { date: "2027-01-16", amount: 26_000_00 },
    { date: "2027-01-18", amount: 18_000_00 }
  ]);
  assert.equal(nextSlot(p(), st().transactions)!.id, "c");
  // the rest of the 8th payment comes in cash, the 16th on the card
  st().receivePlan(id, 6_000_00, { walletId: "cash", date: "2027-01-09T12:00" });
  st().receivePlan(id, 26_000_00, { walletId: "card", date: "2027-01-16T12:00" });
  assert.deepEqual(slots().map((x) => x.state), ["done", "done", "open"]);
  assert.equal(bal().cash, 500_000 + 6_000_00);
  assert.equal(bal().card, 10_000_000 + 20_000_00 + 26_000_00);
  assert.equal(p().status, "planned");
  assert.equal(planLeft(p(), st().transactions), 18_000_00);
  assert.equal(month("2027-01-31").income, 52_000_00);
});

test("прогноз берёт остаток зарплаты на каждую дату; просроченная выплата ждётся сегодня", () => {
  const id = salary();
  const e = buildLedger(data()).entries;
  const f = capitalForecast(data(), bal(), e, "2027-01-10");
  // the 8th payment is already late on the 10th: it waits «today», the others on their dates
  const dates = f.items.filter((i) => i.title === "Зарплата").map((i) => [i.date, i.amount]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  assert.deepEqual(dates, [["2027-01-10", 26_000_00], ["2027-01-16", 26_000_00], ["2027-01-18", 18_000_00]]);
  assert.equal(f.incomeLeft, 70_000_00);
  assert.equal(f.path[f.path.length - 1].value, f.end);
  st().receivePlan(id, 26_000_00, { walletId: "card", date: "2027-01-10T12:00" });
  const g = capitalForecast(data(), bal(), buildLedger(data()).entries, "2027-01-10");
  assert.equal(g.incomeLeft, 44_000_00);
  // the way of the balance: nothing before the 16th, +26 000 that day, +18 000 on the 18th
  const at = (d: string) => g.path.find((x) => x.day === d)!.value;
  assert.equal(at("2027-01-16") - at("2027-01-15") - -g.dailyRate, 26_000_00);
  assert.equal(at("2027-01-18") - at("2027-01-17") - -g.dailyRate, 18_000_00);
});

test("неожиданный перевод на карту засчитывается в зарплату и не считается дважды", () => {
  const id = salary();
  // 8 000 arrive at a random moment and are counted against the salary
  st().addTransaction({ kind: "income", amount: 8_000_00, walletId: "card", categoryId: "i-salary", date: "2027-01-12T15:00", planId: id });
  st().syncPlan(id);
  assert.equal(planLeft(st().plans.find((x) => x.id === id)!, st().transactions), 62_000_00);
  assert.equal(month("2027-01-31").income, 8_000_00);
  assert.equal(capitalForecast(data(), bal(), buildLedger(data()).entries, "2027-01-12").incomeLeft, 62_000_00);
  // more than expected: the plan closes, the surplus is just income, nothing more is awaited
  st().addTransaction({ kind: "income", amount: 70_000_00, walletId: "card", date: "2027-01-14T15:00", planId: id });
  st().syncPlan(id);
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "done");
  assert.equal(planLeft(p, st().transactions), 0);
  assert.deepEqual(planItems(p, st().transactions), []);
  assert.equal(capitalForecast(data(), bal(), buildLedger(data()).entries, "2027-01-14").incomeLeft, 0);
});

test("график на следующий месяц: те же числа, 31-е → 28-е, ориентировочно", () => {
  const id = plan({ title: "Зарплата", amount: 70_000_00, date: "2027-01-08", parts: [{ id: "a", date: "2027-01-31", amount: 40_000_00 }, { id: "b", date: "2027-01-08", amount: 30_000_00 }] });
  const copy = nextMonthPlan(st().plans.find((x) => x.id === id)!, (d) => addMonths(d, 1, Number(d.slice(8))));
  assert.equal(copy.amount, 70_000_00);
  assert.deepEqual(copy.parts!.map((x) => x.date).sort(), ["2027-02-08", "2027-02-28"]);
  assert.equal(copy.date, "2027-02-08");
  assert.equal(copy.estimate, true);
});

test("аванс пришёл заранее: деньги идут в выбранную выплату, а не в самую раннюю", () => {
  const id = plan({
    title: "Зарплата",
    amount: 70_000_00,
    date: "2027-01-08",
    parts: [
      { id: "s8", date: "2027-01-08", amount: 26_000_00, label: "Зарплата" },
      { id: "s16", date: "2027-01-16", amount: 26_000_00 },
      { id: "adv", date: "2027-01-18", amount: 18_000_00, label: "Аванс" }
    ]
  });
  st().receivePlan(id, 18_000_00, { walletId: "card", date: "2027-01-05T10:00", partId: "adv" });
  const slots = planSchedule(st().plans.find((x) => x.id === id)!, st().transactions);
  assert.deepEqual(slots.map((x) => [x.id, x.state]), [["s8", "open"], ["s16", "open"], ["adv", "done"]]);
  assert.equal(slots[2].label, "Аванс");
  // a tied payment larger than its part spills over to the earliest
  st().receivePlan(id, 30_000_00, { walletId: "card", date: "2027-01-08T10:00", partId: "s16" });
  const again = planSchedule(st().plans.find((x) => x.id === id)!, st().transactions);
  assert.deepEqual(again.map((x) => [x.id, x.left]), [["s8", 22_000_00], ["s16", 0], ["adv", 0]]);
});

test("один приход на два счёта: 388 ₽ на карту и 4 000 ₽ наличными закрывают одну выплату", () => {
  const id = plan({ title: "Подработка", amount: 4_388_00, date: "2027-01-12" });
  st().receivePlan(id, 388_00, { walletId: "card", date: "2027-01-12T10:00" });
  st().receivePlan(id, 4_000_00, { walletId: "cash", date: "2027-01-12T10:00" });
  assert.equal(bal().card, 10_000_000 + 388_00);
  assert.equal(bal().cash, 500_000 + 4_000_00);
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "done");
  assert.equal(month().income, 4_388_00);
});

test("пришло больше ожидаемого: доход закрыт, лишнее видно, прогноз ничего не ждёт", () => {
  const id = plan({ amount: 70_000_00, estimate: true });
  st().receivePlan(id, 71_000_00, { walletId: "card", date: "2027-01-25T10:00" });
  const p = st().plans.find((x) => x.id === id)!;
  assert.equal(p.status, "done");
  assert.equal(planSurplus(p, st().transactions), 1_000_00);
  assert.equal(month("2027-01-31").income, 71_000_00);
  assert.equal(capitalForecast(data(), bal(), buildLedger(data()).entries, "2027-01-25").incomeLeft, 0);
});

test("доход каждый месяц: копия на следующий месяц создаётся один раз, пропуск и отмена повтора работают", () => {
  const id = plan({ title: "Зарплата", amount: 70_000_00, date: "2027-01-08", repeat: "month", parts: [{ id: "a", date: "2027-01-08", amount: 52_000_00, label: "Зарплата" }, { id: "b", date: "2027-01-31", amount: 18_000_00, label: "Аванс" }] });
  assert.equal(st().rollPlans("2027-01-15").length, 1);
  assert.equal(st().rollPlans("2027-01-15").length, 0, "повторный запуск ничего не добавляет");
  const feb = st().plans.find((p) => p.date.startsWith("2027-02"))!;
  assert.equal(feb.estimate, true);
  assert.equal(feb.seriesId, st().plans.find((p) => p.id === id)!.seriesId ?? id);
  assert.deepEqual(feb.parts!.map((x) => [x.date, x.amount, x.label]), [["2027-02-08", 52_000_00, "Зарплата"], ["2027-02-28", 18_000_00, "Аванс"]]);
  // February is skipped: it does not come back, March is still created
  st().removePlan(feb.id, false);
  assert.equal(st().plans.find((p) => p.id === feb.id)!.status, "skipped");
  st().rollPlans("2027-02-10");
  assert.equal(st().plans.filter((p) => p.date.startsWith("2027-02")).length, 1);
  const mar = st().plans.find((p) => p.date.startsWith("2027-03"))!;
  assert.ok(mar);
  assert.equal(mar.parts![1].date, "2027-03-31");
  // stop the repeat: nothing new from now on
  st().removePlan(mar.id, true);
  assert.equal(st().rollPlans("2027-04-10").length, 0);
  assert.ok(st().plans.every((p) => p.repeat !== "month"));
});

/* ---------------- month helpers used by the forecast ---------------- */

test("начало и конец месяца, включая високосный февраль", () => {
  assert.equal(startOfMonth("2028-02-29"), "2028-02-01");
  assert.equal(endOfMonth("2028-02-01"), "2028-02-29");
  assert.equal(endOfMonth("2027-02-01"), "2027-02-28");
  assert.equal(endOfMonth("2027-12-31"), "2027-12-31");
});

console.log(`\nФинансовые проверки пройдены: ${passed}${knownIssues ? ` · известных проблем: ${knownIssues}` : ""}`);
