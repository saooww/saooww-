import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { setDateStyle, todayKey } from "./lib/dates";
import { setHapticsEnabled } from "./lib/haptics";
import { setMoneyFormat } from "./lib/money";
import { pluralN } from "./lib/dates";
import { autoBackup, useData } from "./store/store";
import { nav, useUI, type Tab } from "./store/ui";
import { StackView } from "./nav/StackView";
import { TabBar } from "./nav/TabBar";
import { SheetHost } from "./sheets/SheetHost";
import { Splash } from "./ui/Splash";
import { Toasts } from "./ui/Toasts";
import { LockLayer } from "./features/lock/LockScreen";
import { Onboarding } from "./features/onboarding/Onboarding";
import { refreshRatesIfStale } from "./lib/rates";
import { MonthStoryLayer } from "./features/story/MonthStory";

const TABS: Tab[] = ["home", "wallets", "transactions", "analytics", "more"];

function resolveTheme(t: "dark" | "light" | "system"): "dark" | "light" {
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Sets a data attribute on <html> and <body> (the host page may own <html> when embedded). */
function setRootAttr(name: string, value: string) {
  document.documentElement.setAttribute(name, value);
  document.body.setAttribute(name, value);
}

export function App() {
  const settings = useData((s) => s.settings);
  const booted = useUI((s) => s.booted);
  const onboarding = useUI((s) => s.onboarding);
  const [systemTick, setSystemTick] = useState(0);

  // Formatting is read synchronously by formatters during render.
  setMoneyFormat(settings.numberFormat, settings.kopecks);
  setDateStyle(settings.dateStyle);
  setHapticsEnabled(settings.haptics);
  const formatKey = `${settings.numberFormat}-${settings.kopecks}-${settings.dateStyle}`;

  /* theme, typefaces, accent, text size */
  useEffect(() => {
    const t = resolveTheme(settings.theme);
    setRootAttr("data-theme", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#F3F1EC" : "#070708");
  }, [settings.theme, systemTick]);

  useEffect(() => {
    setRootAttr("data-num", settings.numberFont);
    setRootAttr("data-accent", settings.accent);
    setRootAttr("data-text", settings.textSize);
  }, [settings.numberFont, settings.accent, settings.textSize]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => setSystemTick((n) => n + 1);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings.theme]);

  // Saved data is still being read — the page background (set in index.html) shows.
  if (!booted) return null;

  return (
    <MotionConfig reducedMotion={settings.animations ? "user" : "always"}>
      {onboarding ? <Onboarding /> : <Main formatKey={formatKey} />}
      <Toasts />
    </MotionConfig>
  );
}

function Main({ formatKey }: { formatKey: string }) {
  const tab = useUI((s) => s.tab);
  const today = useUI((s) => s.today);
  const locked = useUI((s) => s.locked);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(["home"]));

  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  /* once per launch */
  const launched = useRef(false);
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    const st = useData.getState();
    if (st.settings.hideOnLaunch && !st.settings.hideAmounts) st.updateSettings({ hideAmounts: true });
    if (st.settings.autoBackup) void autoBackup();
  }, []);

  /* what opens first — after the lock screen, if there is one */
  const opened = useRef(false);
  useEffect(() => {
    if (locked || opened.current) return;
    opened.current = true;
    // ?add=expense|income|transfer — for home-screen shortcuts and automations
    const add = new URLSearchParams(window.location.search).get("add");
    if (add === "expense" || add === "income" || add === "transfer") {
      window.history.replaceState(null, "", window.location.pathname);
      setTimeout(() => nav.sheet("composer", { kind: add }), 350);
    } else if (useData.getState().settings.launchAction === "expense") {
      setTimeout(() => nav.sheet("composer", { kind: "expense" }), 120);
    }
  }, [locked]);

  /* lock again after time in the background */
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      const s = useData.getState().settings;
      if (!s.lockEnabled || !s.lockPinHash) return;
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        // Locking right away also hides balances from the app switcher snapshot.
        if (s.lockAfter === 0) useUI.setState({ locked: true });
      } else if (hiddenAt && Date.now() - hiddenAt >= s.lockAfter * 60_000) {
        useUI.setState({ locked: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* the date can roll over while the app stays open; rates refresh daily */
  useEffect(() => {
    const tick = () => {
      useUI.getState().setToday(todayKey());
      if (document.visibilityState === "visible") void refreshRatesIfStale();
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  /* regular payments that came due */
  useEffect(() => {
    const created = useData.getState().processRecurring(today);
    if (created.length) {
      nav.toast(`Записано ${pluralN(created.length, ["регулярная операция", "регулярные операции", "регулярных операций"])}`, { tone: "positive" });
    }
  }, [today]);

  /* keep sheets above the on-screen keyboard */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", `${kb > 80 ? kb : 0}px`);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <>
      <div className="app-canvas fixed inset-0 overflow-hidden" key={formatKey}>
        {TABS.map((t) => (visited.has(t) ? <TabLayer key={t} tab={t} active={t === tab} /> : null))}
      </div>
      <TabBar />
      <SheetHost />
      <MonthStoryLayer />
      <Splash />
      <LockLayer />
    </>
  );
}

function TabLayer({ tab, active }: { tab: Tab; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [active]);
  return (
    <motion.div
      ref={ref}
      className="absolute inset-0"
      aria-hidden={!active}
      initial={{ opacity: 0, y: 8 }}
      animate={active ? { opacity: 1, y: 0, visibility: "visible" } : { opacity: 0, y: 0, transitionEnd: { visibility: "hidden" } }}
      transition={{ duration: active ? 0.24 : 0.12, ease: [0.22, 1, 0.36, 1] }}
      style={{ zIndex: active ? 2 : 1, pointerEvents: active ? "auto" : "none" }}
    >
      <StackView tab={tab} active={active} />
    </motion.div>
  );
}
