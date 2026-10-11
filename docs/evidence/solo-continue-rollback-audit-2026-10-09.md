# Continue rejection freshness audit — 2026-10-09

The current reducer restores the saved pre-Continue presentation whenever a rejected pending coin spend carries a Continue checkpoint and its session token still matches. That predicate does not account for newer host hints, a now-confirmed Continue grant or terminal outcome, or a player-owned utility page opened after the preview.

A diagnostic using the actual reducer reproduces five failures and one passing ordinary-rejection control:

1. Start a pending Continue, load the same host question with a newly purchased second hint, then reject the original request. The new hint index remains locked, but its glyph and keyboard knowledge disappear because the saved checkpoint replaces current letters and feedback.
2. Load the same question with a host-confirmed Continue grant, then reject the old local preview. The reducer clears the confirmed grant and reopens Continue.
3. Load complete six-attempt history proving a win, then reject the old preview. The rollback replaces the confirmed outcome and attempt count with the prior nonterminal checkpoint.
4. Repeat with a complete six-attempt history proving final loss. The confirmed loss is likewise replaced.
5. Open Shop during the pending Continue, then reject. The saved Continue dialog closes the player-owned utility page.
6. Without any intervening host or utility update, ordinary rejection correctly restores the exhausted round, prior balance and clears the pending request.

Evidence: `artifacts/solo-continue-rollback-audit-2026-10-09/diagnostic.test.tsx`, `diagnostic.log` and `results.json`. The diagnostic supplies real complete terminal feedback and asserts the loaded terminal outcome before testing rejection; the failed expectation is actual rollback behavior rather than an invalid authority fixture.

The hook's paid-result handler does dispatch this reducer action for matching nonretryable spend rejection, and queued-play rollback also dispatches it. The diagnostic establishes reducer behavior; timing through the full router/effect lifecycle still needs injected browser verification with the fix.

Next implementation: restrict rollback to the original, still-unconfirmed Continue state; preserve newer host-confirmed grant/outcome state; reconcile authoritative hint glyphs and keyboard feedback when restoring an older round; preserve utility modal ownership. Retain the ordinary rejection control and exact receipt correlation. Current balance recovery semantics need deliberate separation from gameplay freshness, because rollback currently refunds the saved local charge; do not infer a new balance policy from these gameplay tests.

No production changes in this audit. All 2,548 selected source/configuration inputs still match the preceding verified cohort. The existing verified build/test evidence remains under `artifacts/solo-continue-draft-fix-2026-10-09/`. No deployment or publication occurred. The broader goal remains active, and the five failing freshness cases remain unresolved.
