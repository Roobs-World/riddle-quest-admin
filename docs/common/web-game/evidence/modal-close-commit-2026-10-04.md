# Solo dialog dismissal follows committed UI

The normal game modal and the failed-surface recovery dialog published their native Escape callback refs during render. A suspended replacement could overwrite the ref while the original dialog remained visible. Escape then called the replacement callback. Recovery also published its `closeBlocked` flag during render, so Escape could bypass the disabled Close control of a still-visible pending dialog, or incorrectly block an available one.

Both refs now publish in `useLayoutEffect` with their complete callback/lock dependencies. The native listeners stay stable. Existing focus setup and return, inert priority, paid-action controls, and mandatory completion navigation retain their behavior. No visible copy or public props changed.

## Reproduction and diagnosis

The injected verifier imports the actual `GameModalView` and `GameSurfaceRecovery`, creates an ordinary React Suspense sibling, and drives native buttons and Escape. It neither substitutes those components nor changes their hooks. Fixture callbacks append Alice/Bob labels to an observation log; these are not real account identities. The fixture's only listener instrumentation counts document keydown registration/removal.

The minimal command was run twice before repair:

```sh
cd packages/portal
MODAL_CLOSE_QUICK=1 MODAL_CLOSE_SMOKE=1 MODAL_CLOSE_SCENARIOS=callback MODAL_CLOSE_SURFACES=recovery MODAL_CLOSE_REPORT_DIR=../../artifacts/modal-close-commit-2026-10-04/minimal-repeat node scripts/verify-modal-close-commit-browser.mjs
```

Both runs produced four observations and one failed assertion: the visible owner was Alice, but Escape called Bob. Omitting the replacement passed all four checks. Clicking the actual Close button instead of pressing Escape also passed all four. The full original run recorded 228 checks with 51 failed assertions, including downstream callback-history differences.

Ranked hypotheses, shown before repair:

1. Render publication overwrites the callback/lock ref. Moving publication to commit should fix it.
2. Suspension replaces the native listener. Registration/removal counts should change if this causes the failure.
3. Suspension replaces the visible dialog. Its DOM identity should change if this causes the failure.

Native Firefox established that the visible dialog and listener counts stayed unchanged while Escape called Bob. A second native Firefox journey established that the recovery Close button was still disabled while Escape nevertheless invoked Bob. These observations distinguish the first hypothesis from the other two.

The first repair changed only the recovery ref: its 44 quick checks passed while the unchanged normal modal still failed seven of its 32 checks. Applying committed publication to the normal modal removed the remaining failures.

## Verification

| Evidence | Result |
| --- | --- |
| Actual dialog harness, development React | 228 checks, zero failures |
| Actual dialog harness, production React | 228 checks, zero failures |
| Full game surface recovery, development React | 412 checks, zero failures |
| Full game surface recovery, production React | 412 checks, zero failures |
| Settings/help/profile focus-chain journeys | 18 passed |
| Portal unit suite | 2,756 tests in 297 suites passed |
| Built game browser suite | 37 tests in seven suites passed |
| Portal types and TSDoc | Passed; 25,275 declarations across 1,139 files |
| Six target builds and artifact audits | Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo passed |
| Source stability | All 766 recorded source inputs unchanged during verification |

The new harness covers suspended callbacks, suspended lock/unlock changes, abandoning and committing replacements, native Close agreement, 32 parent renders without listener churn, forward/reverse recovery Tab loops, inert recovery priority, dismissal focus return, and retired dialogs. It runs under StrictMode at 390×568, 390×844, and 1280×844. Its command is registered in `test:game-browser:playwright` and as `test:modal-close-commit:browser`, running both React modes.

The full game recovery verifier covers failed lazy downloads/rendering, draft preservation, offline overlay priority, held fifth-guess replies, paid Continue/Skip/Hint authority, and terminal Next readiness. Focus-chain checks cover page switches, repeated renders, and delayed question arrival. These are 1,280 recorded browser assertions plus 18 focus journeys; native Firefox observations and the built-game tests are tracked separately.

Fixed native Firefox journeys confirmed that suspended callbacks stay with Alice, locked recovery ignores Escape, a committed replacement switches ownership to Bob, committed unlocking permits dismissal, abandoned updates retain the same normal modal, and retiring it restores the original trigger without an additional Close call. Only this pass's three tabs and two fixture servers were closed. The existing blank Firefox tab remains; owned fixture directories and verifier processes are gone.

All evidence is in `artifacts/modal-close-commit-2026-10-04`, including before/after sources, the owned diff, original and one-variable observations, screenshots, native Firefox traces, gate/build logs, React review, source inventories, cleanup record, and `verification-summary.json`.

This is a verified reliability improvement within the continuing goal. It does not establish a new network-latency or hardware-performance benchmark, and the broader goal remains active.
