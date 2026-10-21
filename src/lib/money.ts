/**
 * Money is stored as integer minor units (kopecks, cents) to avoid
 * floating-point drift. Everything that touches amounts goes through here.
 */

export type Minor = number;

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "RUB", symbol: "₽", name: "Российский рубль" },
  { code: "USD", symbol: "$", name: "Доллар США" },
  { code: "EUR", symbol: "€", name: "Евро" },
  { code: "CNY", symbol: "¥", name: "Китайский юань" },
  { code: "KZT", symbol: "₸", name: "Казахстанский тенге" },
  { code: "BYN", symbol: "Br", name: "Белорусский рубль" },
  { code: "GBP", symbol: "£", name: "Фунт стерлингов" },
  { code: "TRY", symbol: "₺", name: "Турецкая лира" },
  { code: "AED", symbol: "AED", name: "Дирхам ОАЭ" },
  { code: "GEL", symbol: "₾", name: "Грузинский лари" },
  { code: "AMD", symbol: "֏", name: "Армянский драм" }
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string): CurrencyInfo {
  return BY_CODE.get(code) ?? { code, symbol: code, name: code };
}

export function currencySymbol(code: string): string {
  return currencyInfo(code).symbol;
}

/* ------------------------------------------------------------------ */
/*  Format configuration (driven by settings)                          */
/* ------------------------------------------------------------------ */

export type NumberFormat = "ru" | "en";
export type KopecksMode = "auto" | "always" | "never";

const fmtConfig: { numberFormat: NumberFormat; kopecks: KopecksMode } = {
  numberFormat: "ru",
  kopecks: "auto"
};

export function setMoneyFormat(numberFormat: NumberFormat, kopecks: KopecksMode) {
  fmtConfig.numberFormat = numberFormat;
  fmtConfig.kopecks = kopecks;
}

export function getMoneyFormat() {
  return fmtConfig;
}

/** Narrow no-break space for digit groups, no-break space before the symbol. */
const GROUP_RU = " ";
const NBSP = " ";
export const MINUS = "−";

function groupDigits(intStr: string, sep: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export interface MoneyParts {
  sign: "" | "+" | typeof MINUS;
  int: string;
  frac: string; // includes the decimal separator, or ""
  symbol: string;
}

export interface FormatOptions {
  currency?: string;
  /** "auto" — minus only; "always" — plus/minus; "never" — absolute value */
  sign?: "auto" | "always" | "never";
  kopecks?: KopecksMode;
}

export function moneyParts(minor: Minor, opts: FormatOptions = {}): MoneyParts {
  const currency = opts.currency ?? "RUB";
  const signMode = opts.sign ?? "auto";
  const kopecks = opts.kopecks ?? fmtConfig.kopecks;
  const abs = Math.abs(Math.round(minor));
  const intPart = Math.floor(abs / 100);
  const fracPart = abs % 100;
  const groupSep = fmtConfig.numberFormat === "ru" ? GROUP_RU : ",";
  const decSep = fmtConfig.numberFormat === "ru" ? "," : ".";
  const showFrac = kopecks === "always" || (kopecks === "auto" && fracPart !== 0);
  let sign: MoneyParts["sign"] = "";
  if (signMode === "always" && minor !== 0) sign = minor > 0 ? "+" : MINUS;
  else if (signMode === "auto" && minor < 0) sign = MINUS;
  return {
    sign,
    int: groupDigits(String(intPart), groupSep),
    frac: showFrac ? decSep + String(fracPart).padStart(2, "0") : "",
    symbol: currencySymbol(currency)
  };
}

export function formatMoney(minor: Minor, opts: FormatOptions = {}): string {
  const p = moneyParts(minor, opts);
  return `${p.sign}${p.int}${p.frac}${NBSP}${p.symbol}`;
}

/** Number without currency symbol */
export function formatNumber(minor: Minor, opts: Omit<FormatOptions, "currency"> = {}): string {
  const p = moneyParts(minor, opts);
  return `${p.sign}${p.int}${p.frac}`;
}

/** Compact amounts for chart axes and dense summaries: 12,4 тыс · 1,2 млн */
export function formatCompact(minor: Minor, currency?: string): string {
  const major = Math.abs(minor) / 100;
  const sign = minor < 0 ? MINUS : "";
  const dec = fmtConfig.numberFormat === "ru" ? "," : ".";
  let out: string;
  if (major >= 1_000_000) out = trimDec((major / 1_000_000).toFixed(major >= 10_000_000 ? 0 : 1), dec) + NBSP + "млн";
  else if (major >= 1_000) out = trimDec((major / 1_000).toFixed(major >= 100_000 ? 0 : 1), dec) + NBSP + "тыс";
  else out = String(Math.round(major));
  return sign + out + (currency ? NBSP + currencySymbol(currency) : "");
}

function trimDec(s: string, dec: string): string {
  return s.replace(/\.0$/, "").replace(".", dec);
}

export function formatPercent(value: number, digits = 0): string {
  const dec = fmtConfig.numberFormat === "ru" ? "," : ".";
  const s = (Math.abs(value) * 100).toFixed(digits).replace(".", dec);
  return `${value < 0 ? MINUS : ""}${s}%`;
}

/* ------------------------------------------------------------------ */
/*  Input parsing                                                      */
/* ------------------------------------------------------------------ */

/** Keypad buffer such as "1250,5" → 125050 minor units. */
export function parseAmount(input: string): Minor {
  const clean = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!clean || clean === ".") return 0;
  const n = Number(clean);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Minor units → keypad buffer: 125050 → "1250,5" */
export function amountToInput(minor: Minor): string {
  if (!minor) return "";
  const abs = Math.abs(minor);
  const int = Math.floor(abs / 100);
  const frac = abs % 100;
  if (!frac) return String(int);
  const f = String(frac).padStart(2, "0").replace(/0$/, "");
  return `${int},${f}`;
}

/** Format an in-progress keypad buffer for display (groups digits, keeps trailing comma). */
export function formatInputBuffer(buffer: string): { int: string; frac: string } {
  if (!buffer) return { int: "0", frac: "" };
  const [i, f] = buffer.split(",");
  const groupSep = fmtConfig.numberFormat === "ru" ? GROUP_RU : ",";
  const decSep = fmtConfig.numberFormat === "ru" ? "," : ".";
  return {
    int: groupDigits(i || "0", groupSep),
    frac: f !== undefined ? decSep + f : ""
  };
}

export function sumMinor(values: Iterable<number>): Minor {
  let s = 0;
  for (const v of values) s += v;
  return s;
}
