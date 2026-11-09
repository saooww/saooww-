import { useState } from "react";
import { motion } from "framer-motion";
import { CircleCheckBig, House, Plus, User, WalletCards, type LucideIcon } from "../ui/glyphs";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { MONEY_TABS, nav, useUI, type Tab } from "../store/ui";
import { INTRO_SHIFT, introActive } from "../ui/intro";
import { spring } from "../ui/motion";
import { tr } from "../i18n/i18n";

type Item = { id: "home" | "money" | "planner" | "more"; label: string; icon: LucideIcon; slot: number };

// Five slots: four sections and the create button in the middle.
const ITEMS: Item[] = [
  { id: "home", label: tr("Главная"), icon: House, slot: 0 },
  { id: "money", label: tr("Деньги"), icon: WalletCards, slot: 1 },
  { id: "planner", label: tr("Дела"), icon: CircleCheckBig, slot: 3 },
  { id: "more", label: tr("Профиль"), icon: User, slot: 4 }
];

const itemOf = (tab: Tab): Item["id"] => (MONEY_TABS.includes(tab) ? "money" : (tab as Item["id"]));

/** A floating glass capsule: four sections on a sliding pill, and «+» in the middle. */
export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const moneyTab = useUI((s) => s.moneyTab);
  const [intro] = useState(introActive);
  const current = itemOf(tab);
  const slot = ITEMS.find((i) => i.id === current)?.slot ?? 0;

  return (
    <nav aria-label={tr("Разделы")} className="pointer-events-none fixed inset-x-0 z-40 px-3 max-[389px]:px-2" style={{ bottom: "var(--tabbar-bottom)" }}>
      <motion.div
        role="tablist"
        className="glass pointer-events-auto relative mx-auto grid max-w-[480px] grid-cols-5 rounded-[26px] p-[5px]"
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
          style={{ width: "calc((100% - 10px) / 5)", background: "color-mix(in srgb, var(--ink) 7%, transparent)" }}
          initial={false}
          animate={{ x: `${slot * 100}%` }}
          transition={spring.snappy}
        />
        {ITEMS.map(({ id, label, icon: Icon, slot: col }) => {
          const active = id === current;
          const target: Tab = id === "money" ? moneyTab : id;
          return (
            <motion.button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={label}
              whileTap={{ scale: 0.9 }}
              transition={spring.press}
              onClick={() => {
                if (!active) haptic();
                setTab(active ? tab : target);
              }}
              style={{ gridColumn: col + 1, gridRow: 1 }}
              className={cn("relative flex flex-col items-center justify-center gap-[4px] rounded-[21px] transition-colors duration-200", active ? "text-ink" : "text-ink-3")}
            >
              <Icon size={23} weight={active ? "fill" : "regular"} className={cn("relative transition-colors duration-200", active && "text-accent-ink")} />
              <span className="relative max-w-full truncate text-[10px] font-semibold leading-none tracking-[0.02em] max-[389px]:text-[9.5px] max-[389px]:tracking-normal">{label}</span>
            </motion.button>
          );
        })}
        <div className="relative grid place-items-center" style={{ gridColumn: 3, gridRow: 1 }}>
          <motion.button
            type="button"
            aria-label={tr("Создать")}
            whileTap={{ scale: 0.88 }}
            transition={spring.press}
            onClick={() => {
              haptic("medium");
              nav.sheet("create");
            }}
            className="fill-accent grid h-[48px] w-[48px] place-items-center rounded-[17px] text-[var(--accent-on)]"
          >
            <Plus size={24} />
          </motion.button>
        </div>
      </motion.div>
    </nav>
  );
}
