# Receipt-bound live draft recovery — 9 October 2026

Independently typed cells now survive reload when a wrong guess was accepted but its reply was still pending. The checkpoint may carry only that original request's bounded receipt locator. On rejoin, an exact-count checkpoint restores locally as before. A checkpoint exactly one attempt behind the same account, ticket, run, locale, riddle and position requires authenticated proof for that exact original request. A boolean marker, matching word or matching count alone never authorizes recovery.

Only edits made after submission receive the locator; the submitted word itself is cleared and cannot become a replay instruction. Legacy records still recover at their exact count. Query/result parsing is strict. Missing capability, unavailable endpoint, unconfirmed or malformed proof, cancellation and the two-second read deadline drop ambiguous cells while retaining authoritative progress. No guess command is automatically replayed.

Initial proof resolves before the first recovered question becomes editable. Delivery identity, authoritative view and local draft identity are checked again afterward. Storage verifies the exact observed raw revision and invalidates pending proof after a changed save, restore or clear; a competing writer keeps its bytes. Retention is checked again after lookup. A normalized checkpoint uses the new canonical count and removes the old locator, preventing later attempts from borrowing historical proof. Semantic no-op saves still avoid all storage reads.

The failed-clear counterexample now passes: the original command never reached authority, a replacement submits the recovered full word, its cleared checkpoint cannot be written, and a second reload cannot revive that consumed word. The replacement's accepted receipt cannot satisfy the original request locator. Unit cases also cover successful migration followed by another failed clear, expiry during proof lookup and late acceptance after newer input.

## Verification

- All 3,118 client cases in 307 passing suites and 1,769 backend cases in 141 suites pass. The client suite contains 22 new receipt-recovery cases; the focused draft selection passes 60 cases. Browser suites are separately enabled below.
- Client type checks, TSDoc and file-size audits pass.
- New injected journeys: 88 across Chromium 153 and Firefox 153, development/production, narrow/wide layouts; 704 assertions cover held accepted-wrong recovery, hints, skips, missing/unconfirmed/malformed/stalled lookup, competing writers, close, account replacement and consumed-word failed clears.
- Existing injected reload, stale-authority, writer collision, unavailable-storage and poll-work safeguards: another 88 journeys and 520 assertions pass. Total: 176 journeys and 1,224 assertions. Unchanged checkpoint polling still performs zero storage reads.
- Active Firefox MCP 157 production fixture: the checkpoint binds count one and the exact pending request while authority has accepted count two. Reload performs exactly one receipt lookup, restores TE, normalizes to count two and removes the locator. No guess replay, browser error or unhandled rejection occurs. The initial MCP attempt had already reconciled through the normal command retry and was not counted as proof-assisted recovery; a persistent reply hold then established the intended boundary. Both owned tabs and their fake checkpoints were cleaned up; the user's original tab was untouched.
- All six isolated target builds plus Devvit pass; 22 hosted injected browser cases and the separate Facebook 13+ journey pass.
- The final selected-input before/terminal/verified manifests match 2,524 files. This is not an exhaustive inventory of content/public files. Relative to the preceding adapter cohort, the source delta is exactly LiveRaceGame, the checkpoint/storage helpers and the new test file. Backend, core and adapter source is unchanged; its prior 81 real Firestore SDK cases remain separate evidence in `docs/common/hosted/evidence/live-guess-receipt-adapters-2026-10-09.md`, not a new SDK run claimed here.
- Archived output includes 1,299 built files and seven dependency inventories. Owned build and browser fixture roots are absent; the native Firefox fixture's port was checked closed from the host namespace after its process exited successfully.

The browser multiplayer authority is an injected fixture, not a production Firebase server. The real SDK evidence separately verifies private proof creation and signed authenticated lookup. No cloud latency improvement or deployment is claimed. No visible text was added, and all isolated artifact checks preserve provider boundaries.

This completes the local implementation of [ADR 0006](../../architecture/adr/0006-live-guess-receipt-recovery.md). The wider reliability, performance, playability and latency goal remains active.

Evidence: `artifacts/live-guess-draft-receipt-recovery-2026-10-09/`; verify with `python3 artifacts/live-guess-draft-receipt-recovery-2026-10-09/verify.py`.
