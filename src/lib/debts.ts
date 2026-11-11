import type { Debt, ID, Transaction, Wallet } from "../store/types";
import type { DayKey } from "./dates";
import { dayOf } from "./dates";
import { debtInfo, type DebtInfo } from "./finance";
import type { Minor } from "./money";

/** One person with everything between you: several loans in one place. */
export interface DebtPerson {
  key: string;
  name: string;
  currency: string;
  debts: Array<{ debt: Debt; info: DebtInfo }>;
  /** What they still owe you */
  toMe: Minor;
  /** What you still owe them */
  fromMe: Minor;
  /** toMe − fromMe: positive — they owe you */
  net: Minor;
  /** How much of the open loans has come back, and how much was lent in all */
  paid: Minor;
  total: Minor;
  progress: number;
  /** The nearest due day among the open loans */
  nextDue?: DayKey;
  daysToDue: number | null;
  closed: boolean;
}

export const personKey = (name: string, currency: string) => `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${currency}`;

/** Groups loans by person (and currency); the same name written differently in case still counts as one person. */
export function debtPeople(debts: Debt[], txs: Transaction[], today: DayKey): DebtPerson[] {
  const map = new Map<string, DebtPerson>();
  for (const debt of debts) {
    const key = personKey(debt.counterparty, debt.currency);
    let p = map.get(key);
    if (!p) {
      p = { key, name: debt.counterparty.trim(), currency: debt.currency, debts: [], toMe: 0, fromMe: 0, net: 0, paid: 0, total: 0, progress: 0, daysToDue: null, closed: true };
      map.set(key, p);
    }
    const info = debtInfo(debt, txs, today);
    p.debts.push({ debt, info });
  }
  const out: DebtPerson[] = [];
  for (const p of map.values()) {
    p.debts.sort((a, b) => (a.debt.date < b.debt.date ? -1 : a.debt.date > b.debt.date ? 1 : a.debt.createdAt < b.debt.createdAt ? -1 : 1));
    for (const { debt, info } of p.debts) {
      // returned and lent in all, closed loans included: «вернул 16 000 из 31 000»
      p.paid += info.paid;
      p.total += debt.amount;
      if (info.status === "closed") continue;
      p.closed = false;
      if (debt.direction === "owed_to_me") p.toMe += info.remaining;
      else p.fromMe += info.remaining;
      if (debt.dueDate && (!p.nextDue || debt.dueDate < p.nextDue)) {
        p.nextDue = debt.dueDate;
        p.daysToDue = info.daysToDue;
      }
    }
    p.net = p.toMe - p.fromMe;
    p.progress = p.total > 0 ? Math.min(1, p.paid / p.total) : 0;
    if (p.closed) p.progress = 1;
    out.push(p);
  }
  return out;
}

/**
 * Splits one repayment over the person's open loans of the given direction,
 * the oldest first; whatever is more than they owe is left over.
 */
export function splitRepayment(person: DebtPerson, direction: Debt["direction"], amount: Minor): { parts: Array<{ debtId: ID; amount: Minor }>; rest: Minor } {
  const parts: Array<{ debtId: ID; amount: Minor }> = [];
  let left = amount;
  for (const { debt, info } of person.debts) {
    if (left <= 0) break;
    if (debt.direction !== direction || info.status === "closed" || info.remaining <= 0) continue;
    const take = Math.min(left, info.remaining);
    parts.push({ debtId: debt.id, amount: take });
    left -= take;
  }
  return { parts, rest: left };
}

export interface DebtEvent {
  id: string;
  date: string;
  day: DayKey;
  kind: "open" | "payment";
  /** Money going your way (+) or away from you (−), from your side */
  signed: Minor;
  amount: Minor;
  debtId: ID;
  walletName?: string;
  note?: string;
  txId?: ID;
}

/** Everything that happened between you, newest first: loans given or taken, and each part returned — when and through which account. */
export function debtHistory(person: DebtPerson, txs: Transaction[], wallets: Wallet[]): DebtEvent[] {
  const ids = new Set(person.debts.map((x) => x.debt.id));
  const dir = new Map(person.debts.map((x) => [x.debt.id, x.debt.direction]));
  const wname = new Map(wallets.map((w) => [w.id, w.name]));
  const events: DebtEvent[] = [];
  const opened = new Set<ID>();
  for (const t of txs) {
    if (t.kind !== "debt" || !t.debtId || !ids.has(t.debtId)) continue;
    const mine = dir.get(t.debtId) === "owed_to_me";
    if (t.debtRole === "open") opened.add(t.debtId);
    // a loan I gave: money goes out (−); a repayment of it: comes back (+). A loan I took is the other way round.
    const sign = t.debtRole === "open" ? (mine ? -1 : 1) : mine ? 1 : -1;
    events.push({ id: t.id, date: t.date, day: dayOf(t.date), kind: t.debtRole === "open" ? "open" : "payment", signed: sign * t.amount, amount: t.amount, debtId: t.debtId, walletName: t.walletId ? wname.get(t.walletId) : undefined, note: t.note, txId: t.id });
  }
  // loans written down without moving money through an account have no transaction of their own
  for (const { debt } of person.debts) {
    if (opened.has(debt.id)) continue;
    const mine = debt.direction === "owed_to_me";
    events.push({ id: `open-${debt.id}`, date: `${debt.date}T00:00`, day: debt.date, kind: "open", signed: (mine ? -1 : 1) * debt.amount, amount: debt.amount, debtId: debt.id, note: debt.note });
  }
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
