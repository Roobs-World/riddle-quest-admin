# Repeated question delivery — 5 October 2026

Repeated ready signals and repeated `host:riddleLoaded` results rebuilt an unchanged single-player board. The checkpoint layer then restored the player's draft. A final-draft-only probe passed 14 checks and missed that cycle. Observing the actual board DOM exposed removal of `P`, a commit with an empty row, and restoration of `P`.

The reduced reproduction simply replayed the captured question result through the real game bridge after native keyboard input. It failed 1 of 8 assertions. The final original-source matrix failed 18 of 258 assertions. The fixed development and production matrices passed all 516 assertions, with no draft-row mutations for unchanged ordinary deliveries.

## Change

The real game message router opts ordinary question results into preservation of unchanged issued state. Explicit `reconcile-` replies retain the existing authoritative rebuild behavior.

The reducer compares the session and riddle identities, mode, index, text, answer width, local evaluation metadata, attempt/Continue state, paid hint locks, and complete accepted feedback. Missing and empty optional lists are equivalent; hint order is irrelevant. Changed content or authority state takes the normal load path. Unchanged content retains the current letters, selection, guesses, pending operation snapshots, and checkpoint ownership. Profile refreshes still apply through the existing pending-coin guard, and the delivered mode remains authoritative.

A control found that the first prototype retained a temporary Daily mode when an unchanged Classic reply followed Daily initialization. That edge case was corrected, verified through the real router and native Firefox, and followed by a fresh source capture and complete verification. Earlier build logs and observations are labeled `pre-mode-control`.

No visible product text or locales changed. Provider capabilities, bridge protocol, commerce grants, and deployments are unchanged. Existing work in the shared checkout is preserved.

## Reproduction and controls

```sh
pnpm --dir packages/portal exec node scripts/verify-repeated-question-delivery-browser.mjs
```

Use `QUESTION_REPEAT_QUICK=1 QUESTION_REPEAT_SCENARIOS=riddle-only` for the minimal loop. `QUESTION_REPEAT_BASELINE_DIR` substitutes the captured original reducer/router from `artifacts/repeated-question-delivery-2026-10-05`; `QUESTION_REPEAT_REPORT_DIR` selects a separate output directory. The final baseline comparison uses the same final fixture and the remaining current source.

The fixture runs actual PlayHostApp, hosted session, schema routing, game message hook, reducer, native input, checkpoint restoration and board rendering with an injected provider. It covers duplicate ready, fresh ready, question-result replay, refreshed profiles, explicit reconciliation, changed hints, accepted progress, new sessions, a held native guess receipt, and Daily-to-Classic mode correction. Both React modes run in StrictMode at 390×568, 390×844 and 1280×844. External traffic is rejected.

The ranked explanations were redundant reducer rebuilding, host initialization resetting ownership, and checkpoint restoration causing the clear. The minimal replay excludes host initialization. Preserving identical ordinary issued state removes the immediate reducer reset and the DOM clear/restore cycle. Explicit reconciliation remains a positive control for rebuilding.

The unit regression sees the real parsed router/reducer load commit before checkpoint recovery can hide the reset. Controls also check pending guesses and paid balance projections, updated profile XP, content and evaluation changes, attempt/Continue changes, corrected accepted feedback, empty-list normalization, hint ordering, and mode correction. Fixture-development errors involving a selector, incomplete submitted guess, focused-button Enter delivery and lowercase feedback expectations are preserved separately from product findings.

These observations concern actual DOM/state commits. They do not establish that every intermediate clear was physically painted or quantify a live-provider latency reduction.

## Final verification

| Check | Result |
| --- | --- |
| Repeated-delivery browser matrix | 516 assertions passed; 60 separate diagnostic mutation traces |
| Related load ordering | 360 assertions passed |
| Related Classic preparation | 1,050 assertions passed |
| Related paid Skip/rollback | 840 assertions passed |
| Firefox native input | Four records passed: replay/profile, mode correction, reconciliation and changed hint |
| Focused router/reducer unit tests | 106 passed |
| Full portal unit tests | 2,849 passed in 300 suites; 93 browser-gated tests skipped in 15 suites |
| Types and TSDoc | Passed; 25,509 declarations across 1,144 files |
| Six isolated builds and artifact audits | Passed: Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo |
| Built browser checks | 8 tests in 3 suites passed; unchanged 100 ms buffered-transition assertion passed |
| Source capture | Same re-enumerated 1,514 selected inputs and SHA-256 hashes before/after final verification |
| Preserved final builds | 1,300 files; copied hashes match private outputs |

YouTube remains an incomplete-content fixture rather than a release certification. The tests use injected provider outcomes and preserve ordinary ready responses and authority loads; the improvement avoids redundant client board reconstruction and checkpoint restoration.

All owned processes reached terminal status. Both temporary build roots, twelve owned audit-metadata directories and two Firefox fixture caches were removed after required preservation. Owned Firefox tabs were closed; the pre-existing blank page remains. No verification process is still running.

Raw observations, mutation traces, logs, original/final captures, the owned diff, artifact hashes, native Firefox records, cleanup ledger and the machine-checked [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/repeated-question-delivery-2026-10-05/verification-summary.json) are preserved. The broader game-improvement goal remains active.
