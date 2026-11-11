import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { useUI, type Tab } from "../store/ui";
import { spring } from "../ui/motion";
import { tr } from "../i18n/i18n";

const OPTIONS: Array<{ value: Tab; label: string }> = [
  { value: "wallets", label: tr("Счета") },
  { value: "transactions", label: tr("Операции") },
  { value: "analytics", label: tr("Аналитика") }
];

/**
 * «Деньги» is one section in the tab bar; accounts, operations and analytics
 * are its three views, switched by pills in the top bar. Each view keeps its
 * own scroll and screens.
 */
export function MoneyHeader({ current, actions }: { current: Tab; actions?: ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2">
      <div role="tablist" aria-label={tr("Деньги")} className="flex min-w-0 items-center gap-1.5">
        {OPTIONS.map((o) => {
          const on = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (on) return;
                haptic();
                useUI.getState().setTab(o.value);
              }}
              className={cn("relative h-[34px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14.5px] font-semibold leading-none transition-colors", on ? "text-[var(--bg)]" : "text-ink")}
            >
              {on ? (
                <motion.span layoutId={`money-pill-${current}`} className="absolute inset-0 rounded-full bg-[var(--ink)]" transition={spring.snappy} />
              ) : (
                <span className="tile absolute inset-0 rounded-full" />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}
