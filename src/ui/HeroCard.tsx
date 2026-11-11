import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "../lib/cn";
import type { CardMaterial } from "../store/catalog";
import { Sail } from "./WalletCard";

/**
 * The large card that opens each section — cast in the same materials as
 * the wallet cards (Ardessa red, obsidian, graphite, titanium…), with the
 * sail watermark. It leans towards the finger and a light follows it, so it
 * feels like a real card in the hand.
 */
export function HeroCard({
  material,
  children,
  onClick,
  ariaLabel,
  className,
  style,
  tilt = true
}: {
  material: CardMaterial;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** Lean towards the finger (off where the card holds its own gestures, like a chart) */
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 22 });
  const sy = useSpring(py, { stiffness: 220, damping: 22 });
  const rotateY = useTransform(sx, [0, 1], [-7, 7]);
  const rotateX = useTransform(sy, [0, 1], [6, -6]);
  const lx = useTransform(sx, (v) => `${v * 100}%`);
  const ly = useTransform(sy, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(60% 70% at ${lx} ${ly}, rgba(255,255,255,${material.light ? 0.35 : 0.16}), transparent 70%)`;

  const follow = (e: React.PointerEvent) => {
    if (!tilt) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    py.set(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
  };
  const rest = () => {
    px.set(0.5);
    py.set(0.5);
  };

  const Tag = onClick ? motion.button : motion.div;
  return (
    <div className={cn("mx-4", className)} style={{ perspective: 900 }}>
      <Tag
        ref={ref as never}
        type={onClick ? "button" : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerDown={follow}
        onPointerMove={(e: React.PointerEvent) => (e.pointerType === "mouse" || e.buttons ? follow(e) : undefined)}
        onPointerUp={rest}
        onPointerLeave={rest}
        onPointerCancel={rest}
        whileTap={{ scale: 0.985 }}
        className={cn("relative block w-full overflow-hidden rounded-[26px] text-left", !material.light && "on-dark")}
        style={{
          rotateX,
          rotateY,
          background: material.background,
          color: material.ink,
          boxShadow: `0 1px 0 rgba(255,255,255,0.08) inset, 0 34px 60px -30px ${material.glow}, var(--card-drop)`,
          transformStyle: "preserve-3d",
          ...style
        }}
      >
        <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: material.light ? 0.5 : 0.85 }}>
          <Sail color={material.line} />
        </span>
        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: light }} />
        {/* a light sweeps across once, as the card appears */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.22), transparent)", skewX: -18 }}
          initial={{ left: "-40%" }}
          animate={{ left: "140%" }}
          transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="relative">{children}</div>
      </Tag>
    </div>
  );
}
