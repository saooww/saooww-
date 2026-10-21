import { haptic } from "../lib/haptics";
import { pickData, useData } from "./store";
import { nav } from "./ui";

/**
 * Runs a change and offers to take it back. The snapshot is just the
 * previous immutable state, so restoring it is exact and cheap.
 */
export function undoable(message: string, change: () => void) {
  const snapshot = pickData(useData.getState());
  change();
  nav.toast(message, {
    action: {
      label: "Отменить",
      run: () => {
        haptic();
        useData.getState().replaceAll(snapshot);
      }
    }
  });
}

export function confirmDelete(opts: { title: string; message?: string; confirmLabel?: string; onConfirm: () => void }) {
  nav.sheet("confirm", { title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? "Удалить", destructive: true, onConfirm: opts.onConfirm });
}
