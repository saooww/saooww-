import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
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

/**
 * Large figures read better with a full word space between digit groups
 * than with the narrow one used in running text.
 */
export function displayGroups(s: string): string {
  return s.replace(/\u202F/g, " ");
}

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

  // Large figures take the display weight of the chosen number typeface.
  const heroStyle = variant === "hero" ? { fontWeight: "var(--num-display-weight)", letterSpacing: "var(--num-display-tracking)" } : undefined;
  const numCls = variant === "hero" ? "num-display" : "num";

  if (hidden) {
    return (
      <span className={cn(numCls, "whitespace-nowrap", toneCls, className)} style={heroStyle} aria-label="Сумма скрыта">
        {MASK}
        <span className={cn(variant === "hero" && "ml-[0.12em] text-[0.62em] font-medium opacity-60", symbolClassName)}>
          {variant === "hero" ? p.symbol : ` ${p.symbol}`}
        </span>
      </span>
    );
  }

  if (variant === "hero") {
    return (
      <span className={cn(numCls, "whitespace-nowrap", toneCls, className)} style={heroStyle}>
        {p.sign}
        {displayGroups(p.int)}
        {p.frac && <span className="text-[0.6em] opacity-60">{p.frac}</span>}
        <span className={cn("ml-[0.16em] text-[0.58em] font-medium tracking-normal opacity-60", symbolClassName)}>{p.symbol}</span>
      </span>
    );
  }

  return (
    <span className={cn("num whitespace-nowrap", toneCls, className)}>
      {p.sign}
      {p.int}
      {p.frac}
      {" "}
      <span className={symbolClassName}>{p.symbol}</span>
    </span>
  );
}

/**
 * Counts smoothly from the previous value to the new one (respects reduced
 * motion). `from` makes the first render count up from that value instead.
 */
export function useCountUp(value: number, duration = 0.7, opts: { from?: number; delay?: number } = {}): number {
  const reduce = useReducedMotion();
  const animations = useData((s) => s.settings.animations);
  const start = opts.from !== undefined && !reduce && animations ? opts.from : value;
  const [shown, setShown] = useState(start);
  // Count from what is on screen, so an interrupted count resumes smoothly.
  const current = useRef(start);
  const delay = useRef(opts.delay ?? 0);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (reduce || !animations) {
      current.current = value;
      setShown(value);
      return;
    }
    // Keep whole units while counting so kopecks don't flicker in and out.
    const step = value % 100 === 0 && from % 100 === 0 ? 100 : 1;
    const controls = animate(from, value, {
      duration,
      delay: delay.current,
      ease: ease.out,
      onUpdate: (v) => {
        const next = Math.round(v / step) * step;
        current.current = next;
        setShown(next);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
        // Only the first count waits; later changes respond immediately.
        delay.current = 0;
      }
    });
    return () => controls.stop();
  }, [value, duration, reduce, animations]);

  return shown;
}

/**
 * Like useCountUp, but as a MotionValue: render it through useTransform into
 * a motion element and the number updates without re-rendering React — the
 * only cheap way to count a large figure smoothly on a phone.
 */
export function useCountMotion(value: number, opts: { from?: number; delay?: number; duration?: number } = {}): MotionValue<number> {
  const reduce = useReducedMotion();
  const animations = useData((s) => s.settings.animations);
  const still = !!reduce || !animations;
  const mv = useMotionValue(opts.from !== undefined && !still ? opts.from : value);
  // Only the first count waits; later changes respond immediately.
  const delay = useRef(opts.delay ?? 0);
  const duration = opts.duration ?? 0.8;

  useEffect(() => {
    if (mv.get() === value) return;
    if (still) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      delay: delay.current,
      ease: ease.out,
      onComplete: () => {
        delay.current = 0;
      }
    });
    return () => controls.stop();
  }, [value, still, duration, mv]);

  return mv;
}

/** Animates between values — balances count up or down after an operation. */
export function AnimatedMoney(props: MoneyProps & { duration?: number }) {
  const shown = useCountUp(props.value, props.duration);
  return <Money {...props} value={shown} />;
}
