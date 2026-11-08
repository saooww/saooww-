import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/index.css";
import { prefetchScreens } from "./app/register";
import { App } from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { startBoot } from "./store/boot";

// An installed app on iPhone can stay suspended for days; when it comes back
// after a while, ask for a newer version (it installs and reloads on its own).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 10 * 60_000) void registration.update().catch(() => {});
    });
  }
});
startBoot();

// Once the first screen is up, fetch the rest of the app in the background.
window.setTimeout(() => {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(prefetchScreens);
  else prefetchScreens();
}, 700);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
