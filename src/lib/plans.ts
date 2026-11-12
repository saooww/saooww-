import type { DayKey } from "./dates";
import type { Plan, Transaction } from "../store/types";
import type { Minor } from "./money";

/** What has already come in (or gone out) against a plan, part by part. */
export function planReceived(plan: Plan, transactions: Transaction[]): Minor {
  let sum = 0;
  for (const t of transactions) if (t.planId === plan.id) sum += t.amount;
  return sum;
}

/** What is still to come: the whole sum minus the parts received; nothing once the plan is closed. */
export function planLeft(plan: Plan, transactions: Transaction[]): Minor {
  if (plan.status !== "planned") return 0;
  return Math.max(0, plan.amount - planReceived(plan, transactions));
}

/** One dated piece of a plan with how much of it has already come in. */
export interface PlanSlot {
  id: string;
  date: DayKey;
  amount: Minor;
  label?: string;
  got: Minor;
  left: Minor;
  state: "done" | "partial" | "open";
}

/**
 * The plan as a schedule: its dated parts (or the single date) with the money
 * received. Money meant for a particular payment (an advance that came early)
 * goes to it first; the rest covers the payments oldest first. A salary of
 * 26 + 26 + 18 thousand where 20 thousand has arrived shows the first piece 20
 * of 26 in. Received money beyond the schedule is simply extra.
 */
export function planSchedule(plan: Plan, transactions: Transaction[]): PlanSlot[] {
  const raw = plan.parts?.length ? [...plan.parts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : [{ id: "all", date: plan.date, amount: plan.amount, label: undefined as string | undefined }];
  const got = new Map<string, Minor>(raw.map((p) => [p.id, 0]));
  let pool = 0;
  for (const t of transactions) {
    if (t.planId !== plan.id) continue;
    const part = t.planPartId ? raw.find((p) => p.id === t.planPartId) : undefined;
    if (!part) {
      pool += t.amount;
      continue;
    }
    const room = part.amount - (got.get(part.id) ?? 0);
    const take = Math.min(room, t.amount);
    got.set(part.id, (got.get(part.id) ?? 0) + take);
    pool += t.amount - take;
  }
  return raw.map((p) => {
    const have = got.get(p.id) ?? 0;
    const extra = Math.min(p.amount - have, pool);
    pool -= extra;
    const total = have + extra;
    const left = p.amount - total;
    return { id: p.id, date: p.date, amount: p.amount, label: p.label, got: total, left, state: left === 0 ? "done" : total > 0 ? "partial" : "open" };
  });
}

/** Money received beyond what the plan expected (a salary of 70 000 that came to 71 000). */
export function planSurplus(plan: Plan, transactions: Transaction[]): Minor {
  return Math.max(0, planReceived(plan, transactions) - plan.amount);
}

/** What the forecast still waits for, each piece on its own date; nothing for a closed plan. */
export function planItems(plan: Plan, transactions: Transaction[]): Array<{ date: DayKey; amount: Minor }> {
  if (plan.status !== "planned") return [];
  return planSchedule(plan, transactions)
    .filter((x) => x.left > 0)
    .map((x) => ({ date: x.date, amount: x.left }));
}

/** The next piece to wait for: the first one not fully in. */
export function nextSlot(plan: Plan, transactions: Transaction[]): PlanSlot | undefined {
  return plan.status === "planned" ? planSchedule(plan, transactions).find((x) => x.left > 0) : undefined;
}

/** The same schedule a month later (the 31st becomes the 28th in February), as an estimate until confirmed. */
export function nextMonthPlan(plan: Plan, shift: (day: DayKey) => DayKey): Omit<Plan, "id" | "createdAt" | "status" | "txId"> {
  const parts = plan.parts?.map((p, i) => ({ id: `${i}`, date: shift(p.date), amount: p.amount, label: p.label }));
  return {
    kind: plan.kind,
    title: plan.title,
    amount: plan.amount,
    date: parts ? parts.map((p) => p.date).sort()[0] : shift(plan.date),
    parts,
    estimate: true,
    repeat: plan.repeat,
    seriesId: plan.seriesId,
    walletId: plan.walletId,
    categoryId: plan.categoryId,
    note: plan.note
  };
}
