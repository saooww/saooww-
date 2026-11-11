---
name: app-visual-qa
description: Use after any UI change in ARDESSA and before reporting it done — renders the real app, compares screenshots with the approved references, and runs the interaction journeys. Also use when the owner asks «как выглядит» or reports a visual bug.
---

# App visual QA

## Tools (web/PWA)
- Playwright 1.65 with the preinstalled Chromium (`/opt/pw-browsers/chromium` in the cloud container).
- `npm run visual` — `e2e-visual/screens.spec.ts`, frozen clock 11 Nov 2026 14:00 MSK, demo data, 11 references in `e2e-visual/__screens__/`.
- `npm run e2e` — functional journeys incl. `e2e/journey.spec.ts` (account → income → expense → transfer → goal → debt → partial repayment → analytics → forecast → restart).

## Procedure
1. `npm run build`; for the cloud container run with `PW_CHROMIUM=/opt/pw-browsers/chromium`.
2. `npm run visual`. On a diff open `test-results/**/*-diff.png`: decide intended vs regression. Intended changes need the owner's approval, then `npm run visual:update` and commit the new references with the change.
3. For new screens add a case to `e2e-visual/screens.spec.ts` (fixed clock, no live rates).
4. Look at the screenshots yourself: spacing, alignment, clipping, scroll, typography, colours, both themes, 375 px + xl text (`e2e/app.spec.ts` checks tab labels at xl).
5. Run the relevant e2e; for rendering-heavy changes also check frame cost (no new infinite animations, blur only on small areas).

## Acceptance
- `npm run visual` green or every diff explained and approved.
- Journey e2e green; report lists screens not covered by references.
- References are made on the same machine/fonts; never update them to hide an unexplained diff.
