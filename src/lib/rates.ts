import { nowISO, parseLocal } from "./dates";
import { useData } from "../store/store";
import { isEmbedded } from "./backupFile";

/**
 * Official Bank of Russia exchange rates, via the public JSON mirror of
 * the CBR daily feed. Only a plain GET — nothing about the user is sent.
 */
export const CBR_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

/** How often to look for new rates while the app is open. */
const STALE_MS = 6 * 60 * 60 * 1000;

export interface CbrRates {
  /** Date the rates are set for, YYYY-MM-DD */
  date: string;
  /** Roubles for one unit of each currency; RUB itself is 1 */
  rub: Record<string, number>;
}

interface CbrJson {
  Date?: string;
  Valute?: Record<string, { CharCode?: string; Nominal?: number; Value?: number }>;
}

export function parseCbr(json: CbrJson): CbrRates {
  const rub: Record<string, number> = { RUB: 1 };
  for (const v of Object.values(json.Valute ?? {})) {
    if (!v?.CharCode || !(v.Value! > 0) || !(v.Nominal! > 0)) continue;
    rub[v.CharCode] = v.Value! / v.Nominal!;
  }
  if (Object.keys(rub).length < 2) throw new Error("no rates in response");
  return { date: (json.Date ?? nowISO()).slice(0, 10), rub };
}

/** Units of `base` for one unit of each code — the shape of settings.rates. */
export function ratesFor(base: string, codes: Iterable<string>, rub: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const b = rub[base];
  if (!b) return out;
  for (const code of codes) {
    if (code === base || !rub[code]) continue;
    out[code] = Math.round((rub[code] / b) * 1e6) / 1e6;
  }
  return out;
}

export async function fetchCbr(timeoutMs = 8000): Promise<CbrRates> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(CBR_URL, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCbr(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export type RefreshResult = "updated" | "fresh" | "off" | "failed";
let inflight: Promise<RefreshResult> | null = null;

/** Updates settings.rates from the CBR when automatic rates are on and the last fetch is old. */
export function refreshRatesIfStale(force = false): Promise<RefreshResult> {
  if (inflight) return inflight;
  const s = useData.getState().settings;
  if (!s.autoRates && !force) return Promise.resolve("off");
  // Embedded previews (e.g. a Claude artifact) may not reach the network at all.
  if (!force && isEmbedded()) return Promise.resolve("off");
  if (!force && s.ratesFetchedAt && Date.now() - parseLocal(s.ratesFetchedAt).getTime() < STALE_MS) return Promise.resolve("fresh");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve("failed");

  inflight = (async (): Promise<RefreshResult> => {
    try {
      const cbr = await fetchCbr();
      const st = useData.getState();
      const codes = new Set([...st.wallets.map((w) => w.currency), ...Object.keys(st.settings.rates)]);
      const fresh = ratesFor(st.settings.baseCurrency, codes, cbr.rub);
      if (!Object.keys(fresh).length && codes.size > 1) return "failed";
      st.updateSettings({ rates: { ...st.settings.rates, ...fresh }, ratesDate: cbr.date, ratesFetchedAt: nowISO() });
      return "updated";
    } catch {
      return "failed";
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
