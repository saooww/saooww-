import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { CORP, MARK, WORD } from "./brandPaths";

/**
 * Ardessa brand: the red sail mark, the ARDESSA word and the CORPORATION
 * line. The logo keeps its own red whatever accent colour is chosen.
 */

/** The sail mark. `size` is its height. */
export function LogoMark({ size = 22, color = "var(--brand)", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={(size * MARK.w) / MARK.h} height={size} viewBox={`0 0 ${MARK.w} ${MARK.h}`} aria-hidden="true" className={cn("shrink-0", className)}>
      <path d={MARK.d} fill={color} />
    </svg>
  );
}

/** Kept for places that used the old mark. */
export const BrandMark = LogoMark;

/** The word ARDESSA. `size` is its cap height. */
export function LogoWord({ size = 14, color = "var(--brand-word, var(--brand))", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={(size * WORD.w) / WORD.h} height={size} viewBox={`0 0 ${WORD.w} ${WORD.h}`} aria-hidden="true" className={cn("shrink-0", className)}>
      <path d={WORD.d} fill={color} fillRule="evenodd" />
    </svg>
  );
}

/** Mark and word for the top bar. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2" role="img" aria-label="Ardessa">
      <LogoMark size={24} />
      <LogoWord size={13.5} color="var(--ink)" className="mt-[3px]" />
    </div>
  );
}

/**
 * The full logo: mark, ARDESSA, CORPORATION. `size` is the height of the
 * word ARDESSA; everything else follows the brand proportions.
 */
export function FullLogo({ size = 28, layout = "stack", className }: { size?: number; layout?: "stack" | "row"; className?: string }) {
  const corpH = size * 0.394;
  const word = <LogoWord size={size} />;
  const corp = (
    <svg width={(corpH * CORP.w) / CORP.h} height={corpH} viewBox={`0 0 ${CORP.w} ${CORP.h}`} aria-hidden="true" className="shrink-0">
      <path d={CORP.d} fill="var(--ink)" fillRule="evenodd" />
    </svg>
  );
  if (layout === "row") {
    return (
      <div className={cn("flex items-center", className)} style={{ gap: size * 0.45 }} role="img" aria-label="Ardessa Corporation">
        <LogoMark size={size * 2.55} />
        <div className="flex flex-col items-start" style={{ gap: size * 0.32 }}>
          {word}
          {corp}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-center", className)} role="img" aria-label="Ardessa Corporation">
      <LogoMark size={size * 3.6} />
      <div style={{ height: size * 0.75 }} />
      {word}
      <div style={{ height: size * 0.32 }} />
      {corp}
    </div>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The logo assembling itself: the sail is outlined in one brush stroke,
 * fills from the hull up to the tip, catches a glint of light; then the
 * word is unveiled and CORPORATION settles in beneath it.
 */
export function AnimatedLogo({ size = 30 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const markH = size * 3.6;
  const corpH = size * 0.394;
  return (
    <div className="flex flex-col items-center" role="img" aria-label="Ardessa Corporation">
      <svg width={(markH * MARK.w) / MARK.h} height={markH} viewBox={`0 0 ${MARK.w} ${MARK.h}`} className="overflow-visible">
        <defs>
          {/* a hard-ish edge across a big square: white (shown) below-left, black above-right */}
          <linearGradient id={`rise-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0.485" stopColor="white" />
            <stop offset="0.515" stopColor="black" />
          </linearGradient>
          <mask id={`fill-${id}`} maskUnits="userSpaceOnUse" x="-200" y="-200" width="480" height="500">
            {/* the edge travels up the sail, from the hull to the tip */}
            <motion.g initial={{ x: -40, y: 54 }} animate={{ x: 40, y: -54 }} transition={{ duration: 0.55, delay: 0.16, ease: EASE }}>
              <rect x={37.5 - 150} y={50 - 112.5} width="300" height="225" fill={`url(#rise-${id})`} />
            </motion.g>
          </mask>
          <linearGradient id={`glint-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.6" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`clip-${id}`}>
            <path d={MARK.d} />
          </clipPath>
        </defs>
        <motion.path
          d={MARK.d}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={0.9}
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 0 }}
          transition={{ pathLength: { duration: 0.42, ease: EASE }, opacity: { duration: 0.2, delay: 0.62 } }}
        />
        <path d={MARK.d} fill="var(--brand)" mask={`url(#fill-${id})`} />
        <g clipPath={`url(#clip-${id})`}>
          <g transform="rotate(20 37.5 50)">
            <motion.g initial={{ x: -50 }} animate={{ x: 120 }} transition={{ duration: 0.6, delay: 0.66, ease: EASE }}>
              <rect x="0" y="-30" width="26" height={MARK.h + 60} fill={`url(#glint-${id})`} />
            </motion.g>
          </g>
        </g>
      </svg>
      <div style={{ height: size * 0.75 }} />
      <motion.div initial={{ clipPath: "inset(0 100% 0 0)", y: 4 }} animate={{ clipPath: "inset(0 0% 0 0)", y: 0 }} transition={{ duration: 0.45, delay: 0.32, ease: EASE }}>
        <LogoWord size={size} />
      </motion.div>
      <div style={{ height: size * 0.32 }} />
      <motion.div initial={{ opacity: 0, scaleX: 1.18 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.55, delay: 0.5, ease: EASE }}>
        <svg width={(corpH * CORP.w) / CORP.h} height={corpH} viewBox={`0 0 ${CORP.w} ${CORP.h}`} aria-hidden="true">
          <path d={CORP.d} fill="var(--ink)" fillRule="evenodd" />
        </svg>
      </motion.div>
    </div>
  );
}
