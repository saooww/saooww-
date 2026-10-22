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

const TABS: Tab[] = ["home", "wallets", "transactions", "analytics", "more"];

function resolveTheme(t: "dark" | "light" | "system"): "dark" | "light" {
  if (t !== "system") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function App() {
  const settings = useData((s) => s.settings);
  const tab = useUI((s) => s.tab);
  const today = useUI((s) => s.today);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(["home"]));
  const [systemTick, setSystemTick] = useState(0);

  // Formatting is read synchronously by formatters during render.
  setMoneyFormat(settings.numberFormat, settings.kopecks);
  setDateStyle(settings.dateStyle);
  setHapticsEnabled(settings.haptics);
  const formatKey = `${settings.numberFormat}-${settings.kopecks}-${settings.dateStyle}`;

  useEffect(() => {
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab]);

  /* theme */
  useEffect(() => {
    const t = resolveTheme(settings.theme);
    // Also on <body>: when the app is embedded, the host may set its own theme on <html>.
    document.documentElement.setAttribute("data-theme", t);
    document.body.setAttribute("data-theme", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#F3F1EC" : "#070708");
  }, [settings.theme, systemTick]);

  /* typeface for amounts */
  useEffect(() => {
    document.documentElement.setAttribute("data-num", settings.numberFont);
    document.body.setAttribute("data-num", settings.numberFont);
  }, [settings.numberFont]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => setSystemTick((n) => n + 1);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings.theme]);

  /* privacy on launch */
  const launched = useRef(false);
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    const st = useData.getState();
    if (st.settings.hideOnLaunch && !st.settings.hideAmounts) st.updateSettings({ hideAmounts: true });
    if (st.settings.autoBackup) autoBackup();
    // ?add=expense|income|transfer — for home-screen shortcuts and automations
    const add = new URLSearchParams(window.location.search).get("add");
    if (add === "expense" || add === "income" || add === "transfer") {
      window.history.replaceState(null, "", window.location.pathname);
      setTimeout(() => nav.sheet("composer", { kind: add }), 350);
    }
  }, []);

  /* the date can roll over while the app stays open */
  useEffect(() => {
    const tick = () => useUI.getState().setToday(todayKey());
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
    <MotionConfig reducedMotion={settings.animations ? "user" : "always"}>
      <div className="app-canvas fixed inset-0 overflow-hidden" key={formatKey}>
        {TABS.map((t) => (visited.has(t) ? <TabLayer key={t} tab={t} active={t === tab} /> : null))}
      </div>
      <TabBar />
      <SheetHost />
      <Toasts />
      <Splash />
    </MotionConfig>
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
