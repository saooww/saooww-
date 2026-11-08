import { parseTask, type ParsedTask } from "./quickParse";
import { addDays, type DayKey } from "./dates";
import type { Minor } from "./money";
import type { Category, Goal, ID, Project, Transaction } from "../store/types";

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
const INCOME = /(?<![\p{L}])(зарплат|зп|аванс|преми|кешб[эе]к|кэшб[эе]к|получил|поступлени|доход|вернули|возврат|продал|дивиденд|процент|фриланс|гонорар|подарили|salary|income|refund|cashback)/iu;
// «put aside for a goal»
const GOAL = /(?<![\p{L}])(отлож|накоп|копил|в цель|на цель|пополн|save|saving)/iu;

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
const AMOUNT = new RegExp(`${S}(\\d{1,3}(?:[  ]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?\\s*(к|k|тыс\\.?|т\\.?р\\.?)?\\s*(₽|р\\.?|руб\\.?|рублей|рубля|rub)?${E}`, "iu");

function findAmount(text: string): { amount: Minor; rest: string } | null {
  const m = text.match(AMOUNT);
  if (!m) return null;
  let value = Number(m[1].replace(/[  ]/g, "")) + (m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0);
  if (m[3]) value *= 1000;
  if (!value) return null;
  return { amount: Math.round(value * 100), rest: (text.slice(0, m.index) + " " + text.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim() };
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

/** The goal the text names, by its words («отпуск» → «Отпуск в Японии»). */
function findGoal(text: string, goals: Goal[]): Goal | undefined {
  const ws = words(text);
  let best: { g: Goal; score: number } | undefined;
  for (const g of goals) {
    if (g.archived) continue;
    const gw = words(g.name);
    const score = ws.filter((w) => gw.some((x) => x.startsWith(w.slice(0, Math.max(4, w.length - 2))) || w.startsWith(x.slice(0, Math.max(4, x.length - 2))))).length;
    if (score > 0 && (!best || score > best.score)) best = { g, score };
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
    const back = rest.match(new RegExp(`${S}(позавчера|вчера|yesterday)${E}`, "iu"));
    if (back) {
      day = addDays(ctx.today, /поза/i.test(back[1]) ? -2 : -1);
      rest = rest.replace(back[0], " ");
    }
    rest = rest.replace(/^\+/, "").replace(/\s+(на|за)$/iu, "").replace(/\s+/g, " ").trim();
    const title = rest.charAt(0).toUpperCase() + rest.slice(1);
    return { kind, amount: money.amount, title, categoryId: guessCategory(title, kind, ctx.categories, ctx.history), day };
  }
  return { kind: "task", task };
}
