# Multiplayer unavailable search journal observation

Verified 2026-10-01 against local production source. The active hosted Jest pathway test and its source evidence remain untouched.

## Failure and change

Denied recovery-journal reads became null in the browser and optional adapter, so a matchmaking completion interpreted unknown ownership as an empty journal and wrote over another tab's selection. Three public session cases reproduced the failure for matched, empty and failed provider results.

Recovery reads now distinguish undefined for unavailable observations from null for a successfully observed absent/ineligible record. The optional wrapper retains this distinction on adapter exceptions. Matchmaking completion may refresh only the same observed journal revision. An unavailable, replaced or deliberately removed journal cannot authorize a completion write; the originating tab still receives its valid in-memory result. Explicit initial selection writes retain their behavior.

## Verification

- Four new public session cases passed: denied reads for matched, empty and failed completions, plus deliberate journal removal. Three denied-read cases failed against prior source.
- Two injected production browser scenarios passed at 1280px and 390px. Storage.getItem throws for the recovery key after another tab's selection is written; setItem remains usable. The original match is presented while the newer journal remains intact.
- Twelve retained startup recovery and two unavailable resume observation browser scenarios passed.
- Complete client suite: 1,611 tests in 183 runnable suites passed; 95 tests in 13 opt-in suites skipped.
- All seven isolated builds and exact dependency evidence verification passed.
- Portal types, TSDoc, file size, security and scalability checks passed.

The initial expanded condition exceeded the normalized session size limit by one line. Requiring the exact existing journal revision also resolves deliberate deletion recovery and simplifies that condition; the final size check passes. An older discovery fixture now retains its written journal so its completion account-switch checks operate on a realistic owned record. Browser recovery mocks observe the shared serialized snapshot through the strict observation adapter. Logs, saved prior modules, screenshots and source/build hashes are in `artifacts/race-search-journal-observation/`. No Firebase deployment or visible text change is needed.

## Completion receipt

`verification-held.json` records focused evidence, not an accepted full-source dashboard receipt. The 45-check manifest `docs/development-tasks/race-search-journal-observation.json` retains earlier gates and adds the denied journal browser check. Guarded completion awaits the ongoing hosted E2E chat finishing evidence edits; the source-stability guard remains unchanged. No Jest upload, activation or publication was performed. Explicit retry journal ownership remains an audit topic. The multiplayer reliability audit remains active.
