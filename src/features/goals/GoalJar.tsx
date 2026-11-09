import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { wave } from "../home/DaySphere";

/**
 * A goal as a jar that fills: the liquid rises with what's saved, in the
 * goal's own colour, with a slow wave on top.
 */
export function GoalJar({ value, color, size = 188, children }: { value: number; color: string; size?: number; children?: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(1, value));
  const W = 150;
  const H = 188;
  const top = 26;
  const inner = { x: 14, y: top, w: W - 28, h: H - top - 10 };
  const surface = inner.y + inner.h - Math.max(0.03, v) * inner.h;
  return (
    <div className="relative" style={{ width: (size * W) / H, height: size }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={(size * W) / H} height={size} aria-hidden="true" className="absolute inset-0 overflow-visible">
        <defs>
          <clipPath id={`j${id}`}>
            <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="26" />
          </clipPath>
        </defs>
        {/* lid */}
        <rect x={32} y={6} width={W - 64} height={14} rx="5" fill="var(--surface-3)" />
        {/* glass */}
        <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="26" fill="color-mix(in srgb, var(--ink) 5%, var(--surface))" />
        <g clipPath={`url(#j${id})`}>
          <motion.g initial={false} animate={{ y: surface }} transition={{ type: "spring", stiffness: 40, damping: 14 }}>
            <motion.path d={wave(5, 70, 420)} fill={color} opacity={0.45} animate={reduce ? undefined : { x: [-70, 0] }} transition={{ duration: 3.6, ease: "linear", repeat: Infinity }} />
            <motion.path d={wave(4, 56, 420)} fill={color} transform="translate(0 4)" animate={reduce ? undefined : { x: [0, -56] }} transition={{ duration: 2.8, ease: "linear", repeat: Infinity }} />
          </motion.g>
        </g>
        <rect x={inner.x + 0.5} y={inner.y + 0.5} width={inner.w - 1} height={inner.h - 1} rx="25.5" fill="none" stroke="var(--line-strong)" />
        {/* a glint on the glass */}
        <rect x={inner.x + 10} y={inner.y + 16} width="6" height={inner.h * 0.42} rx="3" fill="#fff" opacity="0.12" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 top-[14%] grid place-items-center">{children}</div>
    </div>
  );
}
