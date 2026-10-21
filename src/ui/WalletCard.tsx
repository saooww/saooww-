import { memo, type ReactNode } from "react";
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
}

function amountSize(text: string): number {
  const len = text.length;
  if (len <= 9) return 42;
  if (len <= 11) return 38;
  if (len <= 13) return 34;
  if (len <= 15) return 30;
  return 26;
}

/** Fine guilloché arcs — the kind of line-work printed on banknotes. */
function Guilloche({ color }: { color: string }) {
  const rings = Array.from({ length: 18 }, (_, i) => 36 + i * 15);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 340 214" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="0.7">
        {rings.map((r) => (
          <circle key={r} cx="352" cy="236" r={r} />
        ))}
        {rings.slice(0, 9).map((r) => (
          <circle key={`b${r}`} cx="300" cy="250" r={r * 1.35} opacity="0.55" />
        ))}
      </g>
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
  className
}: WalletCardProps) {
  const shown = useCountUp(amount, 0.8);
  const p = moneyParts(shown, { currency });
  const size = amountSize(`${p.sign}${p.int}${p.frac}`);
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-xl", className)}
      style={{
        aspectRatio: String(CARD_RATIO),
        background: material.background,
        color: material.ink,
        boxShadow: material.light
          ? "inset 0 0 0 0.5px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8), 0 22px 44px -22px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.18)"
          : "inset 0 0 0 0.5px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.14), 0 24px 48px -22px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.3)"
      }}
    >
      <Guilloche color={material.line} />

      <div className="relative flex h-full flex-col justify-between p-[22px]">
        {/* top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: material.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)" }}>
                <Icon size={16} strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-callout font-semibold tracking-[-0.01em]">{title}</div>
              {subtitle && (
                <div className="truncate text-caption" style={{ color: material.inkMuted }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <div style={{ opacity: material.light ? 0.85 : 0.7 }}>
            <BrandMark size={18} color={material.ink} />
          </div>
        </div>

        {/* balance */}
        <div>
          <div className="font-semibold leading-none tracking-[-0.035em] tnum" style={{ fontSize: size }} aria-label={hidden ? "Баланс скрыт" : undefined}>
            {hidden ? (
              <span className="tracking-[0.08em]">
                ••••••<span className="ml-1.5 text-[0.6em] font-medium" style={{ color: material.inkMuted }}>{p.symbol}</span>
              </span>
            ) : (
              <>
                {p.sign}
                {p.int}
                {p.frac && <span className="text-[0.6em] font-medium" style={{ color: material.inkMuted }}>{p.frac}</span>}
                <span className="ml-[0.14em] text-[0.6em] font-medium" style={{ color: material.inkMuted }}>
                  {p.symbol}
                </span>
              </>
            )}
          </div>

          <div className="mt-3.5 flex h-7 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 text-footnote tnum" style={{ color: material.inkMuted }}>
              {ident && <span className="tracking-[0.14em]">•• {ident}</span>}
              {badge && (
                <span className="rounded-[5px] px-1.5 py-[1px] text-micro font-semibold" style={{ background: material.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)", color: material.ink }}>
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
                style={{ background: material.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)" }}
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
