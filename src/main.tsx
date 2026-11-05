import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/index.css";
import "./app/register";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
