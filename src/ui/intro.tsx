import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { useData } from "../store/store";
import { ease } from "./motion";

const EASE_OUT = ease.out;

/**
 * The cold-start intro: a short splash, then the home screen assembles
 * itself. It plays on the first launch of the day, only when animations are on.
 */
const START = typeof performance !== "undefined" ? performance.now() : 0;

/** How long the logo stays up before it dissolves into the home screen. */
export const SPLASH_MS = 1050;
/** Everything the home screen does during the intro starts this much later. */
export const INTRO_SHIFT = 0.23;
let enabled: boolean | null = null;

export function introEnabled(): boolean {
  if (enabled === null) {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const deepLink = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add");
    const s = useData.getState().settings;
    // No show when the lock screen or the composer comes first.
    enabled = !reduce && !deepLink && s.animations && !s.lockEnabled && s.launchAction !== "expense" && firstLaunchToday();
  }
  return enabled;
}

const INTRO_DAY_KEY = "ardessa-intro-day";

/**
 * The full intro plays on the first launch of the day only; later launches
 * open straight on the home screen. Remembered in localStorage, which is
 * read synchronously, before the first frame.
 */
function firstLaunchToday(): boolean {
  try {
    const d = new Date();
    const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (localStorage.getItem(INTRO_DAY_KEY) === today) return false;
    localStorage.setItem(INTRO_DAY_KEY, today);
    return true;
  } catch {
    return true;
  }
}

/** True while the app is still in its first moments — read once on mount. */
export function introActive(): boolean {
  return introEnabled() && (typeof performance === "undefined" ? 0 : performance.now()) - START < 1500 + INTRO_SHIFT * 1000;
}

/** Fades and lifts its content into place during the intro; static otherwise. */
export function Reveal({ intro, delay = 0, y = 14, className, children }: { intro: boolean; delay?: number; y?: number; className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} initial={intro ? { opacity: 0, y } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_OUT, delay: intro ? delay + INTRO_SHIFT : 0 }}>
      {children}
    </motion.div>
  );
}
