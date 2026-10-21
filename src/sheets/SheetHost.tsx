import type { ComponentType } from "react";
import { AnimatePresence } from "framer-motion";
import { useUI } from "../store/ui";
import { SheetContext } from "../ui/Sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, ComponentType<any>> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSheets(map: Record<string, ComponentType<any>>) {
  Object.assign(REGISTRY, map);
}

export function SheetHost() {
  const sheets = useUI((s) => s.sheets);
  const close = useUI((s) => s.closeSheet);
  return (
    <AnimatePresence>
      {sheets.map((s, i) => {
        const C = REGISTRY[s.type];
        if (!C) return null;
        return (
          <SheetContext.Provider key={s.id} value={{ id: s.id, depth: sheets.length - 1 - i, index: i, close: () => close(s.id) }}>
            <C {...s.props} />
          </SheetContext.Provider>
        );
      })}
    </AnimatePresence>
  );
}
