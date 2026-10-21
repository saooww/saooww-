import { useMemo, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { haptic } from "../lib/haptics";
import { niceMax, useWidth } from "./util";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second series drawn beside the first (e.g. income vs expense) */
  value2?: number;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  color2?: string;
  selected: number | null;
  onSelect: (i: number | null) => void;
  /** Dashed reference line, e.g. the daily average */
  average?: number;
  averageLabel?: ReactNode;
  formatAxis?: (v: number) => string;
  /** Re-run the entrance animation when this changes */
  animKey?: string;
  /** Highlight a bar without a selection (e.g. today) */
  emphasis?: number;
  ariaLabel?: string;
}

const PAD_TOP = 14;
const AXIS_H = 20;

export function BarChart({
  data,
  height = 176,
  color = "var(--accent)",
  color2 = "var(--positive)",
  selected,
  onSelect,
  average,
  averageLabel,
  formatAxis,
  animKey,
  emphasis,
  ariaLabel
}: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const lastIndex = useRef<number | null>(null);
  const n = data.length;
  const plotH = height - AXIS_H - PAD_TOP;
  const max = useMemo(() => niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.value2 ?? 0)), average ?? 0)), [data, average]);
  const slot = n ? width / n : 0;
  const dual = data.some((d) => d.value2 !== undefined);
  const barW = Math.max(2, Math.min(dual ? 9 : 18, slot * (dual ? 0.32 : 0.56)));
  const labelEvery = n > 20 ? Math.ceil(n / 7) : n > 12 ? 2 : 1;
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const indexAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !n) return null;
    const i = Math.floor(((clientX - rect.left) / rect.width) * n);
    return Math.max(0, Math.min(n - 1, i));
  };

  const pick = (clientX: number) => {
    const i = indexAt(clientX);
    if (i !== lastIndex.current) {
      lastIndex.current = i;
      if (i !== null) haptic();
      onSelect(i);
    }
  };

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y select-none"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        lastIndex.current = selected;
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType === "touch") pick(e.clientX);
      }}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {/* grid */}
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={0} x2={width} y1={y(max * f)} y2={y(max * f)} stroke="var(--chart-grid)" strokeWidth={1} />
              {formatAxis && (
                <text x={width} y={y(max * f) - 4} textAnchor="end" className="fill-[var(--ink-3)] text-[10px] font-medium tnum">
                  {formatAxis(max * f)}
                </text>
              )}
            </g>
          ))}
          <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth={1} />

          {/* bars */}
          <g key={animKey}>
            {data.map((d, i) => {
              const cx = slot * i + slot / 2;
              const dim = selected !== null && selected !== i;
              const bars = dual
                ? [
                    { v: d.value2 ?? 0, x: cx - barW - 1, c: color2 },
                    { v: d.value, x: cx + 1, c: color }
                  ]
                : [{ v: d.value, x: cx - barW / 2, c: color }];
              return (
                <g key={i} style={{ opacity: dim ? 0.32 : emphasis !== undefined && selected === null && i !== emphasis && !dual ? 0.72 : 1, transition: "opacity 160ms" }}>
                  {bars.map((b, j) => {
                    const h = Math.max(b.v > 0 ? 2 : 0, (b.v / max) * plotH);
                    return (
                      <motion.rect
                        key={j}
                        x={b.x}
                        width={barW}
                        y={y(0) - h}
                        height={h}
                        rx={Math.min(3, barW / 2)}
                        fill={b.c}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ type: "spring", stiffness: 180, damping: 24, delay: Math.min(0.4, i * (0.36 / Math.max(1, n))) }}
                        style={{ transformOrigin: `${b.x + barW / 2}px ${y(0)}px` }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* average */}
          {average !== undefined && average > 0 && (
            <g>
              <line x1={0} x2={width} y1={y(average)} y2={y(average)} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
              {averageLabel && (
                <text x={2} y={y(average) - 5} className="fill-[var(--ink-2)] text-[10px] font-medium">
                  {averageLabel}
                </text>
              )}
            </g>
          )}

          {/* axis labels */}
          {data.map((d, i) =>
            i === selected || (i % labelEvery === 0 && (selected === null || Math.abs(i - selected) * slot > 22)) ? (
              <text
                key={i}
                x={slot * i + slot / 2}
                y={height - 5}
                textAnchor="middle"
                className={i === selected ? "fill-[var(--ink)] text-[10.5px] font-semibold" : "fill-[var(--ink-3)] text-[10.5px] font-medium"}
              >
                {d.label}
              </text>
            ) : null
          )}
        </svg>
      )}
    </div>
  );
}
