import { useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { haptic } from "../lib/haptics";
import { monotonePath, useWidth } from "./util";

export interface LinePoint {
  value: number;
}

export interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color?: string;
  /** Called with the scrubbed index, or null on release */
  onScrub?: (i: number | null) => void;
  /** Show faint labels for min and max */
  formatValue?: (v: number) => string;
  animKey?: string;
  /** Leave room so the line never touches the edges */
  padY?: number;
  /** Faint horizontal reference line (e.g. a target) */
  reference?: number;
  ariaLabel?: string;
  interactive?: boolean;
  fill?: boolean;
  strokeWidth?: number;
}

export function LineChart({
  points,
  height = 160,
  color = "var(--accent)",
  onScrub,
  formatValue,
  animKey,
  padY = 18,
  reference,
  ariaLabel,
  interactive = true,
  fill = true,
  strokeWidth = 2
}: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const n = points.length;

  const { min, max, coords, path, area } = useMemo(() => {
    if (!n || !width) return { min: 0, max: 0, coords: [] as Array<[number, number]>, path: "", area: "" };
    let lo = Math.min(...points.map((p) => p.value), reference ?? Infinity);
    let hi = Math.max(...points.map((p) => p.value), reference ?? -Infinity);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const span = hi - lo;
    const h = height - padY * 2;
    const coords = points.map((p, i): [number, number] => [n === 1 ? width / 2 : (i / (n - 1)) * width, padY + h - ((p.value - lo) / span) * h]);
    const path = monotonePath(coords);
    const area = `${path} L${width},${height} L0,${height} Z`;
    return { min: lo, max: hi, coords, path, area };
  }, [points, width, height, padY, n, reference]);

  const yOf = (v: number) => padY + (height - padY * 2) - ((v - min) / (max - min || 1)) * (height - padY * 2);

  const scrub = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n < 2) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(((clientX - rect.left) / rect.width) * (n - 1))));
    if (i !== last.current) {
      last.current = i;
      haptic();
      setActive(i);
      onScrub?.(i);
    }
  };

  const release = () => {
    last.current = null;
    setActive(null);
    onScrub?.(null);
  };

  const maxIdx = useMemo(() => points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0), [points]);
  const minIdx = useMemo(() => points.reduce((b, p, i) => (p.value < points[b].value ? i : b), 0), [points]);

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y select-none"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={interactive ? (e) => scrub(e.clientX) : undefined}
      onPointerMove={interactive ? (e) => (e.buttons || e.pointerType === "touch") && scrub(e.clientX) : undefined}
      onPointerUp={interactive ? release : undefined}
      onPointerCancel={interactive ? release : undefined}
      onPointerLeave={interactive ? (e) => e.pointerType === "mouse" && release() : undefined}
    >
      {width > 0 && n > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {reference !== undefined && (
            <line x1={0} x2={width} y1={yOf(reference)} y2={yOf(reference)} stroke="var(--ink-3)" strokeDasharray="3 4" strokeWidth={1} />
          )}
          <g key={animKey}>
            {fill && (
              <motion.path d={area} fill={`url(#g${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25 }} />
            )}
            <motion.path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </g>

          {formatValue && active === null && n > 2 && (
            <>
              <text x={clampX(coords[maxIdx][0], width)} y={coords[maxIdx][1] - 8} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px] font-medium tnum">
                {formatValue(points[maxIdx].value)}
              </text>
              {minIdx !== maxIdx && formatValue(points[minIdx].value) !== formatValue(points[maxIdx].value) && (
                <text x={clampX(coords[minIdx][0], width)} y={coords[minIdx][1] + 16} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px] font-medium tnum">
                  {formatValue(points[minIdx].value)}
                </text>
              )}
            </>
          )}

          {active !== null && coords[active] && (
            <g>
              <line x1={coords[active][0]} x2={coords[active][0]} y1={0} y2={height} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={coords[active][0]} cy={coords[active][1]} r={9} fill={color} opacity={0.18} />
              <circle cx={coords[active][0]} cy={coords[active][1]} r={4.5} fill={color} stroke="var(--bg)" strokeWidth={2} />
            </g>
          )}
          {active === null && coords.length > 0 && (
            <circle cx={coords[n - 1][0]} cy={coords[n - 1][1]} r={3.5} fill={color} stroke="var(--bg)" strokeWidth={2} />
          )}
        </svg>
      )}
    </div>
  );
}

function clampX(x: number, width: number) {
  return Math.max(28, Math.min(width - 28, x));
}
