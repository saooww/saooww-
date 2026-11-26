import { useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import type { CapitalCurve } from "../lib/analytics";
import { monotonePath, useWidth } from "./util";
import { tr } from "../i18n/i18n";

interface Point {
  day: string;
  value: number;
}

/**
 * The capital curve with its highest and lowest point named, and below it
 * how far the capital sat under its own peak (the drawdown). Touch a day to read the value.
 */
export function EquityChart({
  series,
  curve,
  height = 150,
  color = "var(--ink)",
  formatValue,
  formatDay,
  onScrub,
  ariaLabel
}: {
  series: Point[];
  curve: CapitalCurve;
  height?: number;
  color?: string;
  formatValue: (v: number) => string;
  formatDay: (d: string) => string;
  onScrub?: (index: number | null) => void;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const n = series.length;
  const top = 26;
  const bottom = 8;
  const ddH = curve.maxDrawdown ? 46 : 0;
  const total = height + ddH + (ddH ? 14 : 0);

  const g = useMemo(() => {
    if (!width || n < 2) return null;
    const lo = Math.min(...series.map((p) => p.value));
    const hi = Math.max(...series.map((p) => p.value));
    const span = hi - lo || 1;
    const x = (i: number) => (i / (n - 1)) * width;
    const y = (v: number) => top + (height - top - bottom) * (1 - (v - lo) / span);
    const pts = series.map((p, i): [number, number] => [x(i), y(p.value)]);
    const line = monotonePath(pts);
    const area = `${line} L${width},${height} L0,${height} Z`;
    // drawdown hangs from a baseline under the chart
    const ddMin = Math.min(...curve.drawdown, -1);
    const base = height + 14;
    const dy = (v: number) => base + (v / ddMin) * (ddH - 4);
    const ddPts = curve.drawdown.map((v, i): [number, number] => [x(i), dy(v)]);
    const ddLine = monotonePath(ddPts);
    const ddArea = ddH ? `M0,${base} L${ddPts.map((p) => `${p[0]},${p[1]}`).join(" L")} L${width},${base} Z` : "";
    return { x, y, line, area, ddLine, ddArea, base };
  }, [series, width, n, height, curve.drawdown, ddH]);

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

  const pill = (i: number, label: string, tone: "high" | "low") => {
    if (!g) return null;
    const px = g.x(i);
    const py = g.y(series[i].value);
    const half = 58;
    const left = Math.max(half, Math.min(width - half, px));
    // the low pill goes above its point when the point sits low in the chart, so it never covers the drawdown caption
    const below = tone === "low" && py < height * 0.55;
    return (
      <div
        key={tone}
        className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-semibold tnum"
        style={{ left, top: below ? py + 10 : Math.max(0, py - 24), background: "color-mix(in srgb, var(--ink) 9%, var(--surface))", boxShadow: "inset 0 0 0 0.5px var(--line-strong)" }}
      >
        {label}
      </div>
    );
  };

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y select-none"
      style={{ height: total }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={(e) => scrub(e.clientX)}
      onPointerMove={(e) => (e.buttons || e.pointerType === "touch") && scrub(e.clientX)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={(e) => e.pointerType === "mouse" && release()}
    >
      {g && (
        <>
          <svg width={width} height={total} className="block overflow-visible">
            <defs>
              <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="eq-dd" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--negative)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="var(--negative)" stopOpacity={0.38} />
              </linearGradient>
            </defs>
            <path d={g.area} fill="url(#eq-fill)" />
            <path d={g.line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {ddH > 0 && (
              <>
                <text x={0} y={height + 8} className="fill-[var(--ink-3)] text-[10px] font-medium">{tr("Просадка от пика")}</text>
                <line x1={0} x2={width} y1={g.base} y2={g.base} stroke="var(--line-strong)" strokeWidth={0.7} />
                <path d={g.ddArea} fill="url(#eq-dd)" />
                <path d={g.ddLine} fill="none" stroke="var(--negative)" strokeWidth={1.4} strokeLinecap="round" />
              </>
            )}
            <circle cx={g.x(curve.peak.index)} cy={g.y(curve.peak.value)} r={3.5} fill="var(--bg)" stroke={color} strokeWidth={1.6} />
            {curve.low.index !== curve.peak.index && <circle cx={g.x(curve.low.index)} cy={g.y(curve.low.value)} r={3.5} fill="var(--bg)" stroke="var(--negative)" strokeWidth={1.6} />}
            <circle cx={g.x(n - 1)} cy={g.y(series[n - 1].value)} r={4.5} fill={color} />
            {active !== null && (
              <>
                <line x1={g.x(active)} x2={g.x(active)} y1={0} y2={total} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={g.x(active)} cy={g.y(series[active].value)} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
              </>
            )}
          </svg>
          {active === null ? (
            <>
              {pill(curve.peak.index, `${tr("Пик")} ${formatDay(curve.peak.day)} · ${formatValue(curve.peak.value)}`, "high")}
              {curve.low.index !== curve.peak.index && pill(curve.low.index, `${tr("Минимум")} ${formatDay(curve.low.day)} · ${formatValue(curve.low.value)}`, "low")}
            </>
          ) : (
            <div className={cn("pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold tnum")} style={{ left: Math.max(50, Math.min(width - 50, g.x(active))), background: "var(--ink)", color: "var(--ink-inverse)" }}>
              {formatDay(series[active].day)} · {formatValue(series[active].value)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
