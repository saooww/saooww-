import { motion } from "framer-motion";
import { ArrowLeftRight, ChartColumn, House, LayoutGrid, WalletCards, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { useUI, type Tab } from "../store/ui";
import { spring } from "../ui/motion";

const ITEMS: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
  { tab: "home", label: "Главная", icon: House },
  { tab: "wallets", label: "Кошельки", icon: WalletCards },
  { tab: "transactions", label: "Операции", icon: ArrowLeftRight },
  { tab: "analytics", label: "Аналитика", icon: ChartColumn },
  { tab: "more", label: "Ещё", icon: LayoutGrid }
];

export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  return (
    <nav
      aria-label="Разделы"
      className="blur-bar fixed inset-x-0 bottom-0 z-40 hairline-t"
      style={{ background: "var(--tabbar-bg)", paddingBottom: "var(--safe-bottom)" }}
    >
      <div role="tablist" className="mx-auto flex max-w-[560px] px-1.5" style={{ height: "var(--tabbar-h)" }}>
        {ITEMS.map(({ tab: t, label, icon: Icon }) => {
          const active = t === tab;
          return (
            <motion.button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              whileTap={{ scale: 0.88 }}
              transition={spring.press}
              onClick={() => {
                if (!active) haptic();
                setTab(t);
              }}
              className={cn("relative flex flex-1 flex-col items-center justify-center gap-[3px] pt-1 transition-colors duration-200", active ? "text-ink" : "text-ink-3")}
            >
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute top-0 h-[2px] w-5 rounded-full bg-accent"
                  transition={spring.snappy}
                />
              )}
              <Icon size={23} strokeWidth={active ? 2.1 : 1.8} />
              <span className="text-[10.5px] font-medium leading-none tracking-[0.01em]">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
