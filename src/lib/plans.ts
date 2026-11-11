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
