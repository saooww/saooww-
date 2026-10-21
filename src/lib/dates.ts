/**
 * Dates are stored as local, timezone-free strings:
 *   day keys   — "YYYY-MM-DD"
 *   timestamps — "YYYY-MM-DDTHH:mm"
 * Both sort correctly as plain strings and never shift across time zones.
 */

export type DayKey = string;
export type LocalISO = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalISO(d: Date): LocalISO {
  return `${toDayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function nowISO(): LocalISO {
  return toLocalISO(new Date());
}

export function dayOf(iso: LocalISO | DayKey): DayKey {
  return iso.slice(0, 10);
}

export function timeOf(iso: LocalISO): string {
  return iso.length >= 16 ? iso.slice(11, 16) : "";
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function parseLocal(iso: LocalISO): Date {
  const d = parseDay(iso);
  if (iso.length >= 16) {
    d.setHours(Number(iso.slice(11, 13)), Number(iso.slice(14, 16)));
  }
  return d;
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Adds months keeping the anchor day where possible (31 Jan + 1 → 28/29 Feb). */
export function addMonths(key: DayKey, n: number, anchorDay?: number): DayKey {
  const d = parseDay(key);
  const day = anchorDay ?? d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dim = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(day, dim));
  return toDayKey(target);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function startOfMonth(key: DayKey): DayKey {
  return key.slice(0, 8) + "01";
}

export function endOfMonth(key: DayKey): DayKey {
  const d = parseDay(key);
  return `${key.slice(0, 8)}${pad(daysInMonth(d.getFullYear(), d.getMonth()))}`;
}

/** Monday-based week start */
export function startOfWeek(key: DayKey): DayKey {
  const d = parseDay(key);
  const dow = (d.getDay() + 6) % 7;
  return addDays(key, -dow);
}

export function startOfQuarter(key: DayKey): DayKey {
  const d = parseDay(key);
  const q = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${pad(q + 1)}-01`;
}

export function startOfYear(key: DayKey): DayKey {
  return `${key.slice(0, 4)}-01-01`;
}

export function diffDays(a: DayKey, b: DayKey): number {
  const ms = parseDay(a).getTime() - parseDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 4000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function weekdayIndex(key: DayKey): number {
  return (parseDay(key).getDay() + 6) % 7; // 0 = Monday
}

/* ------------------------------------------------------------------ */
/*  Russian names                                                      */
/* ------------------------------------------------------------------ */

export const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTHS_SHORT_NOM = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
export const WEEKDAYS_LONG = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
export const WEEKDAYS_ACC = ["понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам", "воскресеньям"];

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function pluralN(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export type DateStyle = "short" | "numeric";

let dateStyle: DateStyle = "short";
export function setDateStyle(s: DateStyle) {
  dateStyle = s;
}

/** "21 окт" / "21 окт 2025" (if not current year) / "21.10.2026" */
export function formatDate(key: DayKey, opts: { year?: "auto" | "always" | "never"; long?: boolean } = {}): string {
  const d = parseDay(key);
  const yearMode = opts.year ?? "auto";
  const thisYear = new Date().getFullYear();
  if (dateStyle === "numeric") {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  const showYear = yearMode === "always" || (yearMode === "auto" && d.getFullYear() !== thisYear);
  const month = opts.long ? MONTHS_GEN[d.getMonth()] : MONTHS_SHORT[d.getMonth()];
  return `${d.getDate()} ${month}${showYear ? ` ${d.getFullYear()}` : ""}`;
}

/** "Сегодня" · "Вчера" · "Завтра" · "Пятница, 17 октября" */
export function formatDayHeading(key: DayKey): string {
  const today = todayKey();
  const delta = diffDays(key, today);
  if (delta === 0) return "Сегодня";
  if (delta === -1) return "Вчера";
  if (delta === 1) return "Завтра";
  const d = parseDay(key);
  const wd = capitalize(WEEKDAYS_LONG[weekdayIndex(key)]);
  if (dateStyle === "numeric") return `${wd}, ${formatDate(key)}`;
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${wd}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${year}`;
}

/** Short relative label: "сегодня", "завтра", "через 3 дня", "2 дня назад" */
export function formatRelative(key: DayKey): string {
  const delta = diffDays(key, todayKey());
  if (delta === 0) return "сегодня";
  if (delta === 1) return "завтра";
  if (delta === -1) return "вчера";
  if (delta > 1) return `через ${pluralN(delta, ["день", "дня", "дней"])}`;
  return `${pluralN(-delta, ["день", "дня", "дней"])} назад`;
}

/** "21 окт, 14:32" */
export function formatDateTime(iso: LocalISO): string {
  const t = timeOf(iso);
  return t ? `${formatDate(dayOf(iso))}, ${t}` : formatDate(dayOf(iso));
}

export function monthTitle(key: DayKey, withYear: "auto" | "always" = "auto"): string {
  const d = parseDay(key);
  const y = d.getFullYear();
  const showYear = withYear === "always" || y !== new Date().getFullYear();
  return capitalize(MONTHS_NOM[d.getMonth()]) + (showYear ? ` ${y}` : "");
}

export function monthsBetween(from: DayKey, to: DayKey): number {
  const a = parseDay(from);
  const b = parseDay(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
}
