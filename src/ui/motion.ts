/** Motion tokens. Springs for things that move, short tweens for things that fade. */
export const spring = {
  /** Button press / release */
  press: { type: "spring" as const, stiffness: 650, damping: 38, mass: 0.6 },
  /** Small UI elements: thumbs, indicators, chips */
  snappy: { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.8 },
  /** Content and layout changes */
  smooth: { type: "spring" as const, stiffness: 320, damping: 34, mass: 1 },
  /** Bottom sheets */
  sheet: { type: "spring" as const, stiffness: 420, damping: 42, mass: 0.95 },
  /** Wallet cards — a little heavier, like a physical object */
  card: { type: "spring" as const, stiffness: 260, damping: 30, mass: 1.1 }
};

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Close to UIKit navigation */
  nav: [0.32, 0.72, 0, 1] as [number, number, number, number]
};

export const dur = { fast: 0.15, base: 0.22, slow: 0.32, nav: 0.42 };

export const fade = { duration: dur.base, ease: ease.out };
