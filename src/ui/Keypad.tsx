import { useRef } from "react";
import { motion } from "framer-motion";
import { Delete } from "./glyphs";
import { haptic } from "../lib/haptics";
import { getMoneyFormat } from "../lib/money";
import { cn } from "../lib/cn";
import { spring } from "./motion";

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "back" | "clear";

/** Applies a key to an amount buffer like "1250,5". */
export function applyKey(buffer: string, key: KeypadKey): string {
  if (key === "clear") return "";
  if (key === "back") return buffer.slice(0, -1);
  if (key === ",") {
    if (buffer.includes(",")) return buffer;
    return (buffer || "0") + ",";
  }
  const [int, frac] = buffer.split(",");
  if (frac !== undefined) {
    if (frac.length >= 2) return buffer;
    return buffer + key;
  }
  if (int === "0") return key;
  if (int.length >= 10) return buffer;
  return buffer + key;
}

const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];
type OpKey = "+" | "-" | "×" | "=";
const KEYS_WITH_OPS: Array<KeypadKey | OpKey> = ["1", "2", "3", "+", "4", "5", "6", "-", "7", "8", "9", "×", ",", "0", "back", "="];
const OP_LABEL: Record<OpKey, string> = { "+": "+", "-": "−", "×": "×", "=": "=" };
const OP_ARIA: Record<OpKey, string> = { "+": "Плюс", "-": "Минус", "×": "Умножить", "=": "Посчитать" };
const isOpKey = (k: string): k is OpKey => k === "+" || k === "-" || k === "×" || k === "=";

/**
 * Amount keypad. With `ops` it gets a column of + − × = and works as a
 * small calculator. Holding ⌫ clears everything.
 */
export function Keypad<K extends string = KeypadKey>({ onKey, compact, ops, activeOp }: { onKey: (k: K) => void; compact?: boolean; ops?: boolean; activeOp?: string }) {
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);
  const decimal = getMoneyFormat().numberFormat === "ru" ? "," : ".";
  const keys = ops ? KEYS_WITH_OPS : KEYS;
  const fire = (k: string) => onKey(k as K);

  const startHold = () => {
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      haptic("medium");
      fire("clear");
    }, 480);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <div className={cn("grid gap-x-2 gap-y-1 px-3", ops ? "grid-cols-[1fr_1fr_1fr_0.72fr]" : "grid-cols-3")} role="group" aria-label="Клавиатура суммы">
      {keys.map((k) => {
        const op = isOpKey(k);
        return (
          <motion.button
            key={k}
            type="button"
            aria-label={k === "back" ? "Стереть (удерживайте, чтобы очистить)" : k === "," ? "Десятичный разделитель" : op ? OP_ARIA[k] : k}
            whileTap={{ scale: 0.92, backgroundColor: "var(--key-press)" }}
            transition={spring.press}
            onPointerDown={k === "back" ? startHold : undefined}
            onPointerUp={k === "back" ? endHold : undefined}
            onPointerLeave={k === "back" ? endHold : undefined}
            onClick={() => {
              if (k === "back" && held.current) {
                held.current = false;
                return;
              }
              haptic();
              fire(k);
            }}
            className={cn(
              "num flex items-center justify-center rounded-[14px]",
              compact ? "h-[clamp(42px,6.1vh,52px)]" : "h-[56px]",
              op ? cn("text-[24px] font-light", activeOp === k ? "bg-accent-soft text-accent-ink" : "tile text-ink-2", k === "=" && "text-accent-ink") : "text-[27px] font-normal text-ink"
            )}
          >
            {k === "back" ? <Delete size={24} strokeWidth={1.7} /> : k === "," ? decimal : op ? OP_LABEL[k] : k}
          </motion.button>
        );
      })}
    </div>
  );
}
