import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { haptic } from "../lib/haptics";

export interface DonutSlice {
  id: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 196,
  thickness = 18,
  selected,
  onSelect,
  children,
  animKey
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  children?: ReactNode;
  animKey?: string;
}) {
  const r = (size - thickness - 8) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const gap = slices.length > 1 ? Math.min(6, c * 0.012) : 0;
  let offset = 0;

  const onTap = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const dist = Math.hypot(x, y);
    if (dist < r - thickness * 1.6 || dist > r + thickness * 1.6) {
      onSelect(null);
      return;
    }
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const frac = angle / (Math.PI * 2);
    let acc = 0;
    for (const s of slices) {
      acc += s.value / total;
      if (frac <= acc) {
        haptic();
        onSelect(selected === s.id ? null : s.id);
        return;
      }
    }
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" onPointerDown={onTap} role="img" aria-label="Распределение по категориям">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        <g key={animKey}>
          {total > 0 &&
            slices.map((s, i) => {
              const len = Math.max(0, (s.value / total) * c - gap);
              const dash = `${len} ${c - len}`;
              const start = offset;
              offset += (s.value / total) * c;
              const dim = selected !== null && selected !== s.id;
              return (
                <motion.circle
                  key={s.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeDasharray={dash}
                  initial={{ strokeDashoffset: -start + len, opacity: 0 }}
                  animate={{ strokeDashoffset: -start, opacity: dim ? 0.28 : 1, strokeWidth: selected === s.id ? thickness + 6 : thickness }}
                  transition={{ type: "spring", stiffness: 140, damping: 22, delay: i * 0.05 }}
                />
              );
            })}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
