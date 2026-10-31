# Mobile and lifecycle E2E verification

This work serves the exact immutable Jest artifact. It does not rebuild it. Purchases use the injected mock provider; no real charges, account deletion, terms, SMS, or production writes occur.

## Original artifact findings

Artifact: `artifacts/jest-instructions-modal-2026-10-22/jest-artifact`, 419 files and 4,717,648 bytes. Content hashes remain unchanged after each run.

- The touch viewport soak passed 12 resize/dialog states across 320×568, 402×682, 390×844, and landscape 844×390. Help retained a 48px action. Modal focus stayed inside its dialog, gameplay did not consume dialog keys, and returning to play continued the retained draft.
- Offline Help preserved the `PI` draft and focus barrier through keyboard input and resize. Reconnect restored Help; closing and reloading retained the draft/cursor and allowed a `PIANO` win.
- Exhausted-attempt purchase recovery passed after correcting test assumptions. Five wrong guesses remained unchanged during the automatic +250 purchase fanfare. Input stayed blocked. Explicit 50-coin Continue admitted the sixth `PIANO` submission, and Next loaded a playable successor. The board intentionally resets its five visible rows after Continue.
- A real draft persistence race was reproduced: immediately reloading after visible `PIA` restored `PI` in three of six bounded plain/hinted observations. The last typed `A`, rather than the hinted `P`, was lost. Both new retained browser regressions fail on the original artifact. Evidence: `immediate-draft-reload.json`, `immediate-diagnostic-results.json`, and `immediate-reload-retained-red.log`.

The hint timing investigation also confirmed a mock authority limitation. `createFakeHostServices` constructs a fresh 300-coin profile on reload, so its wallet/index reset does not establish a production economy defect. Settled hint drafts restore all three letters, cursor position, and the locked hint. The final focused flow claims the paid Skip successor within one authority lifetime, without claiming durable server progress from that mock.

## Frozen fix

`useGameSessionPersistence.ts` now submits ordinary checkpoints in its existing layout commit, before paint, instead of a passive post-paint effect. Account generation, restoration order, speculative rollback, duplicate suppression, lifecycle listeners, and target write serialization are unchanged.

`queuedCoinActions.jest-playwright.test.ts` adds two retained browser cases for plain and hinted drafts. Each requires six consecutive immediate final-letter/reload transitions to retain `PIA`, the cursor, and the hint lock.

Changed-source checks pass: 65 checkpoint ownership browser checks; four focused unit suites with 66 tests; a fresh full portal unit run with 320 passing suites and 3,326 passing tests; production and focused test TypeScript; repository TSDoc; and whitespace checks. The full unit run skips 19 browser-gated suites and 129 tests. An independent read-only review found no actionable commit, restoration, account, or lifecycle regression. The new canonical artifact and its affected browser verification are pending root's rebuild.

The first-run failures and targeted diagnostic logs are retained. Test-only corrections addressed an obsolete `.modal-reward` selector, lowercase feedback DOM text, the intentionally fixed five-row board, and Playwright's stability wait on an animated control. Touch assertions now verify bounds and hit testing before sending a real center tap.
