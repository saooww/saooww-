---
name: financial-data-integrity
description: Use before any change that touches stored user data in ARDESSA — schema/type changes in src/store/types.ts, persistence (storage.ts), migrations (migrate.ts, boot.ts), import/export, undo, delete flows, PIN lock, or anything that could rewrite or drop transactions.
---

# Financial data integrity

## Facts
- Persisted with zustand `persist` (key `STORAGE_KEY`, `version: 1`) into IndexedDB via `src/store/storage.ts`; writes are throttled (`SAVE_EVERY`) and flushed on hide.
- On load `merge` fills missing settings with defaults; one-time setting migrations live in `src/store/boot.ts` (guarded flags such as `look`).
- Backup: JSON export/import (`exportJSON` / `parseImport`), automatic local backups (`autoBackup`, `listBackups`), import from the first app version via `migrateFromV1`.
- Undo: `undoable()` snapshots `pickData` and restores with `replaceAll`.
- PIN: SHA-256(salt:pin) in `src/features/lock/lock.ts` (local lock, not encryption).

## Procedure
1. `git status`; commit or stash first — a recovery checkpoint before any data change.
2. New fields are optional with a safe default; never rename or repurpose an existing field without a migration that keeps old data readable.
3. A migration is a pure function `old → new`, covered by a test with a frozen old payload; it never deletes records it does not understand.
4. Validate amounts (> 0, integer), wallet ids and dates at the store action, not only in the sheet.
5. Destructive actions go through `confirmDelete` + `undoable`.
6. Logs: no amounts, names or notes in `console.*`; `ErrorBoundary` logs only the error and component stack.
7. Run `npm test` (unit «сохранение: набор текста…») and e2e «изменения подряд и сразу перезапуск» plus the restart step of `e2e/journey.spec.ts`.

## Acceptance
- Old exports still import; a reload after the change shows the same balances.
- No silent rewrite of existing transactions; every bulk change is undoable or confirmed.
- Destructive migration only with a tested backup and a written rollback.
