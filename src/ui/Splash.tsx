import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedLogo } from "./Brand";
import { SPLASH_MS, introEnabled } from "./intro";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Launch splash: the Ardessa logo assembles itself on a sumi-black field
 * over a low red bloom, then dissolves into the home screen.
 */
export function Splash() {
  const [show, setShow] = useState(() => introEnabled());
  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(() => setShow(false), SPLASH_MS);
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
            className="absolute inset-0 m-auto h-[560px] w-[560px] rounded-full"
            style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--brand) 38%, transparent), transparent)" }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.5, scale: 1 }}
            transition={{ duration: 1.2, ease: EASE }}
          />
          <motion.div className="relative" exit={{ scale: 1.08, opacity: 0, transition: { duration: 0.45, ease: EASE } }}>
            <AnimatedLogo size={30} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
