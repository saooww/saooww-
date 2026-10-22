import { memo, useId, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { moneyParts, type Minor } from "../lib/money";
import type { CardMaterial } from "../store/catalog";
import { useData } from "../store/store";
import { BrandMark } from "./Brand";
import { displayGroups, useCountMotion } from "./Money";
import { numberFontScale } from "./numFont";

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
  /** Caption above the balance */
  label?: string;
  className?: string;
  /** Signed carousel offset (-1…1): moves the light across the surface */
  sheen?: MotionValue<number>;
  /** First appearance: the balance counts up and a light sweeps across once */
  intro?: boolean;
  /** In a stack only the top edge shows, so the card's name goes first */
  stacked?: boolean;
}

function amountSize(text: string): number {
  const len = text.length;
  if (len <= 9) return 46;
  if (len <= 11) return 41;
  if (len <= 13) return 36;
  if (len <= 15) return 31;
  return 27;
}

/**
 * Shippō — interlocking circles, a traditional Japanese pattern for
 * prosperity. Drawn as hairlines and faded in from the lower-right corner.
 */
const Shippo = memo(function Shippo({ color }: { color: string }) {
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
});

/**
 * A wallet card. The balance leads — top left, where the eye lands first;
 * the card's identity sits along the bottom edge, as on a real card
 * (reversed when `stacked`).
 */
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
  label = "Баланс",
  className,
  sheen,
  intro,
  stacked
}: WalletCardProps) {
  const fontScale = numberFontScale(useData((s) => s.settings.numberFont));
  const count = useCountMotion(amount, intro ? { from: 0, delay: 0.45, duration: 1.3 } : { duration: 0.7 });
  // While counting, keep whole units (or kopecks, if the balance has them) so
  // the figure doesn't change width as it runs.
  const hasKopecks = amount % 100 !== 0;
  const partsAt = (v: number) => moneyParts(hasKopecks ? Math.round(v) : Math.round(v / 100) * 100, { currency, kopecks: hasKopecks ? "always" : undefined });
  const intText = useTransform(count, (v) => {
    const p = partsAt(v);
    return p.sign + displayGroups(p.int);
  });
  const fracText = useTransform(count, (v) => partsAt(v).frac);
  const final = moneyParts(amount, { currency });
  const size = Math.round(amountSize(`${final.sign}${final.int}${final.frac}`) * fontScale);

  const resting = useMotionValue(0);
  const light = sheen ?? resting;
  const sheenX = useTransform(light, [-1, 0, 1], ["170%", "-20%", "-200%"]);
  const sheenOpacity = useTransform(light, [-1, 0, 1], [0.2, 1, 0.2]);
  const chip = material.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.11)";
  const meta = [subtitle, ident ? `•• ${ident}` : undefined].filter(Boolean).join(" · ");

  const brand = (
    <span className="shrink-0" style={{ opacity: material.light ? 0.9 : 0.78 }}>
      <BrandMark size={16} color={material.ink} />
    </span>
  );

  const balanceBlock = (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase leading-none tracking-[0.16em]" style={{ color: material.inkMuted }}>
          {label}
        </span>
        {!stacked && brand}
      </div>
      <div
        className="num-display mt-2.5 whitespace-nowrap leading-none"
        style={{ fontSize: size, transform: "translateZ(0)" }}
        aria-label={hidden ? "Баланс скрыт" : `${final.sign}${final.int}${final.frac} ${final.symbol}`}
      >
        {hidden ? (
          <span className="tracking-[0.08em]">
            ••••••<span className="ml-2 text-[0.5em] font-medium tracking-normal" style={{ fontFamily: "inherit", color: material.inkMuted }}>{final.symbol}</span>
          </span>
        ) : (
          <span aria-hidden="true">
            <motion.span>{intText}</motion.span>
            <motion.span className="text-[0.55em]" style={{ color: material.inkMuted }}>
              {fracText}
            </motion.span>
            <span className="ml-[0.18em] align-[0.04em] text-[0.5em] font-medium tracking-normal" style={{ color: material.inkMuted, fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
              {final.symbol}
            </span>
          </span>
        )}
      </div>
      {footnote && (
        <div className="mt-2 truncate text-caption" style={{ color: material.inkMuted }}>
          {footnote}
        </div>
      )}
    </div>
  );

  const identityRow = (
    <div className="flex items-center gap-3">
      {Icon && (
        <span
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]"
          style={{ background: chip, boxShadow: material.light ? "inset 0 0 0 0.5px rgba(0,0,0,0.06)" : "inset 0 0.5px 0 rgba(255,255,255,0.16)" }}
        >
          <Icon size={16} strokeWidth={1.9} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-callout font-semibold tracking-[-0.012em]">{title}</div>
        {(meta || badge) && (
          <div className="flex min-w-0 items-center gap-1.5 text-caption" style={{ color: material.inkMuted }}>
            <span className="truncate tnum">{meta}</span>
            {badge && (
              <span className="shrink-0 rounded-[5px] px-1.5 py-[1px] text-micro font-semibold" style={{ background: chip, color: material.ink }}>
                {badge}
              </span>
            )}
          </div>
        )}
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
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity active:opacity-50"
          style={{ background: chip }}
        >
          {hidden ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
        </button>
      )}
      {stacked && brand}
    </div>
  );

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-[22px]", className)}
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
          willChange: sheen ? "transform, opacity" : undefined,
          background: `linear-gradient(105deg, transparent 20%, ${material.light ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.075)"} 50%, transparent 80%)`
        }}
      />
      {intro && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
            animation: "sheen 1.6s 0.7s cubic-bezier(0.22, 1, 0.36, 1) both"
          }}
        />
      )}

      <div className="relative flex h-full flex-col justify-between px-[22px] pb-[18px] pt-[20px]">
        {stacked ? (
          <>
            {identityRow}
            {balanceBlock}
          </>
        ) : (
          <>
            {balanceBlock}
            {identityRow}
          </>
        )}
      </div>
    </div>
  );
});
