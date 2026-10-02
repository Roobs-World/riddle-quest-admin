# Multiplayer matchmaking completion journal ownership

Verified 2026-10-01 against local production source. The hosted Jest E2E preview and evidence file remain untouched.

## Failure and change

A provider discovery request writes its recovery journal before calling the provider. Its later matched, empty or failed result then wrote a fresh journal unconditionally, replacing a newer selection made in another tab. Three public session regression cases reproduced this for all three result types.

Completion journal writes now inspect the current validated selection and preserve a different revision. The original tab still presents its own match, empty result or failure; declining the optional journal write does not reject a valid provider result. The observed prior revision remains the cleanup expectation, so closing the old tab cannot delete the newer journal. The observation also retains the original account lifetime across synchronous callbacks. Explicit initial selection writes keep their existing behavior.

## Verification

- Three new public session cases passed, checking another tab's challenge journal survives matched, empty and failed completion and subsequent close. All three failed against saved prior source.
- Complete client suite: 1,607 tests in 182 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Twelve retained startup recovery and two unavailable resume observation browser scenarios passed.
- All seven isolated target builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

This completion race is verified through the public session and injected provider/storage adapters. The retained browser checks cover integration regressions; they do not directly reproduce the competing provider completion. Logs and source/artifact hashes are in `artifacts/race-search-journal-ownership/`. This client-only fix needs no Firebase deployment and adds no visible text. Unavailable recovery-journal observations and explicit retry write ownership remain audit topics; this change does not claim to resolve them.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 44-check manifest `docs/development-tasks/race-search-journal-ownership.json` retains previous gates; its complete client suite includes the new regression cases. Guarded completion awaits the ongoing hosted E2E chat finishing source evidence edits. The source-stability guard remains unchanged. No Jest upload, activation or publication was performed. The multiplayer reliability audit remains active.
