import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useData } from "../store/store";
import { ease } from "./motion";

const EASE_OUT = ease.out;

/**
 * The cold-start intro: a short splash, then the home screen assembles
 * itself. It plays once per launch, only when animations are on.
 */
const START = typeof performance !== "undefined" ? performance.now() : 0;
let enabled: boolean | null = null;

export function introEnabled(): boolean {
  if (enabled === null) {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const deepLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add");
    enabled = !reduce && !deepLink && useData.getState().settings.animations;
  }
  return enabled;
}

/** True while the app is still in its first moments — read once on mount. */
export function introActive(): boolean {
  return introEnabled() && (typeof performance === "undefined" ? 0 : performance.now()) - START < 1500;
}

/** Fades and lifts its content into place during the intro; static otherwise. */
export function Reveal({ intro, delay = 0, y = 14, className, children }: { intro: boolean; delay?: number; y?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} initial={intro ? { opacity: 0, y } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay }}>
      {children}
    </motion.div>
  );
}
