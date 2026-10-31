# Current source verification, 25 October 2026

The source is frozen at `0ea5085e8446d42b9d0fafe13ddeaeb3e2bae94fef5abb999a13e0f10a01e3e3`, based on unchanged branch HEAD `5c26470ae8c8324af50424702b66aa9a0f6b7d37`. The full 182-command verification and 192 canonical-manifest revalidation are in progress. No current completion claim is made by the historical 24 October counts.

The final client change keeps the original React state, refs, effects and guard ordering in `useProvisionalPlayRecovery`. Existing pure journal helpers moved into `pendingGuessJournal`, and declaration types moved into a type-only module. The interim new-hook design was abandoned. Its source and results are historical only. The independent final source review is in `final-client-extraction-review.json`.

Current completed runtime evidence:

- `jest-domain-build.log`: final candidate passes the strict initial-resource budget; main chunk is seven bytes smaller than the held active build.
- `domain-recovery-units.log`: 47 recovery tests pass across five suites.
- `domain-continue-browser/browser-results.json`: all five silent compiled-browser cases pass.
- `portal-unit-results.json`: 321 suites and 3,354 tests pass; 19 opt-in suites and 129 tests remain skipped by their existing selection policy.
- `core-unit-results.json`: 40 suites and 436 tests pass.
- `matrix/`: fresh exact-command results and logs, each bound to source and artifact hashes. The final consolidated report will use the repository's existing evidence validator.
- `backend-new/`: focused backend units and real disposable-emulator integration results; the complete backend matrix continues separately.

`current-source-snapshot.json` records all 4,270 source path hashes. `source-delta.json` records the 105 actual changed paths from the retained 24 October snapshot, with symlink identities compared correctly. `matrix-plan.json` lists every retained command and its local-only category.

All automated browsers launch muted. The recorded preload installs the shared silent audio fixture and a zero-gain WebAudio sink before navigation, blocks external browser traffic, and caps concurrent browser commands at two. The local PWA verifier alone may use its required local service worker. The preload and runner are archived under `source-tools`.

`provider-preservation.json` is a fresh read-only Jest API readback. The user's active ready version remains `01a17226-db08-708f-86a1-6733b1fe4824` (`1.0.0-dev.20261025-review-complete`), with no published or in-review revision. Its local bytes were archived in `pre-matrix/manual-active-jest.tar.gz` before rebuilding local targets. The manual browser tab has not been touched. No review submission, activation or publication has been performed during this verification pass.

The interim README and static-only report, including the abandoned child-hook explanation and old `7f32...` digest, are archived in `historical/`. They do not describe the final candidate.
