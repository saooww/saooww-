---
name: finance-engine
description: Use when changing how money moves in ARDESSA — transactions, transfers, wallets, goals, debts, expected income (plans), recurring payments, currencies or net worth. Triggers on edits to src/lib/finance.ts, plans.ts, debts.ts, goals.ts, recurrence.ts, money.ts or money-related actions in src/store/store.ts.
---

# Finance engine

## Model (read before changing anything)
- Amounts: integer minor units. `parseAmount` / `amountToInput` for input, `formatMoney` for display, `toBase` (rounds once per record) for currency.
- Balance of a wallet = `openingBalance` + Σ `walletEffects(tx)`. Kinds: `income`, `expense`, `transfer` (with optional `toAmount` across currencies), `goal`, `debt`, `adjustment` (direction by `flow`).
- Only `income` / `expense` are flows (`isFlow`) — analytics never see transfers, goals or debts.
- Envelope goal: `kind: "goal"` records move money out of a wallet into the goal; linked goal (`walletId`): progress = that wallet's balance. Net worth counts each once.
- Debt: `addDebt` (optional opening record through a wallet), `payDebt` per loan; `debtPeople` groups loans by name+currency, `splitRepayment` pays the oldest first.
- Expected income/expense: `Plan`; parts received are transactions with `planId`; `planLeft` is what is still expected. `receivePlan` / `completePlan` / `setPlanStatus`.
- Recurring: `nextAfter` with `anchorDay` (31st → 28/29 Feb → 31st), `processRecurring(today)` catches up once.

## Procedure
1. Locate the action in `src/store/store.ts` and the pure helper in `src/lib/`. Change the pure helper first.
2. Write or extend a scenario in `tests/finance.test.ts` on the fixed book (fixed dates, no clock). State expected money by hand.
3. Check every consumer: balances, `netWorth`, `periodStats`, `debtPeople`, `capitalForecast`, `freeCash`.
4. Run `npm run typecheck && npm test`.

## Acceptance
- No float amounts introduced; all new numbers are integers in minor units.
- Transfers, goals and debts leave income/expense untouched; net worth changes only by real flows or forgiven debt.
- A received part is counted once: in the balance, not again as expected.
- New scenario test passes; existing `known()` entries are either still known or moved to `test()` when fixed.
