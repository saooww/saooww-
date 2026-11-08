import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChartColumn, CircleCheckBig, House, LayoutGrid, WalletCards, type LucideIcon } from "../ui/glyphs";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { useUI, type Tab } from "../store/ui";
import { INTRO_SHIFT, introActive } from "../ui/intro";
import { spring } from "../ui/motion";

const ITEMS: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
  { tab: "home", label: "Главная", icon: House },
  { tab: "planner", label: "Дела", icon: CircleCheckBig },
  { tab: "wallets", label: "Кошельки", icon: WalletCards },
  { tab: "transactions", label: "Операции", icon: ArrowLeftRight },
  { tab: "analytics", label: "Аналитика", icon: ChartColumn },
  { tab: "more", label: "Ещё", icon: LayoutGrid }
];

/** A floating glass capsule; the active tab sits on a soft sliding pill. */
export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const [intro] = useState(introActive);
  return (
    <nav aria-label="Разделы" className="pointer-events-none fixed inset-x-0 z-40 px-3 max-[389px]:px-2" style={{ bottom: "var(--tabbar-bottom)" }}>
      <motion.div
        role="tablist"
        className="glass pointer-events-auto relative mx-auto flex max-w-[480px] rounded-[26px] p-[5px]"
        style={{ height: "var(--tabbar-h)" }}
        initial={intro ? { y: 16, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.85 + INTRO_SHIFT }}
      >
        {/* One pill that slides by transform: a shared-layout animation here would
            make the motion library re-measure every animated element in the app. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-[5px] left-[5px] rounded-[21px]"
          style={{
            width: `calc((100% - 10px) / ${ITEMS.length})`,
            background: "linear-gradient(180deg, var(--panel-highlight), transparent 80%), color-mix(in srgb, var(--ink) 7%, transparent)",
            boxShadow: "inset 0 0 0 0.5px var(--line-strong)"
          }}
          initial={false}
          animate={{ x: `${Math.max(0, ITEMS.findIndex((i) => i.tab === tab)) * 100}%` }}
          transition={spring.snappy}
        />
        {ITEMS.map(({ tab: t, label, icon: Icon }) => {
          const active = t === tab;
          return (
            <motion.button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              whileTap={{ scale: 0.9 }}
              transition={spring.press}
              onClick={() => {
                if (!active) haptic();
                setTab(t);
              }}
              className={cn("relative flex flex-1 flex-col items-center justify-center gap-[4px] rounded-[21px] transition-colors duration-200", active ? "text-ink" : "text-ink-3")}
            >
              <Icon size={23} weight={active ? "fill" : "regular"} className={cn("relative transition-colors duration-200", active && "text-accent-ink")} />
              <span className="relative max-w-full truncate text-[10px] font-semibold leading-none tracking-[0.02em] max-[389px]:text-[9.5px] max-[389px]:tracking-normal">{label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </nav>
  );
}
