import { defineConfig } from "@playwright/test";

/**
 * Visual regression: the approved screens, rendered on a frozen clock
 * (11 Nov 2026, 14:00) from the demo data, compared pixel by pixel with
 * the references in e2e-visual/__screens__. Run locally on the machine the
 * references were made on — fonts render differently elsewhere.
 *   npm run visual          compare
 *   npm run visual:update   accept the current look as the new reference (only after approval)
 */
export default defineConfig({
  testDir: "e2e-visual",
  snapshotPathTemplate: "{testDir}/__screens__/{arg}{ext}",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.004, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: "http://localhost:4173",
    browserName: "chromium",
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    serviceWorkers: "block",
    reducedMotion: "reduce",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
    timeout: 180_000
  }
});
