import { defineConfig } from "@playwright/test";

/**
 * End-to-end checks of the main flows in a phone-sized Chromium, against
 * the production build (`vite preview`), with a fresh profile per test.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ru-RU",
    serviceWorkers: "block",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
