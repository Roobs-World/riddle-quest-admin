# Mobile E2E repair and verification

The final canonical artifact is `artifacts/jest-e2e-2026-10-22/jest-artifact-journal`: 419 files, 4,718,293 bytes. Root's canonical manifest records 576,518 initial bytes. Both release budgets pass. The focused run checked every artifact file before and after and found no changed hashes.

## Defect and repair

A visible final draft letter could be lost on immediate reload: `PIA` returned as `PI`. The original artifact failed both new retained browser cases. The first candidate, which moved the ordinary SDK checkpoint effect into layout, also failed both cases and all six fresh immediate-reload observations. Its failure evidence remains in `../mobile/`, `../mobile-final/`, and `../browser-final/`.

The root cause was the asynchronous SDK write tail and Web Lock admission. Earlier checkpoint delivery alone did not provide synchronous unload durability. The final repair uses the existing account/generation/locale-scoped pending-play journal for confirmed drafts, with its existing validated reader, immutable predecessor comparison, lease ownership and cleanup. It adds no storage key or protocol and does not change SDK write ordering.

Recovery runs before journal capture in the layout commit. A new draft-only record cannot be seeded while `canRestoreCheckpoint` still permits a matching SDK startup restore. This preserves an SDK-only `PIA` draft when the fresh authority initially supplies only its confirmed `P` hint. Confirmed hints are retained in the existing riddle metadata. The reader drops malformed optional hints without discarding independently pending requests; current host hints and profile/coins remain authoritative. Draft-only terminal cleanup preserves unresolved guesses, paid actions and buffered successors. Empty drafts and cursor changes remain durable.

Hosted answer controls wait for the writer admitted by the current account scope and sender. Physical input, touch letters, answer slots and Submit share that boundary. Settings, Profile and Help remain available. The existing standalone path without a save adapter remains playable. The ineffective generic checkpoint timing change was reverted.

## Exact canonical results

`results.json` and `focused-mobile.log` record six passing focused journeys:

- Twelve resize/dialog states across 320×568, 402×682, 390×844 and 844×390, with modal focus/keyboard isolation and a preserved draft.
- Offline Help, keyboard suppression, resize, reconnect, draft/cursor reload and a resumed `PIANO` win.
- Confirmed hint lock/draft reload, then a single paid Skip to a playable `CLOCK` successor.
- Five exhausted guesses, a mock +250 purchase fanfare that admits no extra guess, an explicit 50-coin Continue, a winning sixth submission and playable Next.
- A deliberately delayed writer module blocks answer edits while Help remains usable; the first admitted draft survives immediate reload.
- No initial journal, a mock authority-issued `P` hint and SDK-only `PIA` checkpoint. The first journal seed is the full `PIA`, and subsequent reload preserves its lock and cursor.

Purchases and authority responses in these local journeys are injected mocks. No real charges or provider writes occur. The fake authority reconstructs its wallet/index on reload, so these checks do not claim durable production economy progress from the mock.

`settlement-targeted.log` records three passing exact-canonical Continue/hint recovery cases after a test-only correction. The first canonical journal retained run had 76 passes and these three obsolete assertion failures, preserved in `../browser-journal/`. The old assertions demanded that the entire journal namespace disappear, although confirmed drafts are now intentionally retained. The replacement assertions require an empty delivery queue, null coin action and null Skip preview, plus the exact current draft/cursor and confirmed hint/Continue state. Existing original request identity/count and duplicate-result checks remain; wallet and locked-letter checks are retained or strengthened. Platform owns the separate complete eight-suite/79-test rerun and navigation evidence.

## Source validation

The final full portal unit run passed 320 suites and 3,335 tests. It skipped 19 browser-gated suites and 129 tests. Nine new unit cases cover durable draft/empty input, terminal cleanup, unresolved deliveries, malformed optional hint data and SDK-only startup ordering. The 33 adapted existing paid/Skip/terminal fixture cases also pass. Their mock scheduler now simulates the committed recovery render after asynchronous writer readiness; assertions were preserved.

Production and all eight owned test files pass direct TypeScript checks. TSDoc and whitespace checks pass. The independent backend review found no actionable ownership, restoration or economy regression. Supplementary source-browser checks passed 56 lifetime cases/432 assertions and cold pending-hint/pending-guess recovery checks. Evidence is indexed in `../mobile-journal-proof/`.

## Owned files

Final runtime edits:

- `packages/portal/src/play/GameFrameApp.tsx`
- `packages/portal/src/play/GameFrameControls.tsx`
- `packages/portal/src/play/game/hooks/useProvisionalPlayRecovery.ts`
- `packages/portal/src/play/journalWriter.ts`
- `packages/portal/src/play/readPendingGuessJournal.ts`

Owned regression/fixture edits:

- `packages/portal/src/play/__tests__/queuedCoinActions.jest-playwright.test.ts`
- `packages/portal/src/play/__tests__/useProvisionalPlayRecovery.test.ts`
- `packages/portal/src/play/__tests__/journalWriter.test.ts`
- `packages/portal/src/play/__tests__/pendingGuessJournal.test.ts`
- `packages/portal/src/play/__tests__/terminalPaidReceiptPresentation.test.ts`
- `packages/portal/src/play/__tests__/terminalPaidLiveness.test.ts`
- `packages/portal/src/play/__tests__/skipPreviewOwnership.test.ts`
- `packages/portal/src/play/__tests__/skipSuccessorOwnership.test.ts`

`runtime-repair.diff` isolates the five runtime files by reversing only the known edits made in this E2E request, instead of using the repository's dirty Git baseline. The pre-request comparison is reconstructed from those edits; it is not a claim that the workspace originally matched Git HEAD. Earlier workspace changes are preserved. `useGameSessionPersistence.ts` has no final change from this request.
