import { parseTask, type ParsedTask } from "./quickParse";
import { addDays, type DayKey } from "./dates";
import type { Minor } from "./money";
import type { Category, Goal, ID, Project, Transaction } from "../store/types";
import { getLang } from "../i18n/i18n";

/**
 * The smart line: one sentence, and the app works out what it is.
 *   «кофе 300»                    → an expense in «Кафе», 300 ₽
 *   «зарплата 120000»             → income
 *   «отложить 5000 на отпуск»     → money into the goal «Отпуск…»
 *   «позвонить маме завтра в 18»  → a task for tomorrow, 18:00
 */
export type SmartResult =
  | { kind: "expense" | "income"; amount: Minor; title: string; categoryId?: ID; day?: DayKey }
  | { kind: "goal"; amount: Minor; goalId: ID; title: string }
  | { kind: "task"; task: ParsedTask }
  | { kind: "empty" };

const S = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";

// money words that mean «it came in»
const INCOME = /(?<![\p{L}])(зарплат|зп|аванс|преми|кешб[эе]к|кэшб[эе]к|получил|поступлени|доход|вернули|возврат|продал|дивиденд|процент|фриланс|гонорар|подарили|salary|income|refund|cashback|paycheck|sueldo|salario|nómina|salaire|gehalt|lohn|salário|maaş|वेतन|तनख्वाह)|(工资|薪水|給料)/iu;
// «put aside for a goal»
const GOAL = /(?<![\p{L}])(отлож|накоп|копил|в цель|на цель|пополн|save|saving|put aside|ahorr|apartar|de côté|épargn|zurückleg|spar|guardar|poupar|biriktir|kenara|बचा)|(存|貯め|貯金)/iu;

/** Keywords → default categories, for a first guess before the person's history kicks in. */
const KEYWORDS: Array<[RegExp, ID]> = [
  [/(кофе|кафе|ресторан|обед|ужин|завтрак|бизнес-ланч|ланч|бургер|пицц|суши|шаурм|столов|кофейн|coffee|lunch|dinner|cafe)/iu, "c-cafe"],
  [/(продукт|магнит|пятёрочк|пятерочк|перекр[её]ст|ашан|лента|вкусвилл|молоко|хлеб|рынок|супермаркет|grocer)/iu, "c-groceries"],
  [/(такси|яндекс go|uber|taxi)/iu, "c-taxi"],
  [/(метро|автобус|проезд|трамва|электричк|транспорт|тройк|metro|bus)/iu, "c-transport"],
  [/(бензин|заправк|азс|парковк|мойк|шиномонтаж|авто|машин|fuel|gas)/iu, "c-car"],
  [/(жкх|квартплат|аренд|коммунал|свет|электричеств|вода|газ|ремонт|rent)/iu, "c-home"],
  [/(связь|интернет|телефон|мобильн|сим)/iu, "c-connect"],
  [/(подписк|netflix|spotify|кинопоиск|ivi|okko|youtube|плюс|subscription)/iu, "c-subs"],
  [/(аптек|врач|лекарств|клиник|стоматолог|анализ|pharmacy|doctor)/iu, "c-health"],
  [/(спорт|зал|фитнес|бассейн|тренировк|gym)/iu, "c-sport"],
  [/(одежд|обув|кроссовк|куртк|джинс|футболк|clothes)/iu, "c-clothes"],
  [/(кино|театр|концерт|игр|бар|клуб|музей|cinema|game)/iu, "c-fun"],
  [/(отел|билет|самол[её]т|поезд|путешеств|авиа|hotel|flight)/iu, "c-travel"],
  [/(курс|книг|учеб|школ|универ|репетитор|course|book)/iu, "c-education"],
  [/(подар|цвет|gift)/iu, "c-gifts"],
  [/(стрижк|салон|маникюр|косметик|парикмахер|beauty)/iu, "c-beauty"],
  [/(корм|ветеринар|зоомагазин|кот|собак|pet)/iu, "c-pets"],
  [/(покупк|маркетплейс|ozon|озон|wildberries|вайлдберриз|wb|amazon)/iu, "c-shopping"]
];
const INCOME_KEYWORDS: Array<[RegExp, ID]> = [
  [/(зарплат|зп|аванс|преми|salary)/iu, "i-salary"],
  [/(фриланс|гонорар|заказ|freelance)/iu, "i-freelance"],
  [/(кешб[эе]к|кэшб[эе]к|cashback)/iu, "i-cashback"],
  [/(дивиденд|процент)/iu, "i-invest"],
  [/(подарили|подарок)/iu, "i-gifts"],
  [/(продал)/iu, "i-sale"]
];

/** An amount: «300», «1 200», «1200,50», «5к», «5 тыс», «2.5k», with or without ₽/р/руб. */
// Edges only against Latin and Cyrillic letters: in Chinese and Japanese digits sit right next to words («5000貯める»).
const AS = "(?<![\\p{Script=Latin}\\p{Script=Cyrillic}\\p{N}])";
const AE = "(?![\\p{Script=Latin}\\p{Script=Cyrillic}\\p{N}])";
const AMOUNT = new RegExp(`${AS}(\\d{1,3}(?:[  .,']\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?\\s*(к|k|тыс\\.?|т\\.?р\\.?)?\\s*(₽|р\\.?|руб\\.?|рублей|рубля|rub)?${AE}`, "iu");

function findAmount(text: string): { amount: Minor; rest: string } | null {
  const m = text.match(AMOUNT);
  if (!m) return null;
  let value = Number(m[1].replace(/[  .,']/g, "")) + (m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0);
  if (m[3]) value *= 1000;
  if (!value) return null;
  return { amount: Math.round(value * 100), rest: (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim() };
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 3);

/** The goal the text names, by its words («отпуск» → «Отпуск в Японии»). */
function findGoal(text: string, goals: Goal[]): Goal | undefined {
  const ws = words(text);
  let best: { g: Goal; score: number } | undefined;
  for (const g of goals) {
    if (g.archived) continue;
    const gw = words(g.name);
    const score = ws.filter((w) => gw.some((x) => x.startsWith(w.slice(0, Math.max(4, w.length - 2))) || w.startsWith(x.slice(0, Math.max(4, x.length - 2))))).length;
    // Chinese and Japanese: shared pairs of characters («为度假存» ~ «日本度假»)
    const pairs = (v: string) => [...v.replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, "")].map((c, i, a) => c + (a[i + 1] ?? "")).filter((x) => x.length === 2);
    const gp = pairs(g.name);
    const cjkScore = pairs(text).filter((x) => gp.includes(x) && !/^[のにをはでへ]|[のにをはでへ]$/.test(x)).length;
    const total = score + cjkScore;
    if (total > 0 && (!best || total > best.score)) best = { g, score: total };
  }
  return best?.g;
}

function guessCategory(title: string, kind: "expense" | "income", categories: Category[], history: Transaction[]): ID | undefined {
  const live = categories.filter((c) => c.kind === kind && !c.archived);
  const has = (id: ID) => live.some((c) => c.id === id);
  const t = title.toLowerCase().trim();
  if (!t) return undefined;
  // 1. the same words were written before — use that category («как в прошлый раз»)
  for (let i = history.length - 1; i >= 0; i--) {
    const tx = history[i];
    if (tx.kind === kind && tx.categoryId && tx.note && tx.note.toLowerCase().trim() === t && has(tx.categoryId)) return tx.categoryId;
  }
  // 2. a category named like that
  const byName = live.find((c) => words(c.name).some((w) => words(t).some((x) => x.startsWith(w.slice(0, 4)) || w.startsWith(x.slice(0, 4)))));
  if (byName) return byName.id;
  // 3. keywords
  for (const [rx, id] of kind === "income" ? INCOME_KEYWORDS : KEYWORDS) if (rx.test(t) && has(id)) return id;
  return undefined;
}

/** «The day before yesterday» and «yesterday» in each language, as extra regex alternatives. */
const PAST: Record<string, [string, string]> = {
  es: ["|anteayer|antier", "|ayer"],
  fr: ["|avant-hier", "|hier"],
  de: ["|vorgestern", "|gestern"],
  pt: ["|anteontem", "|ontem"],
  tr: ["|evvelsi gün|önceki gün", "|dün"]
};

export interface SmartContext {
  today: DayKey;
  categories: Category[];
  goals: Goal[];
  projects: Project[];
  /** Recent transactions, oldest first */
  history: Transaction[];
}

export function parseSmart(input: string, ctx: SmartContext): SmartResult {
  const text = input.trim();
  if (!text) return { kind: "empty" };

  // dates and times first: «в 18» is a time, not 18 ₽
  const task = parseTask(text, ctx.today, { projects: ctx.projects });
  const money = findAmount(task.title);

  if (money) {
    if (GOAL.test(text)) {
      const goal = findGoal(money.rest.replace(GOAL, " "), ctx.goals);
      if (goal) return { kind: "goal", amount: money.amount, goalId: goal.id, title: goal.name };
    }
    const kind = /^\+/.test(text) || INCOME.test(text) ? "income" : "expense";
    // money is usually written down after the fact: «вчера», «позавчера»
    let day = task.due && task.due <= ctx.today ? task.due : undefined;
    let rest = money.rest;
    const [before, yesterday] = PAST[getLang()] ?? ["", ""];
    const back = rest.match(new RegExp(`${S}(позавчера|day before yesterday${before}|вчера|yesterday${yesterday})${E}`, "iu")) ?? rest.match(/(前天|一昨日|おととい|昨天|昨日|きのう)/u);
    if (back) {
      day = addDays(ctx.today, /поза|before|^前|一昨|おとと/i.test(back[1]) || (before && new RegExp(`^(?:${before.slice(1)})$`, "iu").test(back[1])) ? -2 : -1);
      rest = rest.replace(back[0], " ");
    }
    // Hindi «कल» is both yesterday and tomorrow: with money, it is yesterday
    const kal = task.tokens.find((t) => t.kind === "date" && /^(कल|परसों)$/.test(t.text));
    if (getLang() === "hi" && kal) day = addDays(ctx.today, kal.text === "कल" ? -1 : -2);
    rest = rest.replace(/^\+/, "").replace(/\s+(на|за)$/iu, "").replace(/\s+/g, " ").trim();
    const title = rest.charAt(0).toUpperCase() + rest.slice(1);
    return { kind, amount: money.amount, title, categoryId: guessCategory(title, kind, ctx.categories, ctx.history), day };
  }
  return { kind: "task", task };
}
