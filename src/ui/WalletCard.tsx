import { memo, useId, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { moneyParts, type Minor } from "../lib/money";
import type { CardMaterial } from "../store/catalog";
import { BrandMark } from "./Brand";
import { useCountUp } from "./Money";

export const CARD_RATIO = 1.586; // ISO/IEC 7810 ID-1

export interface WalletCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  ident?: string;
  amount: Minor;
  currency: string;
  material: CardMaterial;
  hidden?: boolean;
  onToggleHidden?: () => void;
  /** Small label next to the identifier, e.g. a currency code */
  badge?: string;
  footnote?: ReactNode;
  className?: string;
  /** Signed carousel offset (-1…1): moves the light across the surface */
  sheen?: MotionValue<number>;
  /** First appearance: the balance counts up and a light sweeps across once */
  intro?: boolean;
}

function amountSize(text: string): number {
  const len = text.length;
  if (len <= 9) return 40;
  if (len <= 11) return 37;
  if (len <= 13) return 33;
  if (len <= 15) return 29;
  return 25;
}

/**
 * Shippō — interlocking circles, a traditional Japanese pattern for
 * prosperity. Drawn as hairlines and faded in from the lower-right corner.
 */
function Shippo({ color }: { color: string }) {
  const id = useId().replace(/:/g, "");
  const r = 13;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id={`p${id}`} width={r * 2} height={r * 2} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="0.6">
            <circle cx={0} cy={0} r={r} />
            <circle cx={r * 2} cy={0} r={r} />
            <circle cx={0} cy={r * 2} r={r} />
            <circle cx={r * 2} cy={r * 2} r={r} />
            <circle cx={r} cy={r} r={r} />
          </g>
        </pattern>
        <radialGradient id={`g${id}`} cx="100%" cy="100%" r="95%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`m${id}`}>
          <rect width="100%" height="100%" fill={`url(#g${id})`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#p${id})`} mask={`url(#m${id})`} />
    </svg>
  );
}


export const WalletCard = memo(function WalletCard({
  title,
  subtitle,
  icon: Icon,
  ident,
  amount,
  currency,
  material,
  hidden,
  onToggleHidden,
  badge,
  footnote,
  className,
  sheen,
  intro
}: WalletCardProps) {
  const shown = useCountUp(amount, intro ? 1.4 : 0.8, intro ? { from: 0, delay: 0.55 } : undefined);
  const p = moneyParts(shown, { currency });
  const final = moneyParts(amount, { currency });
  // Size by the final value so the figure doesn't jump while counting.
  const size = amountSize(`${final.sign}${final.int}${final.frac}`);
  const resting = useMotionValue(0);
  const light = sheen ?? resting;
  const sheenX = useTransform(light, [-1, 0, 1], ["170%", "-20%", "-200%"]);
  const sheenOpacity = useTransform(light, [-1, 0, 1], [0.2, 1, 0.2]);
  const chip = material.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.11)";

  return (
    <div
      className={cn("grain relative w-full overflow-hidden rounded-[22px]", className)}
      style={{
        aspectRatio: String(CARD_RATIO),
        background: material.background,
        color: material.ink,
        boxShadow: [
          material.light ? "inset 0 0 0 0.5px rgba(0,0,0,0.09)" : "inset 0 0 0 0.5px rgba(255,255,255,0.13)",
          material.light ? "inset 0 1px 0 rgba(255,255,255,0.9)" : "inset 0 1px 0 rgba(255,255,255,0.18)",
          "inset 0 -1px 0 rgba(0,0,0,0.22)",
          "var(--card-drop)",
          `0 34px 70px -34px ${material.glow}`
        ].join(", ")
      }}
    >
      <Shippo color={material.line} />

      {/* moving light */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-1/4 left-0 w-[70%]"
        style={{
          x: sheenX,
          opacity: sheenOpacity,
          background: `linear-gradient(105deg, transparent 20%, ${material.light ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.075)"} 50%, transparent 80%)`
        }}
      />
      {intro && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)",
            animation: "sheen 1.5s 0.75s cubic-bezier(0.22, 1, 0.36, 1) both"
          }}
        />
      )}

      <div className="relative flex h-full flex-col justify-between p-[22px]">
        {/* top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
                style={{ background: chip, boxShadow: material.light ? "inset 0 0 0 0.5px rgba(0,0,0,0.06)" : "inset 0 0.5px 0 rgba(255,255,255,0.16)" }}
              >
                <Icon size={16} strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-callout font-semibold tracking-[-0.012em]">{title}</div>
              {subtitle && (
                <div className="truncate text-caption" style={{ color: material.inkMuted }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <div className="pt-1" style={{ opacity: material.light ? 0.9 : 0.78 }}>
            <BrandMark size={17} color={material.ink} />
          </div>
        </div>

        {/* balance */}
        <div>
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.14em]" style={{ color: material.inkMuted }}>
            Баланс
          </div>
          <div className="font-semibold leading-none tracking-[-0.04em] tnum" style={{ fontSize: size }} aria-label={hidden ? "Баланс скрыт" : undefined}>
            {hidden ? (
              <span className="tracking-[0.08em]">
                ••••••<span className="ml-1.5 text-[0.58em] font-medium" style={{ color: material.inkMuted }}>{p.symbol}</span>
              </span>
            ) : (
              <>
                {p.sign}
                {p.int}
                {p.frac && <span className="text-[0.58em] font-medium" style={{ color: material.inkMuted }}>{p.frac}</span>}
                <span className="ml-[0.14em] text-[0.58em] font-medium" style={{ color: material.inkMuted }}>
                  {p.symbol}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 flex h-7 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 text-footnote tnum" style={{ color: material.inkMuted }}>
              {ident && <span className="tracking-[0.16em]">•• {ident}</span>}
              {badge && (
                <span className="rounded-[6px] px-1.5 py-[1px] text-micro font-semibold" style={{ background: chip, color: material.ink }}>
                  {badge}
                </span>
              )}
              {footnote}
            </div>
            {onToggleHidden && (
              <button
                type="button"
                data-no-tap=""
                aria-label={hidden ? "Показать баланс" : "Скрыть баланс"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="-mr-1.5 grid h-8 w-8 place-items-center rounded-full transition-opacity active:opacity-50"
                style={{ background: chip }}
              >
                {hidden ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
