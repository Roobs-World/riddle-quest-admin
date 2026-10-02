# Multiplayer draft write recovery

Verified 2026-10-01 against local production source. The hosted Jest E2E preview and its evidence file are untouched.

## Failure and change

The draft module memoized semantic content before persistence succeeded. Thrown quota failures and silently rejected writes therefore prevented an unchanged answer from being saved when write access recovered. Two regression cases failed against the prior implementation; 44 retained/additional cases passed. The injected production browser also failed using the saved prior draft module: after write access recovered, the PI draft remained absent.

Successful persistence is now memoized only after the serialized value is read back. Temporary failed writes and unavailable comparison reads retry at most once per second of the private monotonic clock. Live answer editing remains immediate. A different observed revision still blocks stale-tab replacement; retries cannot reclaim a newer tab's draft. New run bindings and disposal reset the retry clock. Successful unchanged drafts still avoid writes and expiry renewal.

## Verification

- Complete client suite: 1,586 tests across 179 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- Focused draft suite: 46 tests passed. New cases cover thrown and silent write recovery, bounded attempts, unchanged input restored after reload and a newer tab winning before a stale retry.
- Sixteen injected production RaceTo10Game browser scenarios passed: creator/challenger at 1280px and 390px, each with ordinary, denied-read, scheduled and temporary quota-failure storage. The new quota cases clear the failure without editing the answer again, verify PI and selected slot persistence, then reload and restore only after canonical server resume. No start, guess, hint or skip mutation was issued; no alerts or page errors occurred.
- All seven isolated configured target builds and exact dependency-evidence verification passed.
- Portal types, TSDoc, source size, security and scalability checks passed.

Logs, screenshots, prior module and source/artifact hashes are in `artifacts/race-draft-write-recovery/`. This client-only change does not require Functions deployment. Synthetic quota failures and Chromium mobile-sized viewports are injected harness evidence, not physical device evidence.

## Completion receipt

The focused proof is `artifacts/race-draft-write-recovery/verification-held.json`. It is not an accepted full-source dashboard receipt. The 37-check manifest `docs/development-tasks/race-draft-write-recovery.json` retains all previous multiplayer gates; its existing draft browser gate now includes four additional write-recovery scenarios. The source-stability guard remains unchanged. Run guarded completion after the other Jest E2E chat finishes changing source evidence. No Jest upload, activation or publication was performed in this batch.
