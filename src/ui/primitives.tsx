import { forwardRef, useId, type CSSProperties, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { NamedIcon } from "./icons";
import { spring } from "./motion";

/* ------------------------------------------------------------------ */
/*  Pressable                                                          */
/* ------------------------------------------------------------------ */

export type PressableProps = HTMLMotionProps<"button"> & {
  /** Scale while pressed */
  pressScale?: number;
  /** Fire a haptic tick on press */
  tick?: boolean;
};

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { pressScale = 0.97, tick, className, onClick, disabled, type = "button", ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: pressScale }}
      transition={spring.press}
      onClick={(e) => {
        if (tick) haptic();
        onClick?.(e);
      }}
      className={cn("select-none", className)}
      {...rest}
    />
  );
});

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "tinted";
type ButtonSize = "lg" | "md" | "sm";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "fill-accent text-[var(--accent-on)] disabled:opacity-40 disabled:shadow-none",
  secondary: "tile text-ink disabled:opacity-40",
  ghost: "text-ink-2 disabled:opacity-40",
  danger: "bg-negative-soft text-negative disabled:opacity-40",
  tinted: "bg-accent-soft text-accent-ink disabled:opacity-40"
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  lg: "h-[54px] px-5 text-headline font-semibold rounded-[16px] gap-2",
  md: "h-11 px-4 text-callout font-semibold rounded-[14px] gap-2",
  sm: "h-[34px] px-3.5 text-subhead font-semibold rounded-[11px] gap-1.5"
};

export type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "lg", icon: Icon, block, className, children, ...rest },
  ref
) {
  return (
    <Pressable
      ref={ref}
      tick={variant === "primary"}
      className={cn("inline-flex items-center justify-center whitespace-nowrap", BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && "w-full", className)}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 16 : 18} strokeWidth={2.2} />}
      {children as ReactNode}
    </Pressable>
  );
});

export type IconButtonProps = PressableProps & {
  icon: LucideIcon;
  label: string;
  variant?: "plain" | "filled" | "accent";
  size?: number;
  iconSize?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = "filled", size = 36, iconSize, className, ...rest },
  ref
) {
  return (
    <Pressable
      ref={ref}
      aria-label={label}
      title={label}
      pressScale={0.9}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        variant === "filled" && "tile text-ink",
        variant === "plain" && "text-ink",
        variant === "accent" && "fill-accent text-[var(--accent-on)]",
        className
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={iconSize ?? Math.round(size * 0.48)} strokeWidth={1.9} />
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/*  Chips, toggles, segmented                                          */
/* ------------------------------------------------------------------ */

export function Chip({
  selected,
  children,
  onClick,
  icon: Icon,
  className,
  onRemove
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
  onRemove?: () => void;
}) {
  return (
    <Pressable
      onClick={onClick}
      pressScale={0.95}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-subhead font-medium transition-[background,color] duration-200",
        selected ? "bg-ink text-ink-inverse" : "tile text-ink-2",
        className
      )}
    >
      {Icon && <Icon size={15} strokeWidth={2.1} />}
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          aria-label="Сбросить"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 ml-0.5 grid h-5 w-5 place-items-center rounded-full opacity-70"
        >
          ×
        </span>
      )}
    </Pressable>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic();
        onChange(!checked);
      }}
      className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-[background,box-shadow] duration-200", checked ? "fill-positive" : "bg-surface-press", disabled && "opacity-40")}
      style={{ boxShadow: checked ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 16px -8px var(--positive)" : "inset 0 0 0 0.5px var(--line)" }}
    >
      <motion.span
        className="absolute left-[2px] top-[2px] h-[26px] w-[26px] rounded-full bg-white"
        style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.04)" }}
        animate={{ x: checked ? 20 : 0 }}
        transition={spring.snappy}
      />
    </button>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "sm";
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("relative flex rounded-[12px] p-[3px]", className)} style={{ background: "color-mix(in srgb, var(--ink) 6%, transparent)", boxShadow: "inset 0 0 0 0.5px var(--line)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) haptic();
              onChange(o.value);
            }}
            className={cn(
              "relative flex-1 rounded-[9px] font-semibold transition-colors duration-200",
              size === "md" ? "h-8 text-subhead" : "h-7 text-footnote",
              active ? "text-ink" : "text-ink-2"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[9px]"
                style={{
                  background: "linear-gradient(180deg, var(--panel-highlight), transparent 70%), var(--seg-thumb)",
                  boxShadow: "inset 0 0 0 0.5px var(--line-strong), 0 2px 6px -1px rgba(0,0,0,0.28)"
                }}
                transition={spring.snappy}
              />
            )}
            <span className="relative z-[1]">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress                                                           */
/* ------------------------------------------------------------------ */

const TONE_COLOR = { accent: "var(--accent)", positive: "var(--positive)", warning: "var(--warning)", negative: "var(--negative)", ink: "var(--ink)" };

export function ProgressBar({
  value,
  tone = "accent",
  height = 6,
  className,
  marker
}: {
  value: number;
  tone?: "accent" | "positive" | "warning" | "negative" | "ink";
  height?: number;
  className?: string;
  /** Optional tick (0..1), e.g. "where you should be by today" */
  marker?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  const color = TONE_COLOR[tone];
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full", className)} style={{ height, background: "var(--line)" }}>
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
        style={{
          background: tone === "accent" ? "linear-gradient(90deg, var(--accent-lo), var(--accent-hi))" : `linear-gradient(90deg, color-mix(in srgb, ${color} 72%, transparent), ${color})`,
          boxShadow: tone === "ink" ? undefined : `0 0 12px -2px ${color}`
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: v }}
        transition={{ type: "spring", stiffness: 140, damping: 26, mass: 1 }}
      />
      {marker !== undefined && marker > 0 && marker < 1 && (
        <div className="absolute inset-y-0 w-[2px] rounded-full bg-ink opacity-50" style={{ left: `calc(${marker * 100}% - 1px)` }} />
      )}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 8,
  tone = "accent",
  children
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "positive";
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, value));
  const gid = useId().replace(/:/g, "");
  const [from, to] = tone === "accent" ? ["var(--accent-hi)", "var(--accent-lo)"] : ["var(--positive-hi)", "var(--positive)"];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id={`ring-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${gid})`}
          style={{ filter: `drop-shadow(0 0 6px ${tone === "accent" ? "var(--accent-glow)" : "color-mix(in srgb, var(--positive) 50%, transparent)"})` }}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(v, 0.001) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, mass: 1 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lists                                                              */
/* ------------------------------------------------------------------ */

export function SectionHeader({ title, action, className }: { title: ReactNode; action?: { label: string; onClick: () => void }; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 pb-3 pt-1", className)}>
      <h2 className="label-caps">{title}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="-my-2 flex items-center gap-0.5 py-2 text-footnote font-medium text-ink-2 active:opacity-60">
          {action.label}
          <ChevronRight size={14} strokeWidth={2.2} className="text-ink-3" />
        </button>
      )}
    </div>
  );
}

export function Group({ children, className, header, footer }: { children: ReactNode; className?: string; header?: ReactNode; footer?: ReactNode }) {
  return (
    <section className={cn("mx-4", className)}>
      {header && <div className="label-caps px-1 pb-2.5">{header}</div>}
      <div className="panel overflow-hidden rounded-lg [&>*+*]:hairline-t">{children}</div>
      {footer && <div className="px-1 pt-2 text-footnote text-ink-3">{footer}</div>}
    </section>
  );
}

/**
 * Icon in a soft squircle tile. `color` tints it with a category colour;
 * `tone` uses a semantic colour; otherwise it is a neutral stone tile.
 */
export function IconChip({
  name,
  icon: Icon,
  size = 32,
  className,
  tone,
  color
}: {
  name?: string;
  icon?: LucideIcon;
  size?: number;
  className?: string;
  tone?: "accent" | "positive" | "warning" | "negative";
  color?: string;
}) {
  const toneCls = tone ? { accent: "bg-accent-soft text-accent-ink", positive: "bg-positive-soft text-positive", warning: "bg-warning-soft text-warning", negative: "bg-negative-soft text-negative" }[tone] : color ? "" : "tile text-ink";
  const iconSize = Math.round(size * 0.48);
  const style: CSSProperties = { width: size, height: size, borderRadius: Math.round(size * 0.34) };
  if (color && !tone) {
    style.color = color;
    style.background = `linear-gradient(180deg, color-mix(in srgb, ${color} 22%, transparent), color-mix(in srgb, ${color} 11%, transparent))`;
    style.boxShadow = `inset 0 0 0 0.5px color-mix(in srgb, ${color} 22%, transparent)`;
  }
  return (
    <span className={cn("inline-grid shrink-0 place-items-center", toneCls, className)} style={style}>
      {Icon ? <Icon size={iconSize} strokeWidth={1.9} /> : <NamedIcon name={name} size={iconSize} strokeWidth={1.9} />}
    </span>
  );
}

export interface RowProps {
  icon?: LucideIcon;
  iconName?: string;
  iconTone?: "accent" | "positive" | "warning" | "negative";
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Row({ icon, iconName, iconTone, leading, title, subtitle, value, trailing, chevron, onClick, destructive, className, ariaLabel }: RowProps) {
  const content = (
    <>
      {leading ?? ((icon || iconName) && <IconChip icon={icon} name={iconName} tone={iconTone} size={30} />)}
      <div className="min-w-0 flex-1 text-left">
        <div className={cn("truncate text-body", destructive ? "text-negative" : "text-ink")}>{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-footnote text-ink-2">{subtitle}</div>}
      </div>
      {value !== undefined && <div className="shrink-0 text-right text-callout text-ink-2 tnum">{value}</div>}
      {trailing}
      {chevron && <ChevronRight size={18} className="-mr-1 shrink-0 text-ink-3" strokeWidth={2} />}
    </>
  );
  const cls = cn("flex min-h-[54px] w-full items-center gap-3 px-4 py-2.5", className);
  if (!onClick) return <div className={cls}>{content}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(cls, "transition-colors duration-100 active:bg-surface-press")}>
      {content}
    </button>
  );
}

export function FormRow({ label, children, className, htmlFor }: { label: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("flex min-h-[52px] items-center gap-3 px-4 py-2", className)}>
      <span className="shrink-0 text-body text-ink">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end text-right">{children}</div>
    </label>
  );
}

export const inputCls = "w-full min-w-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-3";

/* ------------------------------------------------------------------ */
/*  Misc                                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon: Icon, title, text, action, className }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-8 py-10 text-center", className)}>
      <span className="tile mb-5 grid h-16 w-16 place-items-center rounded-[22px] text-ink-2">
        <Icon size={26} strokeWidth={1.7} />
      </span>
      <div className="text-headline font-semibold">{title}</div>
      {text && <p className="mt-1.5 max-w-[280px] text-callout text-ink-2 text-balance">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "•";
  return (
    <span
      className={cn("tile inline-grid shrink-0 place-items-center rounded-full font-semibold text-ink", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "positive" | "warning" | "negative" }) {
  const cls = {
    neutral: "bg-surface-3 text-ink-2",
    accent: "bg-accent-soft text-accent-ink",
    positive: "bg-positive-soft text-positive",
    warning: "bg-warning-soft text-warning",
    negative: "bg-negative-soft text-negative"
  }[tone];
  return <span className={cn("inline-flex h-[22px] items-center rounded-full px-2 text-caption font-semibold", cls)}>{children}</span>;
}
