import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChartColumn, House, LayoutGrid, WalletCards, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { useUI, type Tab } from "../store/ui";
import { introActive } from "../ui/intro";
import { spring } from "../ui/motion";

const ITEMS: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
  { tab: "home", label: "Главная", icon: House },
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
    <nav aria-label="Разделы" className="pointer-events-none fixed inset-x-0 z-40 px-3" style={{ bottom: "var(--tabbar-bottom)" }}>
      <motion.div
        role="tablist"
        className="glass pointer-events-auto mx-auto flex max-w-[480px] rounded-[26px] p-[5px]"
        style={{ height: "var(--tabbar-h)" }}
        initial={intro ? { y: 28, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring.smooth, delay: 1.0 }}
      >
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
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[21px]"
                  style={{
                    background: "linear-gradient(180deg, var(--panel-highlight), transparent 80%), color-mix(in srgb, var(--ink) 7%, transparent)",
                    boxShadow: "inset 0 0 0 0.5px var(--line-strong)"
                  }}
                  transition={spring.snappy}
                />
              )}
              <Icon size={22} strokeWidth={active ? 2.05 : 1.75} className={cn("relative transition-colors duration-200", active && "text-accent-ink")} />
              <span className="relative text-[10px] font-semibold leading-none tracking-[0.02em]">{label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </nav>
  );
}
