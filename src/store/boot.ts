import { nowISO } from "../lib/dates";
import { migrateFromV1, V1_KEY } from "./migrate";
import { prunePhotos } from "./photos";
import { hadStoredData, onStorageFailure, requestPersistence } from "./storage";
import { useData } from "./store";
import type { Settings } from "./types";
import { nav, useUI } from "./ui";

/** Small mirror of visual settings, read synchronously by index.html before first paint. */
export const PREFS_KEY = "kapital-prefs";

type Prefs = Pick<Settings, "theme" | "numberFont" | "accent" | "textSize">;

function writePrefs(s: Settings) {
  const prefs: Prefs = { theme: s.theme, numberFont: s.numberFont, accent: s.accent, textSize: s.textSize };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

let started = false;

/**
 * Runs once at startup. Saved data is read from IndexedDB asynchronously;
 * when it arrives we decide what the first screen is: the app, the lock
 * screen, or — on a first launch — the welcome flow.
 */
export function startBoot() {
  if (started) return;
  started = true;

  const finish = () => {
    let onboarding = false;
    if (!hadStoredData()) {
      let migrated = null;
      try {
        const v1 = localStorage.getItem(V1_KEY);
        migrated = v1 ? migrateFromV1(v1) : null;
      } catch {
        /* no legacy data */
      }
      if (migrated) useData.getState().replaceAll(migrated);
      else onboarding = true;
    }
    const s = useData.getState().settings;
    useUI.setState({ booted: true, onboarding, locked: !onboarding && s.lockEnabled && !!s.lockPinHash });

    writePrefs(s);
    useData.subscribe((state, prev) => {
      if (state.settings !== prev.settings) writePrefs(state.settings);
    });

    if (!onboarding) void requestPersistence();

    // Photos of operations that no longer exist (deleted, or a draft never saved).
    window.setTimeout(() => {
      const refs = new Set<string>();
      for (const t of useData.getState().transactions) for (const p of t.photos ?? []) refs.add(p);
      void prunePhotos(refs);
    }, 4000);
  };

  if (useData.persist.hasHydrated()) finish();
  else useData.persist.onFinishHydration(finish);

  let lastWarning = 0;
  onStorageFailure(() => {
    if (Date.now() - lastWarning < 60_000) return;
    lastWarning = Date.now();
    nav.toast("Не получилось сохранить изменения — на устройстве мало места. Сохраните копию в Файлы.", {
      tone: "warning",
      action: { label: "Копия", run: () => void import("../lib/backupFile").then((m) => m.saveBackupFile()) }
    });
  });
}

/** Finishes the welcome flow with the data the person chose. */
export function completeOnboarding(data: Parameters<ReturnType<typeof useData.getState>["replaceAll"]>[0]) {
  useData.getState().replaceAll({ ...data, meta: { ...data.meta, createdAt: data.meta.createdAt || nowISO() } });
  useUI.setState({ onboarding: false });
  void requestPersistence();
}
