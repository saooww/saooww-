import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/index.css";
import "./app/register";
import { App } from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { startBoot } from "./store/boot";

registerSW({ immediate: true });
startBoot();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
