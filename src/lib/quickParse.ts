import type { ID, TaskRepeat } from "../store/types";
import { WEEKDAYS_ACC, addDays, addMonths, capitalize, daysInMonth, formatDate, weekdayIndex, type DayKey } from "./dates";
import { REPEAT_LABEL, dueLabel } from "./tasks";
import { tr } from "../i18n/i18n";

/**
 * Reads a task written the way people think it:
 *   «Позвонить маме завтра в 18:00»
 *   «Отчёт к пятнице #работа !!»
 *   «Оплатить интернет каждый месяц 15 ноября»
 * and splits it into a title, a date, a time, a repeat, a list and a priority.
 */

export type TokenKind = "date" | "time" | "repeat" | "priority" | "project";

export interface ParseToken {
  kind: TokenKind;
  /** The words that were recognised */
  text: string;
  /** How the result reads in the interface */
  label: string;
}

export interface ParsedTask {
  title: string;
  due?: DayKey;
  time?: string;
  repeat?: TaskRepeat;
  priority?: 0 | 1 | 2;
  projectId?: ID;
  tokens: ParseToken[];
}

// Unicode-aware word edges: \b knows only Latin letters (marks count too: Hindi vowel signs).
const S = "(?<![\\p{L}\\p{M}\\p{N}])";
const E = "(?![\\p{L}\\p{M}\\p{N}])";
// Chinese and Japanese have no spaces between words: no edges there
const cjk = (src: string) => new RegExp(src, "u");

/* Day words of the other languages; Russian ones are below, with their grammar. */
const DAY_AFTER = "day\\s+after\\s+tomorrow|pasado\\s+mañana|après-demain|übermorgen|depois\\s+de\\s+amanhã|öbür\\s+gün|परसों";
const TOMORROW = "tomorrow|mañana|demain|morgen|amanhã|yarın|कल";
const TODAY = "today|hoy|aujourd'hui|heute|hoje|bugün|आज";
const re = (src: string) => new RegExp(S + src + E, "iu");

const WEEKDAY_FORMS: Array<{ i: number; forms: string[] }> = [
  { i: 0, forms: ["понедельник", "понедельника", "понедельнику", "понедельникам", "пн"] },
  { i: 1, forms: ["вторник", "вторника", "вторнику", "вторникам", "вт"] },
  { i: 2, forms: ["среду", "среда", "среды", "среде", "средам", "ср"] },
  { i: 3, forms: ["четверг", "четверга", "четвергу", "четвергам", "чт"] },
  { i: 4, forms: ["пятницу", "пятница", "пятницы", "пятнице", "пятницам", "пт"] },
  { i: 5, forms: ["субботу", "суббота", "субботы", "субботе", "субботам", "сб"] },
  { i: 6, forms: ["воскресенье", "воскресенья", "воскресенью", "воскресеньям", "вс"] }
];

function weekdayOf(word: string): number | undefined {
  const w = word.toLowerCase();
  return WEEKDAY_FORMS.find((x) => x.forms.includes(w))?.i;
}

const ALL_WEEKDAYS = WEEKDAY_FORMS.flatMap((x) => x.forms).sort((a, b) => b.length - a.length).join("|");
const FULL_WEEKDAYS = WEEKDAY_FORMS.flatMap((x) => x.forms.filter((f) => f.length > 2)).sort((a, b) => b.length - a.length).join("|");

const MONTH_STEMS = ["янв", "фев", "мар", "апр", "ма", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTH_WORD = "(января|янв|февраля|фев|марта|мар|апреля|апр|мая|июня|июн|июля|июл|августа|авг|сентября|сент|сен|октября|окт|ноября|нояб|ноя|декабря|дек)";

function monthOf(word: string): number {
  const w = word.toLowerCase();
  if (w === "мая") return 4;
  if (w.startsWith("мар")) return 2;
  return MONTH_STEMS.findIndex((stem) => w.startsWith(stem));
}

/** The next given weekday; the same weekday means a week later (today is «сегодня»). */
function nextWeekday(today: DayKey, i: number, allowToday = false): DayKey {
  let delta = (i - weekdayIndex(today) + 7) % 7;
  if (delta === 0 && !allowToday) delta = 7;
  return addDays(today, delta);
}

function validDay(y: number, m0: number, d: number): DayKey | undefined {
  if (m0 < 0 || m0 > 11 || d < 1 || d > daysInMonth(y, m0)) return undefined;
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A date without a year that has already passed this year means next year. */
function dayMonth(today: DayKey, d: number, m0: number, year?: number): DayKey | undefined {
  const y = year ?? Number(today.slice(0, 4));
  const key = validDay(y, m0, d);
  if (!key) return undefined;
  if (year === undefined && key < today) return validDay(y + 1, m0, d);
  return key;
}

const NUM_WORDS: Record<string, number> = { один: 1, одну: 1, два: 2, две: 2, пару: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, десять: 10 };

const pad = (n: number) => String(n).padStart(2, "0");

export interface ParseOptions {
  projects?: Array<{ id: ID; name: string }>;
  /** Kinds the person switched off for this text */
  ignore?: ReadonlySet<TokenKind>;
  /** Day a time alone refers to (otherwise today or tomorrow) */
  defaultDue?: DayKey;
}

export function parseTask(input: string, today: DayKey, opts: ParseOptions = {}): ParsedTask {
  const ignore = opts.ignore ?? new Set<TokenKind>();
  let rest = ` ${input} `;
  const out: ParsedTask = { title: "", tokens: [] };

  /** Finds the first match, removes it from the text and returns it. */
  const take = (rx: RegExp): RegExpMatchArray | null => {
    const m = rest.match(rx);
    if (!m || m.index === undefined) return null;
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`;
    return m;
  };
  const token = (kind: TokenKind, text: string, label: string) => out.tokens.push({ kind, text: text.trim(), label });

  /* ---------- repeat ---------- */
  let weeklyOn: number | undefined;
  if (!ignore.has("repeat")) {
    let m: RegExpMatchArray | null;
    if ((m = take(re("(по\\s+будням|каждый\\s+будний\\s+день|в\\s+будни)")))) {
      out.repeat = "weekdays";
    } else if ((m = take(re(`(?:кажд(?:ый|ую|ое)|по)\\s+(${FULL_WEEKDAYS})`)))) {
      const i = weekdayOf(m[1]);
      if (i !== undefined) {
        out.repeat = "week";
        weeklyOn = i;
        if (!ignore.has("date")) out.due = nextWeekday(today, i, true);
      }
    } else if ((m = take(re("(кажд(?:ый|ую|ое)\\s+(день|неделю|месяц|год)|ежедневно|еженедельно|ежемесячно|ежегодно)")))) {
      const w = m[0].toLowerCase();
      out.repeat = /день|ежедн/.test(w) ? "day" : /недел/.test(w) ? "week" : /месяц|ежемес/.test(w) ? "month" : "year";
    }
    if (out.repeat && m) token("repeat", m[0], weeklyOn !== undefined ? capitalize(`по ${WEEKDAYS_ACC[weeklyOn]}`) : REPEAT_LABEL[out.repeat]);
  }

  /* ---------- date ---------- */
  if (!ignore.has("date") && !out.due) {
    const rules: Array<[RegExp, (m: RegExpMatchArray) => DayKey | undefined]> = [
      [re("сегодня"), () => today],
      [re("послезавтра"), () => addDays(today, 2)],
      [re("завтра"), () => addDays(today, 1)],
      [re(`(?:${DAY_AFTER})`), () => addDays(today, 2)],
      [re(`(?:${TOMORROW})`), () => addDays(today, 1)],
      [re(`(?:${TODAY})`), () => today],
      [cjk("后天|明後日|あさって"), () => addDays(today, 2)],
      [cjk("明天|明日|あした"), () => addDays(today, 1)],
      [cjk("今天|今日|きょう"), () => today],
      [re("на\\s+выходных"), () => {
        const wd = weekdayIndex(today);
        return wd >= 5 ? today : addDays(today, 5 - wd);
      }],
      [re("на\\s+следующей\\s+неделе"), () => addDays(today, 7 - weekdayIndex(today))],
      [re("через\\s+(\\d{1,3}|один|одну|два|две|пару|три|четыре|пять|шесть|семь|десять)?\\s*(день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев|год|года|лет)"), (m) => {
        const n = m[1] ? Number(m[1]) || NUM_WORDS[m[1].toLowerCase()] || 1 : 1;
        const unit = m[2].toLowerCase();
        if (unit.startsWith("д")) return addDays(today, n);
        if (unit.startsWith("н")) return addDays(today, 7 * n);
        if (unit.startsWith("м")) return addMonths(today, n);
        return addMonths(today, 12 * n);
      }],
      [re(`(?:(?:к|до|на)\\s+)?(\\d{1,2})\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?`), (m) => dayMonth(today, Number(m[1]), monthOf(m[2]), m[3] ? Number(m[3]) : undefined)],
      // «в 10.30» is a time, not a date
      [new RegExp(`(?<!(?<![\\p{L}])в\\s{1,3})${S}(?:(?:к|до|на)\\s+)?(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{4}|\\d{2}))?${E}`, "iu"), (m) => {
        const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        return dayMonth(today, Number(m[1]), Number(m[2]) - 1, y);
      }],
      [re(`(?:в|во|к|до)\\s+(${ALL_WEEKDAYS})`), (m) => {
        const i = weekdayOf(m[1]);
        return i === undefined ? undefined : nextWeekday(today, i);
      }]
    ];
    for (const [rx, fn] of rules) {
      const probe = rest.match(rx);
      if (!probe) continue;
      const due = fn(probe);
      if (!due) continue;
      const m = take(rx)!;
      out.due = due;
      token("date", m[0], dateLabel(due, today));
      break;
    }
  } else if (out.due) {
    // «по понедельникам» also sets the first date
    token("date", "", dateLabel(out.due, today));
  }

  /* ---------- priority ---------- */
  if (!ignore.has("priority")) {
    const m = take(/(?<=\s)(!{1,3})(?=\s)/u);
    if (m) {
      out.priority = m[1].length >= 2 ? 2 : 1;
      token("priority", m[0], out.priority === 2 ? tr("Срочно") : tr("Важно"));
    } else if (re("срочно").test(rest)) {
      out.priority = 2;
      token("priority", "", tr("Срочно"));
    }
  }

  /* ---------- list ---------- */
  if (!ignore.has("project") && opts.projects?.length) {
    const tagRx = /(?<=\s)#([\p{L}\p{N}_-]+)/u;
    const probe = rest.match(tagRx);
    if (probe) {
      const norm = (v: string) => v.toLowerCase().replace(/[\s_-]/g, "");
      const q = norm(probe[1]);
      const project = opts.projects.find((p) => norm(p.name) === q) ?? opts.projects.find((p) => norm(p.name).startsWith(q));
      if (project) {
        const m = take(tagRx)!;
        out.projectId = project.id;
        token("project", m[0], project.name);
      }
    }
  }

  /* ---------- time ---------- */
  if (!ignore.has("time")) {
    // «в 10» counts as a time only at the end of the phrase or before a preposition: «в 10 с Ивановым», not «в 3 кассе».
    const after = `(?=\\s*(?:[,.;!?]|$)|\\s+(?:с|со|и|на|у|в|во|по|для|к|ко|около|возле|при|про)${E})`;
    let h: number | undefined;
    let min = 0;
    let part: "morning" | "day" | "evening" | "night" | undefined;
    let loose = false;
    let text = "";
    let m: RegExpMatchArray | null;
    const HOUR = "([01]?\\d|2[0-3])(?:\\s*(?:ч|час|часа|часов))?";
    const PART_WORD = "(утра|дня|вечера|ночи|утром|днём|днем|вечером|ночью)";
    if ((m = take(re("(?:в\\s+|at\\s+|um\\s+|à\\s+|a\\s+las\\s+|às\\s+|saat\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)(?:\\s*uhr)?"))) || (m = take(re("в\\s+([01]?\\d|2[0-3])\\.([0-5]\\d)")))) {
      h = Number(m[1]);
      min = Number(m[2]);
      text = m[0];
    } else if ((m = take(re("(?:at\\s+)?(1[0-2]|0?[1-9])(?:[:.]([0-5]\\d))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)")))) {
      // «6pm», «at 7:30 am»
      h = Number(m[1]) % 12 + (/^p/i.test(m[3]) ? 12 : 0);
      min = Number(m[2] ?? 0);
      text = m[0];
    } else if ((m = take(re("(?:at|um|à|a\\s+las|alle|às|saat)\\s+([01]?\\d|2[0-3])(?:[.h]([0-5]\\d))?(?:\\s*(?:uhr|h))?")))) {
      // «at 18», «um 18 Uhr», «à 18 h», «a las 18», «às 18»
      h = Number(m[1]);
      min = Number(m[2] ?? 0);
      text = m[0];
    } else if ((m = take(re("([01]?\\d|2[0-3])(?:[:.]([0-5]\\d))?'(?:de|da|te|ta)")))) {
      // Turkish «18'de»
      h = Number(m[1]);
      min = Number(m[2] ?? 0);
      text = m[0];
    } else if ((m = take(cjk("(上午|早上|中午|下午|晚上|午前|午後)?\\s*([01]?\\d|2[0-3])\\s*[点點時](?:\\s*(半)|\\s*([0-5]?\\d)\\s*分)?")))) {
      // «下午6点», «18時»
      h = Number(m[2]);
      if (m[1] && /下午|晚上|午後/.test(m[1]) && h < 12) h += 12;
      min = m[3] ? 30 : Number(m[4] ?? 0);
      text = m[0];
    } else if ((m = take(re("(?:(सुबह|दोपहर|शाम|रात)\\s+)?([01]?\\d|2[0-3])(?:[:.]([0-5]\\d))?\\s*बजे")))) {
      // «शाम 6 बजे»
      h = Number(m[2]);
      if (m[1] && m[1] !== "सुबह" && h < 12) h += 12;
      min = Number(m[3] ?? 0);
      text = m[0];
    } else if ((m = take(re(`в\\s+${HOUR}\\s+${PART_WORD}`)))) {
      // «в 7 вечера», «в 9 утром»
      h = Number(m[1]);
      part = partOf(m[2]);
      text = m[0];
    } else if ((m = take(re(`${PART_WORD}\\s+в\\s+${HOUR}`)))) {
      // «утром в 9»
      h = Number(m[2]);
      part = partOf(m[1]);
      text = m[0];
    } else if ((m = take(new RegExp(`${S}в\\s+${HOUR}${E}${after}`, "iu")))) {
      h = Number(m[1]);
      loose = true;
      text = m[0];
    }
    const dayPart = rest.match(re("(утром|днём|днем|вечером|ночью)"));
    if (dayPart && (h !== undefined || !/ночью/i.test(dayPart[1]))) {
      take(re("(утром|днём|днем|вечером|ночью)"));
      text = `${text} ${dayPart[0]}`;
      const w = dayPart[1].toLowerCase();
      part ??= partOf(w);
      if (h === undefined) h = part === "morning" ? 9 : part === "evening" ? 19 : 13;
    }
    if (h !== undefined) {
      if (part === "day" || part === "evening") h = h < 12 ? h + 12 : h;
      else if ((part === "night" || part === "morning") && h === 12) h = 0;
      else if (!part && loose && h >= 1 && h <= 6) h += 12;
      out.time = `${pad(h)}:${pad(min)}`;
      token("time", text, out.time);
      if (!out.due && !ignore.has("date")) {
        // A time alone means the default day: today, or tomorrow if it has passed.
        const now = new Date();
        const passed = `${pad(now.getHours())}:${pad(now.getMinutes())}` > out.time;
        out.due = opts.defaultDue ?? (passed ? addDays(today, 1) : today);
        token("date", "", dateLabel(out.due, today));
      }
    }
  }

  const title = rest
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, "")
    // Japanese particles left at the edge once a date or time is cut out: «明日18時に母に電話»
    .replace(/^[にでへはを、，]+/u, "")
    .trim();
  out.title = title ? title[0].toUpperCase() + title.slice(1) : "";
  return out;
}

function partOf(word: string): "morning" | "day" | "evening" | "night" {
  const w = word.toLowerCase();
  if (w.startsWith("утр")) return "morning";
  if (w.startsWith("веч")) return "evening";
  if (w.startsWith("ноч")) return "night";
  return "day";
}

function dateLabel(due: DayKey, today: DayKey): string {
  const l = dueLabel(due, today);
  // a bare weekday («Чт», «Thu») also gets its date
  return /^\p{Lu}\p{Ll}{1,2}\.?$/u.test(l) ? `${l}, ${formatDate(due)}` : l;
}

/** Several lines pasted at once become several tasks. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–—•*·]|\d+[.)]|\[\s?[xх]?\s?\]|[☐☑✓✔])\s*/iu, "").trim())
    .filter(Boolean);
}
