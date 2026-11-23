# Post-submit draft recovery candidate rejected — 2026-10-09

A local post-submit marker fixed the ordinary held-reply reload case but could revive a consumed word after a storage failure. The candidate was removed from production source. The previous strict checkpoint reader and live UI were restored byte for byte, and a regression test now rejects the ambiguous recovery behavior.

## Candidate and counterexample

The candidate marked letters composed after a submitted guess and permitted exactly one accepted-guess count advance on the same owned question. Its normal paths passed 43 focused tests, 3,095 full client tests, 112 injected browser journeys / 688 assertions, and builds for all six isolated targets plus the Devvit server. Those green checks were insufficient to establish safe recovery.

The missing case is: an earlier command never reaches authority; independently composed complete input is checkpointed with the marker; another instance recovers and submits that word; clearing the checkpoint fails; the accepted count increases once. The old marker then appears to justify recovery even though the saved word was consumed by that replacement submission. A new test reproduced this: the candidate returned `zzzz` where it must return null. One failed, 24 passed in the candidate storage suite.

A local intent marker cannot identify which command caused the authoritative count increase. Correlating only the count therefore cannot satisfy both independent-input recovery and consumed-draft rejection under failed persistence. The candidate code, exact tested inputs, failure log, normal browser evidence and built artifacts are retained under `artifacts/live-post-submit-draft-2026-10-09` for review. No deployment occurred.

## Final worktree

The production helper and LiveRaceGame exactly match the preceding fully verified read-deduplication cohort, including its six isolated builds and 23 rendered checks. The only retained source change is the consumed-checkpoint regression test. No candidate UI behavior remains active. Final validation: 38 focused tests and 3,090 full client tests pass; types, TSDoc and file sizes pass. The full command skips the same 96 browser-gated tests; it is not presented as new rendered UI verification.

The candidate's 2,506 selected inputs stayed frozen through its build/browser cohort. Its three owned files were archived before the negative test and rollback. Final hashes confirm all other selected inputs are unchanged and production files match the prior verified version. All jobs completed. The rejected candidate's 1,299 built files and six dependency inventories were archived; only its owned temporary build root and inventories were removed. No Facebook browser fixture or new rendered-build cohort was run for the rejected candidate, and none is claimed.

Run `python3 artifacts/live-post-submit-draft-2026-10-09/verify.py` from the repository root. It distinguishes candidate evidence from final worktree evidence and checks the rollback, regression, final tests, archives and cleanup.

## Next required contract

Recovery across an accepted-attempt change needs server-confirmed identity of the particular accepted guess, not just local edit intent. A bounded viewer-private receipt identifier can correlate the pending guess with its accepted attempt without storing or replaying a command. Missing legacy receipt evidence must retain strict fallback behavior. The checkpoint must still bind account, seat, run, language, question and position, reject consumed data after failed saves, and preserve other writers. This is the next implementation direction; the original playability gap remains open.
