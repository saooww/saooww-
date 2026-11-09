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
import { parseTask, splitLines } from "../src/lib/quickParse";
import { dayPlan, nextOccurrence, nextRepeatDate } from "../src/lib/tasks";
import { taskToICS } from "../src/lib/ics";
import { parseImport } from "../src/store/store";
import { applyCalcKey, evaluate, formatExpression } from "../src/lib/calc";
import { SAVE_EVERY, flushPersist } from "../src/store/storage";
import { STORAGE_KEY } from "../src/store/store";
import { CARD_MATERIALS, materialOf } from "../src/store/catalog";
import { weekSummary, weekToReview } from "../src/lib/week";
import { goalStatus } from "../src/lib/goals";
import { parseSmart } from "../src/lib/smart";
import { monthDots } from "../src/lib/monthRing";
import { personalProgress } from "../src/lib/progress";
import { goalInfo } from "../src/lib/finance";
import { switchLanguage, type Lang } from "../src/i18n/i18n";

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

console.log("Ardessa — проверка учёта и дел");

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

/* ---------------- planner ---------------- */

// A fixed Thursday, so the answers don't depend on the day the tests run.
const THU = "2026-11-05";
const lists = [{ id: "pr-work", name: "Работа" }, { id: "pr-home", name: "Дом" }];
const p = (text: string) => parseTask(text, THU, { projects: lists, defaultDue: THU });

test("дело одной строкой: дата, время, список, приоритет", () => {
  const a = p("Позвонить маме завтра в 18:00");
  assert.deepEqual([a.title, a.due, a.time], ["Позвонить маме", "2026-11-06", "18:00"]);
  const b = p("Отчёт к пятнице #работа !!");
  assert.deepEqual([b.title, b.due, b.projectId, b.priority], ["Отчёт", "2026-11-06", "pr-work", 2]);
  const c = p("в понедельник в 5 вечера созвон");
  assert.deepEqual([c.title, c.due, c.time], ["Созвон", "2026-11-09", "17:00"]);
  const d = p("завтра утром в 9 бег");
  assert.deepEqual([d.title, d.due, d.time], ["Бег", "2026-11-06", "09:00"]);
  const e = p("Встреча в 10 с Ивановым");
  assert.deepEqual([e.title, e.time], ["Встреча с Ивановым", "10:00"]);
});

test("дело одной строкой: числа, которые не дата и не время, остаются в названии", () => {
  assert.equal(p("Купить 2 билета в 3 кассе").title, "Купить 2 билета в 3 кассе");
  assert.equal(p("Купить 2 билета в 3 кассе").time, undefined);
  const t = p("в 10.30 стоматолог");
  assert.deepEqual([t.title, t.time, t.due], ["Стоматолог", "10:30", THU]);
  const d = p("Отнести документы 12.11");
  assert.deepEqual([d.title, d.due, d.time], ["Отнести документы", "2026-11-12", undefined]);
  // a date already past this year means next year
  assert.equal(p("День рождения 3 марта").due, "2027-03-03");
});

test("дело одной строкой: повторы", () => {
  const a = p("оплатить интернет каждый месяц 15 ноября");
  assert.deepEqual([a.title, a.repeat, a.due], ["Оплатить интернет", "month", "2026-11-15"]);
  const b = p("выбросить мусор по понедельникам");
  assert.deepEqual([b.title, b.repeat, b.due], ["Выбросить мусор", "week", "2026-11-09"]);
  const c = p("зарядка по будням");
  assert.deepEqual([c.title, c.repeat], ["Зарядка", "weekdays"]);
  assert.equal(p("через 2 недели отпуск").due, "2026-11-19");
  assert.equal(p("на выходных разобрать шкаф").due, "2026-11-07");
});

test("дело одной строкой: отключённое распознавание оставляет слова", () => {
  const a = parseTask("Купить билеты завтра", THU, { ignore: new Set(["date"]) });
  assert.deepEqual([a.title, a.due], ["Купить билеты завтра", undefined]);
  assert.deepEqual(splitLines("- молоко\n• хлеб\n\n1. сыр\n[ ] яйца"), ["молоко", "хлеб", "сыр", "яйца"]);
});

test("повторы: по будням пятница → понедельник, следующий раз не в прошлом", () => {
  assert.equal(nextRepeatDate("2026-11-06", "weekdays"), "2026-11-09");
  assert.equal(nextRepeatDate("2026-01-31", "month"), "2026-02-28");
  assert.equal(nextOccurrence({ due: addDays(today, -10), repeat: "day" }, today), addDays(today, 1));
  assert.equal(nextOccurrence({ due: undefined, repeat: "none" }, today), undefined);
});

test("повторяющееся дело: отметка создаёт следующее, отмена отметки убирает его", () => {
  const id = st().addTask({ title: "Полить цветы", due: today, priority: 0, repeat: "week", subtasks: [{ id: "x", title: "Фикус", done: true }], focus: today });
  const n0 = st().tasks.length;
  st().toggleTask(id);
  const done = st().tasks.find((t) => t.id === id)!;
  const next = st().tasks.find((t) => t.id === done.nextId)!;
  assert.equal(st().tasks.length, n0 + 1);
  assert.equal(next.due, addDays(today, 7));
  assert.equal(next.done, false);
  assert.equal(next.focus, undefined);
  assert.equal(next.subtasks![0].done, false);
  st().toggleTask(id);
  assert.equal(st().tasks.length, n0);
  assert.equal(st().tasks.find((t) => t.id === id)!.done, false);
});

test("перенос дела: без даты — без времени, главное дня снимается", () => {
  const id = st().addTask({ title: "Созвон", due: today, time: "10:00", priority: 0, repeat: "none", focus: today });
  st().scheduleTasks([id], addDays(today, 1));
  let t = st().tasks.find((x) => x.id === id)!;
  assert.deepEqual([t.due, t.time, t.focus], [addDays(today, 1), "10:00", undefined]);
  st().scheduleTasks([id], undefined);
  t = st().tasks.find((x) => x.id === id)!;
  assert.deepEqual([t.due, t.time], [undefined, undefined]);
});

test("план дня: главное, остальное, хвосты и счёт сделанного", () => {
  st().replaceAll({ ...data(), tasks: [] });
  const a = st().addTask({ title: "A", due: today, priority: 0, repeat: "none", focus: today });
  st().addTask({ title: "B", due: today, priority: 0, repeat: "none" });
  st().addTask({ title: "C", due: addDays(today, -2), priority: 0, repeat: "none" });
  st().addTask({ title: "D", priority: 0, repeat: "none" });
  st().toggleTask(a);
  const plan = dayPlan(st().tasks, today);
  assert.deepEqual(plan.focus.map((t) => t.title), ["A"]);
  assert.deepEqual(plan.rest.map((t) => t.title), ["B"]);
  assert.deepEqual(plan.overdue.map((t) => t.title), ["C"]);
  assert.deepEqual([plan.completed, plan.total], [1, 2]);
});

test("удаление списка убирает его дела и связи заметок", () => {
  const pid = st().addProject({ name: "Ремонт", icon: "Hammer", color: "#4E9FD1" });
  const tid = st().addTask({ title: "Купить краску", projectId: pid, priority: 0, repeat: "none" });
  const keep = st().addTask({ title: "Другое", priority: 0, repeat: "none" });
  const nid = st().addNote({ title: "Смета", links: [{ type: "project", id: pid }, { type: "task", id: tid }, { type: "task", id: keep }] });
  st().deleteProject(pid);
  assert.equal(st().projects.some((x) => x.id === pid), false);
  assert.equal(st().tasks.some((x) => x.id === tid), false);
  assert.equal(st().tasks.some((x) => x.id === keep), true);
  assert.deepEqual(st().notes.find((n) => n.id === nid)!.links, [{ type: "task", id: keep }]);
});

test("дневник: одна запись на день", () => {
  const a = st().journalNote(today);
  const b = st().journalNote(today);
  assert.equal(a, b);
  assert.equal(st().notes.find((n) => n.id === a)!.journal, today);
});

test("дело в календарь: событие с напоминанием и повтором", () => {
  const ics = taskToICS({ id: "k-1", title: "Отчёт, срочно; финал", due: "2026-11-06", time: "23:45", priority: 0, repeat: "weekdays", done: false, createdAt: "2026-11-05T10:00" });
  assert.match(ics, /DTSTART:20261106T234500\r\n/);
  assert.match(ics, /DTEND:20261107T001500\r\n/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.match(ics, /SUMMARY:Отчёт\\, срочно\\; финал/);
  assert.match(ics, /TRIGGER:-PT15M/);
  const allDay = taskToICS({ id: "k-2", title: "x".repeat(200), due: "2026-11-06", priority: 0, repeat: "none", done: false, createdAt: "2026-11-05T10:00" });
  assert.match(allDay, /DTSTART;VALUE=DATE:20261106/);
  assert.match(allDay, /TRIGGER:PT9H/);
  assert.ok(allDay.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
});

test("старая резервная копия без списков открывается", () => {
  const old = { ...data() } as Record<string, unknown>;
  delete old.projects;
  const restored = parseImport(JSON.stringify({ app: "kapital", version: 2, data: old }));
  assert.deepEqual(restored.projects, []);
  assert.equal(restored.tasks.length, st().tasks.length);
});

test("итоги недели: воскресенье и понедельник, деньги и дела за неделю", () => {
  assert.equal(weekToReview("2026-11-08"), "2026-11-02"); // Sunday: the week now ending
  assert.equal(weekToReview("2026-11-09"), "2026-11-02"); // Monday: the week just finished
  assert.equal(weekToReview("2026-11-07"), null);
  const data = createDemoData();
  const { entries } = buildLedger(data);
  const today = todayKey();
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const w = weekSummary(entries, data.tasks, data.notes, cats, today, today);
  assert.equal(w.net, w.income - w.expense);
  assert.ok(w.from <= today && today <= w.to);
  const inWeek = entries.filter((e) => e.day >= w.from && e.day <= w.to && e.tx.kind === "expense").reduce((a, e) => a + e.base, 0);
  assert.equal(w.expense, inWeek);
  assert.ok(w.top.reduce((a, c) => a + c.share, 0) <= 1.0001);
  const done = data.tasks.filter((t) => t.done && t.doneAt && t.doneAt.slice(0, 10) >= w.from && t.doneAt.slice(0, 10) <= w.to).length;
  assert.equal(w.tasksDone, done);
  assert.ok(w.noSpendDays <= w.daysCounted && w.daysCounted <= 7);
  // a week with nothing in it
  const empty = weekSummary([], [], [], cats, "2020-01-06", today);
  assert.ok(empty.empty);
  assert.equal(empty.label, "6 – 12 января");
});

test("статус цели: в графике, отстаёт, стоит, достигнута", () => {
  const today = "2026-01-01";
  const goal = { id: "g", name: "Отпуск", icon: "Plane", target: 1_200_000, currency: "RUB", deadline: "2027-01-01", createdAt: today } as unknown as import("../src/store/types").Goal;
  const info = goalInfo(goal, 0, today);
  assert.equal(goalStatus(goal, info, 120_000, today).kind, "onTrack"); // 1 200 ₽/мес → 10 months, before the deadline
  assert.equal(goalStatus(goal, info, 50_000, today).kind, "late"); // 24 months — too slow
  assert.equal(goalStatus(goal, info, 0, today).kind, "stalled");
  assert.equal(goalStatus(goal, goalInfo(goal, 1_200_000, today), 0, today).kind, "done");
  assert.equal(goalStatus({ ...goal, deadline: undefined }, info, 100_000, today).kind, "open");
});

test("умная строка: трата, доход, цель и дело из одной фразы", () => {
  const d = createDemoData();
  const ctx = { today: "2026-11-08", categories: d.categories, goals: d.goals, projects: d.projects, history: d.transactions };
  const coffee = parseSmart("кофе 300", ctx);
  assert.ok(coffee.kind === "expense" && coffee.amount === 30_000 && coffee.categoryId === "c-cafe");
  const salary = parseSmart("зарплата 120 000", ctx);
  assert.ok(salary.kind === "income" && salary.amount === 12_000_000 && salary.categoryId === "i-salary");
  const gas = parseSmart("бензин 2,5к вчера", ctx);
  assert.ok(gas.kind === "expense" && gas.amount === 250_000 && gas.day === "2026-11-07" && gas.title === "Бензин");
  const goal = parseSmart("отложить 5000 на отпуск", ctx);
  assert.ok(goal.kind === "goal" && goal.amount === 500_000);
  const task = parseSmart("позвонить маме завтра в 18", ctx);
  assert.ok(task.kind === "task" && task.task.title === "Позвонить маме" && task.task.due === "2026-11-09" && task.task.time === "18:00");
  assert.equal(parseSmart("купить хлеб", ctx).kind, "task");
  assert.equal(parseSmart("   ", ctx).kind, "empty");
});

test("умная строка понимает все десять языков", () => {
  const d = createDemoData();
  const goalNamed = (name: string) => [{ ...d.goals[0], id: "g-x", name }];
  const cases: Array<{ lang: Lang; goal: string; salary: string; save: string; taxi: string; call: string; title: string; time: string }> = [
    { lang: "en", goal: "Holiday in Japan", salary: "salary 120,000", save: "save 5000 for holiday", taxi: "taxi 450 yesterday", call: "call mom tomorrow at 6pm", title: "Call mom", time: "18:00" },
    { lang: "es", goal: "Vacaciones en Japón", salary: "sueldo 120 000", save: "ahorrar 5000 para vacaciones", taxi: "taxi 450 ayer", call: "llamar a mamá mañana a las 18", title: "Llamar a mamá", time: "18:00" },
    { lang: "fr", goal: "Vacances au Japon", salary: "salaire 120 000", save: "mettre 5000 de côté pour les vacances", taxi: "taxi 450 hier", call: "appeler maman demain à 18 h", title: "Appeler maman", time: "18:00" },
    { lang: "de", goal: "Urlaub in Japan", salary: "Gehalt 120.000", save: "5000 für Urlaub zurücklegen", taxi: "Taxi 450 gestern", call: "Mama morgen um 18 Uhr anrufen", title: "Mama anrufen", time: "18:00" },
    { lang: "pt", goal: "Férias no Japão", salary: "salário 120.000", save: "guardar 5000 para as férias", taxi: "táxi 450 ontem", call: "ligar para a mãe amanhã às 18", title: "Ligar para a mãe", time: "18:00" },
    { lang: "tr", goal: "Japonya tatili", salary: "maaş 120.000", save: "tatil için 5000 biriktir", taxi: "taksi 450 dün", call: "yarın 18'de annemi ara", title: "Annemi ara", time: "18:00" },
    { lang: "zh", goal: "日本度假", salary: "工资 120000", save: "为度假存 5000", taxi: "昨天打车 450", call: "明天下午6点给妈妈打电话", title: "给妈妈打电话", time: "18:00" },
    { lang: "ja", goal: "日本旅行", salary: "給料 120000", save: "旅行のために5000貯める", taxi: "タクシー 450 昨日", call: "明日18時に母に電話", title: "母に電話", time: "18:00" },
    { lang: "hi", goal: "जापान में छुट्टी", salary: "वेतन 120000", save: "छुट्टी के लिए 5000 बचाएँ", taxi: "टैक्सी 450 कल", call: "कल शाम 6 बजे माँ को फ़ोन करना", title: "माँ को फ़ोन करना", time: "18:00" }
  ];
  try {
    for (const c of cases) {
      switchLanguage(c.lang, false);
      const ctx = { today: "2026-11-08", categories: d.categories, goals: goalNamed(c.goal), projects: [], history: [] };
      const salary = parseSmart(c.salary, ctx);
      assert.ok(salary.kind === "income" && salary.amount === 12_000_000, `${c.lang}: ${c.salary} → ${JSON.stringify(salary)}`);
      const save = parseSmart(c.save, ctx);
      assert.ok(save.kind === "goal" && save.amount === 500_000 && save.goalId === "g-x", `${c.lang}: ${c.save} → ${JSON.stringify(save)}`);
      const taxi = parseSmart(c.taxi, ctx);
      assert.ok(taxi.kind === "expense" && taxi.amount === 45_000 && taxi.day === "2026-11-07", `${c.lang}: ${c.taxi} → ${JSON.stringify(taxi)}`);
      const call = parseSmart(c.call, ctx);
      assert.ok(call.kind === "task" && call.task.due === "2026-11-09" && call.task.time === c.time && call.task.title === c.title, `${c.lang}: ${c.call} → ${JSON.stringify(call)}`);
    }
  } finally {
    switchLanguage("ru", false);
  }
});

test("кольцо дней: без трат, в норме, сверх нормы, сегодня и впереди", () => {
  const e = (day: string, base: number) => ({ day, base, tx: { kind: "expense" } }) as unknown as import("../src/lib/finance").LedgerEntry;
  const dots = monthDots([e("2026-11-02", 500_00), e("2026-11-03", 5_000_00), e("2026-11-09", 100_00)], "2026-11-09", 1_000_00);
  assert.equal(dots.length, 30);
  assert.equal(dots[0].mark, "free");
  assert.equal(dots[1].mark, "ok");
  assert.equal(dots[2].mark, "over");
  assert.equal(dots[8].mark, "today");
  assert.equal(dots[9].mark, "future");
});

test("ваш путь: серия дней в норме и награды", () => {
  const e = (day: string, base: number, kind = "expense") => ({ day, base, tx: { kind } }) as unknown as import("../src/lib/finance").LedgerEntry;
  const entries = [e("2026-10-05", 9_000_00, "income"), e("2026-10-06", 2_000_00), e("2026-11-05", 5_000_00), e("2026-11-06", 100_00), e("2026-11-08", 900_00)];
  const p = personalProgress({ entries, transactions: [{} as never], tasks: [], notes: [], goalShares: [0.6], norm: 1_000_00, today: "2026-11-09" });
  assert.equal(p.normStreak, 3); // 6, 7 (free) and 8 November
  assert.equal(p.plusMonths, 1);
  const done = new Set(p.achievements.filter((a) => a.done).map((a) => a.id));
  assert.ok(done.has("first") && done.has("plusMonth") && done.has("halfGoal") && !done.has("goalDone") && !done.has("normWeek"));
});

test("цвета карт: прежние показываются ближайшим фирменным, новые — как есть", () => {
  assert.deepEqual(CARD_MATERIALS.map((m) => m.id), ["ardessa", "obsidian", "graphite", "titanium", "bordeaux", "ivory"]);
  assert.equal(materialOf("ember").id, "ardessa");
  assert.equal(materialOf("sand").id, "titanium");
  assert.equal(materialOf("midnight").id, "obsidian");
  assert.equal(materialOf("forest").id, "graphite");
  assert.equal(materialOf("plum").id, "bordeaux");
  for (const m of CARD_MATERIALS) assert.equal(materialOf(m.id), m);
  // the demo uses only current colours
  for (const w of createDemoData().wallets) assert.ok(CARD_MATERIALS.some((m) => m.id === w.style), w.style);
});

test("калькулятор суммы: порядок действий, копейки, ввод с клавиатуры", () => {
  const type = (keys: string[]) => keys.reduce((b, k) => applyCalcKey(b, k as Parameters<typeof applyCalcKey>[1]), "");
  assert.equal(evaluate(type(["1", "2", "0", "0", "+", "3", "5", "0"])), 155_000);
  assert.equal(evaluate("100+50×3"), 25_000);
  assert.equal(evaluate("1000-250,5"), 74_950);
  assert.equal(evaluate("450×3+"), 135_000); // a trailing operator is ignored
  assert.equal(type(["5", "+", "-"]), "5-"); // a second operator replaces the first
  assert.equal(type(["+"]), ""); // nothing to add to yet
  assert.equal(type(["1", ",", "2", "3", "4"]), "1,23"); // two decimals per number
  assert.equal(type(["1", "0", "+", "5", "="]), "15");
  assert.equal(evaluate("100-300"), -20_000);
  assert.equal(formatExpression("12000+350-5"), "12\u202F000 + 350 − 5");
});

/* ---------------- saving ---------------- */

{
  // Typing changes the store on every letter; the saved copy is written in bursts, and the last letter is never lost.
  const name = "сохранение: набор текста пишется пачками, последняя буква не теряется";
  useData.getState().replaceAll(createDemoData());
  await flushPersist();
  const writes: string[] = [];
  const realSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k: string, v: string) => {
    if (k === STORAGE_KEY) writes.push(v);
    realSet(k, v);
  };
  const id = st().addNote({ title: "Черновик" });
  const text = "Купить подарок к пятнице";
  for (let i = 1; i <= text.length; i++) st().updateNote(id, { body: text.slice(0, i) });
  try {
    assert.ok(writes.length <= 2, `writes while typing: ${writes.length}`);
    await new Promise((r) => setTimeout(r, SAVE_EVERY + 50));
    await flushPersist();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.notes.find((n: { id: string }) => n.id === id);
    assert.equal(saved.body, text);
    assert.ok(writes.length <= 3, `writes in total: ${writes.length}`);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  } finally {
    localStorage.setItem = realSet;
  }
}

console.log(`\nВсе проверки пройдены: ${passed}`);
