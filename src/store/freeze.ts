import { createContext } from "react";

/**
 * Whether a screen is out of sight: on another tab, or covered by a screen
 * pushed on top of it. Data hooks inside a frozen screen hold still, so
 * typing in one place doesn't redraw every screen the app keeps alive.
 *
 * It is a tiny store rather than a plain value, so flipping it re-renders
 * nothing by itself: a screen that comes back redraws only the parts whose
 * data changed while it was away.
 */
export interface FreezeSwitch {
  readonly frozen: boolean;
  set(frozen: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createFreezeSwitch(initial = false): FreezeSwitch {
  let frozen = initial;
  const listeners = new Set<() => void>();
  return {
    get frozen() {
      return frozen;
    },
    set(next) {
      if (next === frozen) return;
      frozen = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/** Outside any screen (sheets, the tab bar) nothing is ever frozen. */
export const FreezeContext = createContext<FreezeSwitch>(createFreezeSwitch(false));
