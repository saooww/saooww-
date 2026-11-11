import { useId, useMemo, useRef, type ReactNode } from "react";
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
  /** Shows the value of the highlighted bar in a small white label above it */
  formatValue?: (v: number) => string;
}

const PAD_TOP = 14;
const AXIS_H = 20;

/** A bar with rounded top corners and a flat base. */
function barPath(x: number, top: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const base = top + h;
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
}

export function BarChart({
  data,
  height = 176,
  color = "var(--ink)",
  color2 = "var(--positive)",
  selected,
  onSelect,
  average,
  averageLabel,
  formatAxis,
  animKey,
  emphasis,
  ariaLabel,
  formatValue
}: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
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
          <defs>
            {[color, color2].map((c, k) => (
              <linearGradient key={k} id={`bar${k}-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="100%" stopColor={c} stopOpacity={0.5} />
              </linearGradient>
            ))}
            <linearGradient id={`hi-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.05} />
              <stop offset="55%" stopColor="var(--accent)" stopOpacity={0.34} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.6} />
            </linearGradient>
            <filter id={`glow-${gid}`} x="-200%" y="-50%" width="500%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <linearGradient id={`hibar-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-hi)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
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

          {/* the chosen (or current) bar stands in a glowing column */}
          {(() => {
            const hi = selected ?? emphasis;
            if (hi === undefined || hi === null || dual) return null;
            const w = Math.max(barW + 14, Math.min(slot * 1.5, 40));
            const x = slot * hi + slot / 2 - w / 2;
            const top = Math.max(PAD_TOP - 6, y(data[hi]?.value ?? 0) - 26);
            return (
              <g style={{ transition: "opacity 160ms" }}>
                <rect x={x} y={top} width={w} height={y(0) - top} rx={w / 2} fill="var(--accent)" opacity={0.45} filter={`url(#glow-${gid})`} />
                <rect x={x} y={top} width={w} height={y(0) - top} rx={Math.min(w / 2, 14)} fill={`url(#hi-${gid})`} />
              </g>
            );
          })()}

          {/* bars */}
          <g key={animKey}>
            {data.map((d, i) => {
              const cx = slot * i + slot / 2;
              const dim = selected !== null && selected !== i;
              const bars = dual
                ? [
                    { v: d.value2 ?? 0, x: cx - barW - 1, c: `url(#bar1-${gid})` },
                    { v: d.value, x: cx + 1, c: `url(#bar0-${gid})` }
                  ]
                : [{ v: d.value, x: cx - barW / 2, c: i === (selected ?? emphasis) ? `url(#hibar-${gid})` : `url(#bar0-${gid})` }];
              return (
                <g key={i} style={{ opacity: dim ? 0.32 : emphasis !== undefined && selected === null && i !== emphasis && !dual ? 0.72 : 1, transition: "opacity 160ms" }}>
                  {bars.map((b, j) => {
                    const h = Math.max(b.v > 0 ? 2 : 0, (b.v / max) * plotH);
                    return (
                      <motion.path
                        key={j}
                        d={barPath(b.x, y(0) - h, barW, h)}
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
      {(() => {
        const hi = selected ?? emphasis;
        if (!formatValue || width <= 0 || hi === undefined || hi === null || dual || !data[hi] || data[hi].value <= 0) return null;
        const cx = slot * hi + slot / 2;
        return (
          <span
            className="num pointer-events-none absolute z-[1] -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-[3px] text-[11px] font-bold leading-none text-black shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)]"
            style={{ left: Math.max(34, Math.min(width - 34, cx)), top: Math.max(-8, y(data[hi].value) - 24) }}
          >
            {formatValue(data[hi].value)}
          </span>
        );
      })()}
    </div>
  );
}
