import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { cn } from "../lib/cn";
import { useUI, type Route, type Tab } from "../store/ui";
import { IconButton } from "../ui/primitives";

export interface RouteCtx {
  tab: Tab;
  route: Route;
  isRoot: boolean;
  active: boolean;
}

export const RouteContext = createContext<RouteCtx>({ tab: "home", route: { key: "root", name: "root" }, isRoot: true, active: true });

export function useRoute() {
  return useContext(RouteContext);
}

export interface ScreenProps {
  title?: string;
  /** Large title at the top of the content that collapses into the bar */
  large?: boolean;
  actions?: ReactNode;
  /** Replaces the whole bar content (home screen) */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra content pinned under the bar (search, filters) */
  subheader?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement>;
  onBack?: () => void;
  /** No canvas background (the screen draws its own) */
  bare?: boolean;
  /** Fades the top bar together with custom transitions */
  chromeOpacity?: MotionValue<number>;
}

export const BAR_H = 52;

/**
 * A screen: scroll container + top bar. With `large`, the title lives in the
 * content and fades into the bar as you scroll, the way iOS does it.
 */
export function Screen({ title, large, actions, header, children, className, subheader, scrollRef, onBack, bare, chromeOpacity }: ScreenProps) {
  const { tab, isRoot } = useRoute();
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = scrollRef ?? ownRef;
  const { scrollY } = useScroll({ container: ref });
  const barBg = useTransform(scrollY, [0, 12], [0, 1]);
  const compactTitle = useTransform(scrollY, large ? [30, 52] : [0, 1], [large ? 0 : 1, 1]);
  const retap = useUI((s) => s.retap[tab]);
  const pop = useUI((s) => s.pop);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isRoot) ref.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [retap, isRoot, ref]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", !bare && "app-canvas")}>
      <div ref={ref} className={cn("scroll-y absolute inset-0", className)} style={{ paddingTop: `calc(var(--safe-top) + ${BAR_H}px)`, paddingBottom: "calc(var(--tabbar-h) + var(--safe-bottom) + 28px)" }}>
        {large && title && <h1 className="px-5 pb-4 pt-1 text-title-1 font-bold">{title}</h1>}
        {subheader}
        {children}
      </div>

      {/* Top bar */}
      <motion.div className="absolute inset-x-0 top-0 z-20" style={{ height: `calc(var(--safe-top) + ${BAR_H}px)`, opacity: chromeOpacity }}>
        <motion.div className="blur-bar absolute inset-0 hairline-b" style={{ opacity: barBg, background: "var(--header-bg)" }} />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4" style={{ height: BAR_H }}>
          {header ?? (
            <>
              <div className="flex min-w-[40px] items-center">
                {!isRoot && <IconButton icon={ChevronLeft} label="Назад" iconSize={22} onClick={onBack ?? pop} />}
              </div>
              <motion.div className="pointer-events-none absolute inset-x-24 truncate text-center text-headline font-semibold" style={{ opacity: compactTitle }}>
                {title}
              </motion.div>
              <div className="ml-auto flex items-center gap-2">{actions}</div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
