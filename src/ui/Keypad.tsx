import { useRef } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import { haptic } from "../lib/haptics";
import { getMoneyFormat } from "../lib/money";
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

export function Keypad({ onKey, compact }: { onKey: (k: KeypadKey) => void; compact?: boolean }) {
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);
  const decimal = getMoneyFormat().numberFormat === "ru" ? "," : ".";

  const startHold = () => {
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      haptic("medium");
      onKey("clear");
    }, 480);
  };
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-1 px-3" role="group" aria-label="Клавиатура суммы">
      {KEYS.map((k) => (
        <motion.button
          key={k}
          type="button"
          aria-label={k === "back" ? "Стереть (удерживайте, чтобы очистить)" : k === "," ? "Десятичный разделитель" : k}
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
            onKey(k);
          }}
          className={`flex items-center justify-center rounded-md text-[27px] font-normal tracking-tight text-ink ${compact ? "h-[50px]" : "h-[56px]"}`}
        >
          {k === "back" ? <Delete size={24} strokeWidth={1.7} /> : k === "," ? decimal : k}
        </motion.button>
      ))}
    </div>
  );
}
