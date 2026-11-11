---
name: premium-app-design
description: Use for any visual or interaction change in ARDESSA — new screens, sheets, components, colours, typography, icons, motion. Preserves the approved black/red identity; do not use for logic-only changes.
---

# Premium app design (ARDESSA identity)

## Identity — keep
- Black canvas (`--bg`), panels `.panel` with warm red top edge (`--panel-edge`), tiles `.tile`; light theme mirrors it.
- Red hero (`BalanceHero`) with glossy light (`.hero-light`); glass strips inside it (`rgba(0,0,0,.28)` + blur).
- Semantic colours: expense red (accent), income green (`--positive`), transfer blue (`--transfer`), saving gold (`--saving`), warning amber, negative red. Same colour per kind everywhere (home actions, «Создать», composer).
- Figures: large sums `num-display` (Montserrat Bold via `--font-num-display`), list sums `.num` (system face, tabular). `Money` / `AnimatedMoney` only.
- Icons: Phosphor duotone via `src/ui/glyphs.tsx` (add in `scripts/glyphs.json` → `npm run glyphs`); neutral tiles tint the inner shape red; lit chips use `IconChip tone`.
- Motion: springs from `src/ui/motion.ts`, 150–400 ms, respect `reducedMotion`; no decorative loops.

## Procedure
1. Search `src/ui/` and the nearest feature for an existing component before writing a new one (`HeroCard`, `Group/Row`, `Chip`, `Segmented`, `Sheet`, `IconChip`, `ProgressBar`, `MoneyHeader`).
2. Use tokens and Tailwind classes from `tailwind.config.js` / `index.css`; no raw hex except brand gradients already in use.
3. Touch targets ≥ 44 px; text contrast ≥ 4.5:1 (secondary ≥ 3:1); every icon-only button has `aria-label`.
4. Check both themes, 375 px width and «Огромный» text (`data-text="xl"`).
5. Hand off to `app-visual-qa` for screenshots.

## Acceptance
- No generic template look: hierarchy is one big number + one action per block.
- Dark and light screenshots reviewed; no clipping at 375 px / xl text; approved screens unchanged unless requested.
