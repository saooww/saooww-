# ARDESSA — finance & planner PWA

React 18 + TypeScript (strict) + Vite 5 + Tailwind 3 + framer-motion + zustand (persisted to IndexedDB) + vite-plugin-pwa.
Not native, not React Native: it runs in the browser and installs as a PWA. Language of the UI: Russian source strings, 10 locales.

## Map
- `src/lib/` — pure logic, no React: `finance.ts` (balances, net worth, ledger), `analytics.ts` (forecasts), `plans.ts`, `debts.ts`, `goals.ts`, `recurrence.ts`, `money.ts` (minor units), `dates.ts` (local day keys).
- `src/store/` — `store.ts` (all mutations), `types.ts`, `seed.ts` (demo), `storage.ts` (persistence), `migrate.ts`, `boot.ts` (one-time settings migrations).
- `src/features/<area>/` — screens and sheets; `src/ui/` — shared components; `src/charts/`; `src/styles/index.css` — tokens.
- Routes and sheets are registered lazily in `src/app/register.tsx`.

## Rules
- Money is integer minor units (`Minor`). Never floats for amounts; convert only through `toBase`.
- Every balance derives from `openingBalance` + transactions (`walletEffects`). Never store a balance.
- All state changes go through store actions; screens never write data directly.
- Forecast numbers come from `src/lib/analytics.ts` only (`capitalForecast`, `freeCash`, `monthForecast`, `scheduledBetween`).
- Texts: `tr("Русский текст {0}")`; plurals `pluralN(n, [a, b, c])`. After adding texts: `node scripts/i18n-extract.cjs`, add lines to `scripts/i18n/<lang>.NN.txt`, `node scripts/i18n-build.cjs`.
- Design: keep the approved black/red identity (see the `premium-app-design` skill). Do not redesign approved screens without the owner's request.
- Never change real user data silently; demo data lives only in `seed.ts`.

## Commands
- `npm run typecheck` · `npm test` (logic + finance suites) · `npm run build`
- `npm run e2e` — Playwright journeys against the production build
- `npm run visual` — screenshot comparison with `e2e-visual/__screens__` (local only; `visual:update` only after approval)
- In the cloud container add `launchOptions.executablePath: "/opt/pw-browsers/chromium"` via a throwaway local config, or `PW_CHROMIUM=/opt/pw-browsers/chromium` for `visual`.

## Done means
Typecheck, `npm test`, build and the relevant e2e pass; UI changes are checked on real screenshots in both themes; the report names what was and was not verified. Known defects are listed in `tests/finance.test.ts` under `known()`.

## Skills in this repo
`finance-engine`, `financial-data-integrity`, `analytics-and-forecast`, `premium-app-design`, `app-visual-qa` — in `.claude/skills/`.
