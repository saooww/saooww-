---
name: analytics-and-forecast
description: Use when adding or changing any number that looks ahead or summarises — month-end forecast, «можно потратить сегодня», «свободно к …», budgets, analytics charts, goal pace, assistant answers. Triggers on src/lib/analytics.ts, safeToSpend.ts, insights.ts, goals.ts, assistant.ts and screens that show forecasts.
---

# Analytics and forecast

## One engine
- `scheduledBetween(data, from, to)` — known future payments/income (recurring, plans by what is left, debts due).
- `monthForecast` — everyday spending rate (60-day and month blend, regular payments excluded) and month projection.
- `capitalForecast` — accounts at month end: `end = now + incomeLeft − obligations − everyday`; `path` ends exactly at `end`.
- `freeCash` — the same for everyday wallets only (Plans screen, daily budget).
- `safeToSpend` — today's allowance. Goal pace: `goalPace`, `goalHistory`.
Screens must call these; never re-sum transactions in a component.

## Procedure
1. Express the number as a formula of existing engine outputs; if a new term is needed, add it to `src/lib/analytics.ts` with a doc comment.
2. Add a scenario to `tests/finance.test.ts`: the formula holds, the path ends at the total, and screens that show the same quantity agree.
3. Show the breakdown in the UI (as the forecast sheet does) so the number is explainable.
4. Check month boundaries (last day, February, leap year) and `today` passed in, never `new Date()` inside the helper.

## Acceptance
- Same input → same number on every screen; differences between `capitalForecast` and `freeCash` are only their documented scope (all wallets vs everyday wallets).
- Known gap: plans dated today/overdue are counted by `capitalForecast` but not by `freeCash` (see `known()` in tests) — fix both or neither.
- Forecast tests pass; no float drift (all values integers).
