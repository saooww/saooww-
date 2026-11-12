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
  got: Minor;
  left: Minor;
  state: "done" | "partial" | "open";
}

/**
 * The plan as a schedule: its dated parts (or the single date) with money
 * received covering them oldest first — a salary of 26 + 26 + 18 thousand
 * where 20 thousand has arrived shows the first piece 20 of 26 in, the others
 * waiting. Received money beyond the schedule is simply extra.
 */
export function planSchedule(plan: Plan, transactions: Transaction[]): PlanSlot[] {
  const raw = plan.parts?.length ? [...plan.parts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : [{ id: "all", date: plan.date, amount: plan.amount }];
  let pool = planReceived(plan, transactions);
  return raw.map((p) => {
    const got = Math.min(p.amount, pool);
    pool -= got;
    const left = p.amount - got;
    return { id: p.id, date: p.date, amount: p.amount, got, left, state: left === 0 ? "done" : got > 0 ? "partial" : "open" };
  });
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
  const parts = plan.parts?.map((p, i) => ({ id: `${i}`, date: shift(p.date), amount: p.amount }));
  return {
    kind: plan.kind,
    title: plan.title,
    amount: plan.amount,
    date: parts ? parts.map((p) => p.date).sort()[0] : shift(plan.date),
    parts,
    estimate: true,
    walletId: plan.walletId,
    categoryId: plan.categoryId,
    note: plan.note
  };
}
