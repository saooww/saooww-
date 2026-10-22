import type { ComponentType } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useUI, type Route, type RouteName, type Tab } from "../store/ui";
import { dur, ease, gpu } from "../ui/motion";
import { RouteContext } from "./Screen";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteComponent = ComponentType<any>;

export interface RouteTable {
  roots: Record<Tab, RouteComponent>;
  routes: Partial<Record<RouteName, RouteComponent>>;
}

let table: RouteTable | null = null;

export function registerRoutes(t: RouteTable) {
  table = t;
}

const navTransition = { type: "tween" as const, ease: ease.nav, duration: dur.nav };

/** One navigation stack per tab: push slides in from the right, the screen below parallaxes and dims. */
export function StackView({ tab, active }: { tab: Tab; active: boolean }) {
  const stack = useUI((s) => s.stacks[tab]);
  // A "hero" screen (opened from a card) handles its own entrance: the card flies, nothing slides.
  const topIsHero = !!stack[stack.length - 1]?.params?.from;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence initial={false}>
        {stack.map((route, i) => (
          <Layer key={route.key} route={route} index={i} depth={stack.length - 1 - i} tab={tab} active={active} coverIsHero={topIsHero} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Layer({ route, index, depth, tab, active, coverIsHero }: { route: Route; index: number; depth: number; tab: Tab; active: boolean; coverIsHero: boolean }) {
  const controls = useDragControls();
  const pop = useUI((s) => s.pop);
  const Comp = route.name === "root" ? table?.roots[tab] : table?.routes[route.name];
  const hero = !!route.params?.from;
  const canSwipe = depth === 0 && index > 0 && !hero;
  if (!Comp) return null;
  const shiftedX = coverIsHero && depth === 1 ? 0 : "-28%";

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        zIndex: index,
        pointerEvents: depth === 0 ? "auto" : "none",
        boxShadow: index > 0 && !hero ? "-16px 0 40px rgba(0,0,0,0.28)" : undefined
      }}
      transformTemplate={gpu}
      initial={hero ? { x: 0 } : { x: "100%" }}
      animate={{ x: depth === 0 ? 0 : shiftedX, visibility: "visible", transitionEnd: depth > 1 ? { visibility: "hidden" } : undefined }}
      exit={hero ? { opacity: 0, transition: { duration: 0.06, delay: 0.4 } } : { x: "100%" }}
      transition={navTransition}
      drag={canSwipe ? "x" : false}
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 1 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.x > window.innerWidth * 0.33 || info.velocity.x > 600) pop();
      }}
      onPointerDown={(e) => {
        // Swipe from the left edge to go back
        if (canSwipe && e.clientX < 24) controls.start(e);
      }}
    >
      <RouteContext.Provider value={{ tab, route, isRoot: index === 0, active: active && depth === 0 }}>
        <Comp {...(route.params ?? {})} />
      </RouteContext.Provider>
      <motion.div
        className="pointer-events-none absolute inset-0 z-50 bg-black"
        initial={false}
        animate={{ opacity: depth > 0 ? (coverIsHero && depth === 1 ? 0 : 0.32) : 0 }}
        transition={navTransition}
      />
    </motion.div>
  );
}
