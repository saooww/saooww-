import { useEffect, useState, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Delete } from "lucide-react";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { spring } from "../../ui/motion";
import { PIN_LENGTH } from "./lock";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "extra", "0", "back"] as const;

/**
 * Four dots and a round-key number pad. Calls `onComplete` with the full
 * code; return false from it to shake and clear.
 */
export function PinPad({ title, subtitle, onComplete, extra, disabled }: { title: string; subtitle?: ReactNode; onComplete: (pin: string) => Promise<boolean> | boolean; extra?: ReactNode; disabled?: boolean }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const dots = useAnimationControls();

  const press = (k: string) => {
    if (busy || disabled) return;
    haptic();
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (pin.length < PIN_LENGTH) setPin((p) => p + k);
  };

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    setBusy(true);
    Promise.resolve(onComplete(pin)).then((ok) => {
      if (!ok) {
        haptic("warning");
        dots.start({ x: [0, -12, 12, -8, 8, -3, 0], transition: { duration: 0.42 } });
        window.setTimeout(() => setPin(""), 380);
      }
      setBusy(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center">
      <div className="text-title-3 font-semibold text-ink">{title}</div>
      <div className="mt-1.5 h-5 text-footnote text-ink-2">{subtitle}</div>
      <motion.div animate={dots} className="mt-6 flex gap-4" aria-label={`Введено ${pin.length} из ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <motion.span
            key={i}
            className={cn("h-3.5 w-3.5 rounded-full", i < pin.length ? "bg-ink" : "bg-transparent")}
            style={{ boxShadow: "inset 0 0 0 1.5px var(--ink-3)" }}
            animate={{ scale: i === pin.length - 1 ? [1, 1.25, 1] : 1 }}
            transition={spring.snappy}
          />
        ))}
      </motion.div>
      <div className="mt-10 grid grid-cols-3 gap-x-6 gap-y-4" role="group" aria-label="Цифровая клавиатура">
        {KEYS.map((k) =>
          k === "extra" ? (
            <div key={k} className="grid h-[76px] w-[76px] place-items-center">
              {extra}
            </div>
          ) : (
            <motion.button
              key={k}
              type="button"
              aria-label={k === "back" ? "Стереть" : k}
              whileTap={{ scale: 0.9 }}
              transition={spring.press}
              onClick={() => press(k)}
              className={cn("num grid h-[76px] w-[76px] place-items-center rounded-full text-[30px] font-normal text-ink", k !== "back" && "tile")}
            >
              {k === "back" ? <Delete size={26} strokeWidth={1.6} /> : k}
            </motion.button>
          )
        )}
      </div>
    </div>
  );
}
