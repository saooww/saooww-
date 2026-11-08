import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "../../ui/glyphs";

/**
 * The day's progress as an ensō — a single brush circle. The ink fills the
 * stroke as tasks get done; when everything is done a vermilion seal is
 * stamped in the middle.
 */

const START = -96; // degrees, a little left of the top
const SPAN = 326; // an ensō is never quite closed
const R = 39;
const N = 96;

function brushPath(): string {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = ((START + t * SPAN) * Math.PI) / 180;
    // the brush lands heavy, swells, then runs dry towards the end
    const w = 2.2 + 8.2 * Math.pow(1 - t, 0.55) * (1 + 0.07 * Math.sin(t * 19)) + (t < 0.05 ? (0.05 - t) * 30 : 0);
    const r = R + 1.1 * Math.sin(t * 8.5 + 0.6) + 0.5 * Math.sin(t * 27);
    const ro = r + w / 2;
    const ri = r - w / 2;
    outer.push(`${(50 + ro * Math.cos(a)).toFixed(2)} ${(50 + ro * Math.sin(a)).toFixed(2)}`);
    inner.push(`${(50 + ri * Math.cos(a)).toFixed(2)} ${(50 + ri * Math.sin(a)).toFixed(2)}`);
  }
  const end = ((START + SPAN + 2) * Math.PI) / 180;
  const tip = `${(50 + R * Math.cos(end)).toFixed(2)} ${(50 + R * Math.sin(end)).toFixed(2)}`;
  return `M ${outer.join(" L ")} Q ${tip} ${inner[N]} L ${inner.reverse().join(" L ")} Z`;
}

const PATH = brushPath();

export function Enso({
  value,
  size = 112,
  complete,
  children,
  className
}: {
  /** 0…1 */
  value: number;
  size?: number;
  /** Stamp the seal */
  complete?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(1, value));
  // the mask circle runs all the way round; the brush covers SPAN of it
  const reveal = v >= 1 ? 1 : (v * SPAN) / 360;
  return (
    <div className={className} style={{ position: "relative", width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="overflow-visible">
        <defs>
          <mask id={`enso-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <motion.circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="white"
              strokeWidth="20"
              transform={`rotate(${START - 4} 50 50)`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: Math.max(reveal, 0.0001) }}
              transition={{ type: "spring", stiffness: 55, damping: 17, mass: 1 }}
            />
          </mask>
        </defs>
        <path d={PATH} fill="var(--ink)" opacity={0.09} />
        <path d={PATH} fill="var(--ink)" mask={`url(#enso-${id})`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {complete ? (
            <motion.span
              key="seal"
              className="fill-accent grid place-items-center text-[var(--accent-on)]"
              style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.07, rotate: -6 }}
              initial={{ scale: 1.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26, delay: 0.25 }}
            >
              <Check size={size * 0.17} strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
