import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { introEnabled } from "./intro";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Launch splash: the «К» mark draws itself on a sumi-black field with a low
 * vermilion bloom, then dissolves into the home screen.
 */
export function Splash() {
  const [show, setShow] = useState(() => introEnabled());
  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(() => setShow(false), 820);
    return () => window.clearTimeout(id);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[120] grid place-items-center"
          style={{ background: "var(--bg)" }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: EASE } }}
        >
          <motion.div
            className="absolute inset-0 m-auto h-[520px] w-[520px] rounded-full"
            style={{ background: "radial-gradient(closest-side, var(--accent-glow), transparent)" }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <motion.div className="relative flex flex-col items-center" exit={{ scale: 1.08, opacity: 0, transition: { duration: 0.45, ease: EASE } }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="splash-k" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--accent-hi)" />
                  <stop offset="100%" stopColor="var(--accent-lo)" />
                </linearGradient>
              </defs>
              <motion.rect
                x="3.5"
                y="3"
                width="3.6"
                height="18"
                rx="1.8"
                fill="url(#splash-k)"
                style={{ originY: 0 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.38, ease: EASE }}
              />
              <motion.path
                d="M19.2 3.6 10.6 12l8.6 8.4"
                stroke="url(#splash-k)"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.42, delay: 0.16, ease: EASE }}
              />
            </svg>
            <motion.div
              className="mt-5 text-[12px] font-semibold uppercase tracking-[0.42em] text-ink-2"
              style={{ marginRight: "-0.42em" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: EASE }}
            >
              Капитал
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
