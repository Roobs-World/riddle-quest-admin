# Multiplayer search retry journal ownership

Verified 2026-10-01 against local production source. The ongoing hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

Matchmaking completion respected the shared journal, but starting a retained retry unconditionally wrote a fresh revision before calling the provider. This reclaimed another tab's newer selection, bypassed denied observation protection and resurrected a deliberately removed journal. Three public session cases reproduced these failures.

Discovery now distinguishes fresh player selection from retained search execution. A fresh findOpponent call may replace its selection; retries and restored search intents refresh only an observed journal they still own. The provider request remains usable in memory and same-intent retries retain their request ID. Existing completion guards continue protecting the journal after the provider settles. Matchmaking diagnostic translation moved into the existing session authority diagnostic module, keeping the session under its enforced size limit and preserving all existing keys and reason mappings.

## Verification

- Four new public session cases passed: retry with replacement, denied observation or deletion, and a fresh-search control verifying deliberate selection replacement. Three retry cases failed against prior source. Tests also assert request ID retention and the matched in-memory result.
- Two retained denied-journal browser scenarios and twelve startup recovery scenarios passed.
- Complete client suite: 1,615 tests in 184 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The new retry regression is exercised through the public session and injected provider/storage adapters. Browser checks are retained integration coverage, not direct reproduction of retry execution. Logs and source/artifact hashes are in `artifacts/race-search-retry-journal/`. No visible text, provider SDK or backend deployment changed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/common/development/development-tasks/race-search-retry-journal.json` retains earlier gates; its full client suite includes the new retry regressions. Guarded completion awaits the active hosted E2E chat finishing source evidence edits; the source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
