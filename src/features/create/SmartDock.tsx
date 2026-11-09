import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUI } from "../../store/ui";
import { SmartLine } from "./SmartLine";

/**
 * The smart line, always at hand: it floats just above the tab bar on the
 * first screen of «Главная», «Деньги» and «Дела», like the message field of
 * a chat, and rises with the keyboard. Screens get room for it via --dock.
 */
export function SmartDock() {
  const shown = useUI((s) => s.tab !== "more" && s.stacks[s.tab].length === 1 && s.sheets.length === 0);

  useEffect(() => {
    document.documentElement.style.setProperty("--dock", shown ? "62px" : "0px");
  }, [shown]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key="dock"
          className="pointer-events-none fixed inset-x-0 z-30 px-3 max-[389px]:px-2"
          style={{ bottom: "max(calc(var(--tabbar-space) + 8px), calc(var(--kb) + 8px))" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        >
          <div className="pointer-events-auto mx-auto max-w-[480px]">
            <SmartLine compact docked />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
