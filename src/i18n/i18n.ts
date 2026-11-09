/**
 * Languages. Russian is the source: every text in the code is Russian and
 * goes through t(); a dictionary for the chosen language maps it to the
 * translation (missing ones fall back to Russian). The language is kept in
 * localStorage too, so it is known synchronously before anything renders,
 * and switching it reloads the app — texts built at module load follow.
 */
export type Lang = "ru" | "en" | "es" | "fr" | "de" | "pt" | "tr" | "zh" | "ja" | "hi";

/** Each language with its own name, locale and the likely starting currency and number style. */
export const LANGS: Array<{ id: Lang; name: string; locale: string; currency: string; numbers: "ru" | "en" }> = [
  { id: "ru", name: "Русский", locale: "ru-RU", currency: "RUB", numbers: "ru" },
  { id: "en", name: "English", locale: "en-GB", currency: "USD", numbers: "en" },
  { id: "es", name: "Español", locale: "es-ES", currency: "EUR", numbers: "ru" },
  { id: "fr", name: "Français", locale: "fr-FR", currency: "EUR", numbers: "ru" },
  { id: "de", name: "Deutsch", locale: "de-DE", currency: "EUR", numbers: "ru" },
  { id: "pt", name: "Português", locale: "pt-BR", currency: "BRL", numbers: "ru" },
  { id: "tr", name: "Türkçe", locale: "tr-TR", currency: "TRY", numbers: "ru" },
  { id: "zh", name: "中文", locale: "zh-CN", currency: "CNY", numbers: "en" },
  { id: "ja", name: "日本語", locale: "ja-JP", currency: "JPY", numbers: "en" },
  { id: "hi", name: "हिन्दी", locale: "hi-IN", currency: "INR", numbers: "en" }
];

const KEY = "ardessa-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.id === saved)) return saved;
  } catch {
    /* private mode */
  }
  const nav = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const n of nav) {
    const code = n?.slice(0, 2).toLowerCase() as Lang;
    if (LANGS.some((l) => l.id === code)) return code;
  }
  return "ru";
}

let lang: Lang = detect();
type Dict = Record<string, string | Record<string, string>>;
let dict: Dict = {};

export const getLang = (): Lang => lang;
export const langInfo = () => LANGS.find((l) => l.id === lang)!;
export const locale = (): string => langInfo().locale;

/** A language's name in the current one — «English» → «английский». */
export function languageName(id: Lang): string {
  try {
    const n = new Intl.DisplayNames([locale()], { type: "language" }).of(id);
    return n ? n.charAt(0).toLocaleUpperCase(locale()) + n.slice(1) : id;
  } catch {
    return id;
  }
}

/** Loads the chosen language's dictionary; call before the app renders. */
export async function loadLanguage(): Promise<void> {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  if (lang === "ru") return;
  try {
    dict = (await import(`./locales/${lang}.json`)).default as Dict;
  } catch {
    dict = {};
  }
}

/** Saves the language and restarts the app in it. */
export function switchLanguage(next: Lang, restart = true) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  lang = next;
  if (restart) window.location.reload();
}

/**
 * Translate. Placeholders {0}, {1}… are filled with the extra arguments,
 * so the word order can change between languages.
 */
export function t(ru: string, ...args: Array<string | number>): string {
  const tr = lang === "ru" ? ru : dict[ru];
  const s = typeof tr === "string" ? tr : ru;
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[+i] !== undefined ? String(args[+i]) : m)) : s;
}

/**
 * The plural form of a Russian word for n — «1 дело / 2 дела / 5 дел» —
 * in the current language: the dictionary keeps the forms by plural
 * category («one», «other», …) under the key «дело|дела|дел».
 */
export function pluralForm(n: number, forms: [string, string, string]): string {
  if (lang !== "ru") {
    const tr = dict[forms.join("|")];
    if (tr && typeof tr === "object") {
      const cat = new Intl.PluralRules(locale()).select(n);
      return tr[cat] ?? tr.other ?? tr.one ?? forms[2];
    }
  }
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** t under a name no callback parameter shadows (`(t) => …` is everywhere). */
export const tr = t;
