import { applyKey, type KeypadKey } from "../ui/Keypad";
import { amountToInput, formatInputBuffer, type Minor } from "./money";

/**
 * The amount field doubles as a small calculator: «1200+350», «450×3».
 * The buffer holds the expression as typed; operands follow the usual
 * keypad rules (comma, two decimals), × binds tighter than + and −.
 */

export type CalcOp = "+" | "-" | "×";
export type CalcKey = KeypadKey | CalcOp | "=";

const OP_RE = /[+\-×]/;
const MAX_OPS = 8;

const isOp = (ch: string | undefined): ch is CalcOp => ch === "+" || ch === "-" || ch === "×";

/** The operand being typed (after the last operator). */
export function lastOperand(buf: string): string {
  const m = buf.match(/[^+\-×]*$/);
  return m ? m[0] : "";
}

export function hasOperator(buf: string): boolean {
  return OP_RE.test(buf);
}

export function applyCalcKey(buf: string, key: CalcKey): string {
  if (key === "clear") return "";
  if (key === "back") return buf.slice(0, -1);
  if (key === "=") {
    const v = evaluate(buf);
    return v && v > 0 ? amountToInput(v) : buf;
  }
  if (isOp(key)) {
    if (!buf) return buf;
    const last = buf[buf.length - 1];
    if (isOp(last) || last === ",") return buf.slice(0, -1) + key;
    if ((buf.match(/[+\-×]/g) ?? []).length >= MAX_OPS) return buf;
    return buf + key;
  }
  const operand = lastOperand(buf);
  return buf.slice(0, buf.length - operand.length) + applyKey(operand, key);
}

/** Value of the expression in minor units; a trailing operator is ignored. Null when there is nothing to count. */
export function evaluate(buf: string): Minor | null {
  const expr = isOp(buf[buf.length - 1]) ? buf.slice(0, -1) : buf;
  if (!expr) return null;
  const tokens = expr.split(/([+\-×])/).filter((t) => t !== "");
  let total = 0;
  let term: number | null = null;
  let sign = 1;
  let pendingMul = false;
  for (const t of tokens) {
    if (t === "+" || t === "-") {
      if (term !== null) total += sign * term;
      sign = t === "+" ? 1 : -1;
      term = null;
      pendingMul = false;
    } else if (t === "×") {
      pendingMul = true;
    } else {
      const n = Number(t.replace(",", "."));
      if (!Number.isFinite(n)) return null;
      term = pendingMul && term !== null ? term * n : n;
      pendingMul = false;
    }
  }
  if (term !== null) total += sign * term;
  return Math.round(total * 100);
}

/** «1 200 + 350 × 2» — the expression for display, digits grouped. */
export function formatExpression(buf: string): string {
  return buf
    .split(/([+\-×])/)
    .filter((t) => t !== "")
    .map((t) => {
      if (t === "-") return "−";
      if (isOp(t)) return t;
      const { int, frac } = formatInputBuffer(t);
      return int + frac;
    })
    .join(" ");
}
