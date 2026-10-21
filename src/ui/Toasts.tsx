import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useUI } from "../store/ui";
import { spring } from "./motion";

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  const sheetsOpen = useUI((s) => s.sheets.length > 0);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4"
      style={{ bottom: sheetsOpen ? "calc(var(--safe-bottom) + 16px)" : "calc(var(--tabbar-h) + var(--safe-bottom) + 12px)" }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.16 } }}
            transition={spring.snappy}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 30 && dismiss(t.id)}
            className="pointer-events-auto flex min-h-[48px] w-full max-w-[420px] items-center gap-3 rounded-lg bg-surface-3 py-2 pl-4 pr-2 shadow-pop"
          >
            {t.tone === "positive" && <CircleCheck size={18} className="shrink-0 text-positive" />}
            {t.tone === "warning" && <TriangleAlert size={18} className="shrink-0 text-warning" />}
            <span className="min-w-0 flex-1 text-callout text-ink">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
                className="h-9 shrink-0 rounded-sm px-3 text-callout font-semibold text-accent-ink active:opacity-60"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
