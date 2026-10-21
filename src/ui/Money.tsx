import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { cn } from "../lib/cn";
import { moneyParts, type Minor } from "../lib/money";
import { useData } from "../store/store";
import { ease } from "./motion";

export type MoneyTone = "default" | "auto" | "positive" | "negative" | "muted" | "inherit";

export interface MoneyProps {
  value: Minor;
  currency?: string;
  sign?: "auto" | "always" | "never";
  /** auto: income-style green for positive values when sign="always" */
  tone?: MoneyTone;
  /** "hero" renders symbol and kopecks in a lighter, smaller style */
  variant?: "plain" | "hero";
  /** Obey the global "hide amounts" privacy switch */
  privacy?: boolean;
  className?: string;
  symbolClassName?: string;
}

const MASK = "••••••";

export function Money({ value, currency = "RUB", sign = "auto", tone = "inherit", variant = "plain", privacy = false, className, symbolClassName }: MoneyProps) {
  const hidden = useData((s) => s.settings.hideAmounts) && privacy;
  const p = moneyParts(value, { currency, sign });
  const toneCls =
    tone === "auto"
      ? value > 0 && sign === "always"
        ? "text-positive"
        : ""
      : tone === "positive"
        ? "text-positive"
        : tone === "negative"
          ? "text-negative"
          : tone === "muted"
            ? "text-ink-2"
            : tone === "default"
              ? "text-ink"
              : "";

  if (hidden) {
    return (
      <span className={cn("tnum whitespace-nowrap", toneCls, className)} aria-label="Сумма скрыта">
        {MASK}
        <span className={cn(variant === "hero" && "ml-[0.12em] text-[0.62em] font-medium opacity-60", symbolClassName)}>
          {variant === "hero" ? p.symbol : ` ${p.symbol}`}
        </span>
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <span className={cn("tnum whitespace-nowrap", toneCls, className)}>
        {p.sign}
        {p.int}
        {p.frac && <span className="text-[0.62em] font-medium opacity-60">{p.frac}</span>}
        <span className={cn("ml-[0.16em] text-[0.62em] font-medium opacity-60", symbolClassName)}>{p.symbol}</span>
      </span>
    );
  }

  return (
    <span className={cn("tnum whitespace-nowrap", toneCls, className)}>
      {p.sign}
      {p.int}
      {p.frac}
      {" "}
      <span className={symbolClassName}>{p.symbol}</span>
    </span>
  );
}

/** Counts smoothly from the previous value to the new one (respects reduced motion). */
export function useCountUp(value: number, duration = 0.7): number {
  const reduce = useReducedMotion();
  const animations = useData((s) => s.settings.animations);
  const [shown, setShown] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    if (reduce || !animations) {
      setShown(value);
      return;
    }
    // Keep whole units while counting so kopecks don't flicker in and out.
    const step = value % 100 === 0 && from % 100 === 0 ? 100 : 1;
    const controls = animate(from, value, {
      duration,
      ease: ease.out,
      onUpdate: (v) => setShown(Math.round(v / step) * step)
    });
    return () => controls.stop();
  }, [value, duration, reduce, animations]);

  return shown;
}

/** Animates between values — balances count up or down after an operation. */
export function AnimatedMoney(props: MoneyProps & { duration?: number }) {
  const shown = useCountUp(props.value, props.duration);
  return <Money {...props} value={shown} />;
}
