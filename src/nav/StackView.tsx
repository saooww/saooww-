import { createContext, memo, useContext, useLayoutEffect, useMemo, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useUI, type Route, type RouteName, type Tab } from "../store/ui";
import { dur, ease, gpu } from "../ui/motion";
import { RouteContext } from "./Screen";
import { FreezeContext, createFreezeSwitch } from "../store/freeze";

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

/** Whether this tab is the one on screen; read only by the screen content, never by the sliding layer. */
const TabActiveContext = createContext(false);

/** One navigation stack per tab: push slides in from the right, the screen below parallaxes and dims. */
export function StackView({ tab, active }: { tab: Tab; active: boolean }) {
  const stack = useUI((s) => s.stacks[tab]);
  // A "hero" screen (opened from a card) handles its own entrance: the card flies, nothing slides.
  const topIsHero = !!stack[stack.length - 1]?.params?.from;
  return (
    <TabActiveContext.Provider value={active}>
      <div className="absolute inset-0 overflow-hidden">
        {/* Screens are stacked absolutely, so one leaving never moves another: without
            presenceAffectsLayout every re-render here would make the motion library
            re-measure every animated element of the tab. */}
        <AnimatePresence initial={false} presenceAffectsLayout={false}>
          {stack.map((route, i) => (
            <Layer key={route.key} route={route} index={i} depth={stack.length - 1 - i} tab={tab} coverIsHero={topIsHero} />
          ))}
        </AnimatePresence>
      </div>
    </TabActiveContext.Provider>
  );
}

/**
 * The sliding layer of one screen. It is memoised and doesn't know whether
 * its tab is on screen: re-rendering it (a draggable motion element) makes
 * the motion library re-measure every animated element inside, which made
 * switching tabs stutter.
 */
const Layer = memo(function Layer({ route, index, depth, tab, coverIsHero }: { route: Route; index: number; depth: number; tab: Tab; coverIsHero: boolean }) {
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
      <LayerContent Comp={Comp} route={route} index={index} depth={depth} tab={tab} />
      <motion.div
        className="pointer-events-none absolute inset-0 z-50 bg-black"
        initial={false}
        animate={{ opacity: depth > 0 ? (coverIsHero && depth === 1 ? 0 : 0.32) : 0 }}
        transition={navTransition}
      />
    </motion.div>
  );
});

/** The screen itself, plus whether it is on top and on screen (which freezes or wakes its data). */
function LayerContent({ Comp, route, index, depth, tab }: { Comp: RouteComponent; route: Route; index: number; depth: number; tab: Tab }) {
  const active = useContext(TabActiveContext);
  const onTop = active && depth === 0;

  // Out of sight → its data holds still (see FreezeContext).
  const [freeze] = useState(() => createFreezeSwitch(!onTop));
  useLayoutEffect(() => freeze.set(!onTop), [freeze, onTop]);
  // The same element is handed back, so the screen doesn't redraw; only what depends on the change updates.
  const ctx = useMemo(() => ({ tab, route, isRoot: index === 0, active: onTop }), [tab, route, index, onTop]);
  const content = useMemo(() => <Comp {...(route.params ?? {})} />, [Comp, route.params]);

  return (
    <FreezeContext.Provider value={freeze}>
      <RouteContext.Provider value={ctx}>{content}</RouteContext.Provider>
    </FreezeContext.Provider>
  );
}
