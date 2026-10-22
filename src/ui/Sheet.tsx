import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { motion, useDragControls } from "framer-motion";
import { cn } from "../lib/cn";
import { useUI } from "../store/ui";
import { gpu, spring } from "./motion";

interface SheetCtx {
  id: string;
  /** 0 for the top sheet, 1 for the one beneath it… */
  depth: number;
  index: number;
  close: () => void;
}

export const SheetContext = createContext<SheetCtx>({ id: "", depth: 0, index: 0, close: () => {} });

export function useSheet() {
  return useContext(SheetContext);
}

export interface SheetProps {
  title?: ReactNode;
  /** Leading header control (e.g. "Отмена") */
  left?: ReactNode;
  /** Trailing header control (e.g. "Готово") */
  right?: ReactNode;
  children: ReactNode;
  /** Sticky footer, sits above the home indicator */
  footer?: ReactNode;
  ariaLabel?: string;
  /** Fill the available height */
  tall?: boolean;
  className?: string;
  contentClassName?: string;
  /** Close on backdrop tap / swipe down */
  dismissible?: boolean;
  onClose?: () => void;
}

/**
 * Bottom sheet: spring entrance, dimmed backdrop, swipe the header down to
 * dismiss. Content scrolls independently, so gestures never fight the list.
 */
export function Sheet({ title, left, right, children, footer, ariaLabel, tall, className, contentClassName, dismissible = true, onClose }: SheetProps) {
  const { close, depth, index } = useSheet();
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    onClose?.();
    close();
  };

  // Escape closes the top sheet, wherever focus happens to be.
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    if (depth !== 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [depth]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  return (
    <div className="fixed inset-0" style={{ zIndex: 60 + index * 2 }}>
      <motion.div
        className="absolute inset-0 bg-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: depth === 0 ? 1 : 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        onClick={() => dismissible && depth === 0 && dismiss()}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        tabIndex={-1}
        className={cn(
          "sheet-surface absolute inset-x-0 mx-auto flex max-w-[560px] flex-col overflow-hidden rounded-t-[30px] outline-none",
          tall && "h-[calc(100dvh-var(--safe-top)-12px)]",
          className
        )}
        style={{ bottom: "var(--kb)", maxHeight: "calc(100dvh - var(--safe-top) - 12px - var(--kb))" }}
        transformTemplate={gpu}
        initial={{ y: "100%" }}
        animate={{ y: 0, scale: depth === 0 ? 1 : 1 - 0.04 * depth, opacity: depth > 1 ? 0 : 1 }}
        exit={{ y: "100%", transition: { type: "spring", stiffness: 420, damping: 44, mass: 0.9 } }}
        transition={spring.sheet}
        drag={dismissible ? "y" : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) dismiss();
        }}
      >
        <div
          className="relative shrink-0 cursor-grab touch-none select-none"
          onPointerDown={(e) => dismissible && controls.start(e)}
        >
          <div className="mx-auto mt-2 h-[5px] w-10 rounded-full bg-ink-4" />
          {(title || left || right) && (
            <div className="relative flex h-12 items-center justify-between px-4">
              <div className="z-[1] flex min-w-[64px] items-center">{left}</div>
              {title && (
                <div className="pointer-events-none absolute inset-x-20 truncate text-center text-headline font-semibold">{title}</div>
              )}
              <div className="z-[1] flex min-w-[64px] items-center justify-end">{right}</div>
            </div>
          )}
          {!title && !left && !right && <div className="h-3" />}
        </div>
        <div className={cn("scroll-y min-h-0 flex-1", !footer && "pb-[calc(var(--safe-bottom)+16px)]", contentClassName)}>{children}</div>
        {footer && <div className="shrink-0 px-4 pb-[calc(var(--safe-bottom)+12px)] pt-3">{footer}</div>}
      </motion.div>
    </div>
  );
}

/** Text button for sheet headers */
export function SheetAction({ children, onClick, strong, disabled }: { children: ReactNode; onClick: () => void; strong?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("h-9 px-1 text-body transition-opacity active:opacity-50 disabled:opacity-30", strong ? "font-semibold text-accent-ink" : "text-ink-2")}
    >
      {children}
    </button>
  );
}

export function useCloseAll() {
  return () => useUI.setState({ sheets: [] });
}
