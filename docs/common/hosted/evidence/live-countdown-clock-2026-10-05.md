# Live countdown animation ownership

Live multiplayer countdown animation now suspends while hidden, samples immediately on foreground return, and rejects callbacks from retired or cancelled timer generations. A completed countdown cannot keep sampling or request another progress read through an old callback. The existing server-time anchor, authority checks, background polling and transport ownership remain intact.

Evidence is preserved in `artifacts/live-countdown-clock-2026-10-05/`. `report-generation.py` validates observations, exact source captures, source inventory, artifact hashes, Firefox records and command registration before producing `verification-summary.json` and the scoped `own.diff`.

## Diagnosis

The first candidate was the recorded `useRaceSession` timer. Inspection of current consumers showed that hook is unused by the shipped UI. Its attempted UI fixture had no session snapshot; the exploratory harness was moved out of the production scripts directory into this evidence directory. **The unused hook was not changed.** The active client uses `LiveRaceGame`; its gameplay elapsed clock already handles visibility, but its countdown interval did not.

The corrected injected harness renders the actual `LiveRaceGame` in StrictMode. It uses `LiveRaceViewSchema`-validated mock authority snapshots, actual native intervals, the original countdown callback, and the real native answer editor. It records countdown sampling, native wakeups, live interval ownership and transport action names. Other timers, including the gameplay elapsed clock and the server poll scheduler, are excluded from its animation counter.

The fixture exposes controlled visibility through visible toolbar buttons and supplies a monotonic offset for boundary tests. Its extended mock countdown gives automation time to exercise lifecycle changes; advancing the offset crosses the authoritative start without waiting a minute. This is not a real background-tab throttle benchmark or a live matchmaking test. Retained interval callbacks simulate browser work already queued before cancellation. Background progress polling continues throughout these tests.

The minimal corrected command was:

```sh
LIVE_COUNTDOWN_QUICK=1 LIVE_COUNTDOWN_CASES=hidden \
LIVE_COUNTDOWN_REPORT_DIR="$PWD/artifacts/live-countdown-clock-2026-10-05/original-minimal" \
pnpm_config_verify_deps_before_run=false pnpm --dir packages/portal exec node \
  scripts/verify-live-countdown-clock-browser.mjs
```

It completed with 21 checks and nine failures. A repeat failed eight checks; both runs failed the same core assertions for hidden timer ownership, queued hidden sampling, native hidden wakeups/samples, immediate foreground sampling and finished callback sampling. Whether the extra-read control also failed depended on the existing delivery lock's timing. The original expanded five-journey run failed 46 of 109 checks.

Three predictions were tested sequentially: a hidden-state guard would stop samples but leave native wakeups; visibility-owned scheduling would stop wakeups but leave callbacks from earlier generations; a generation guard would prevent those earlier callbacks without changing clock anchoring. The results matched those predictions:

| Probe | Checks | Failed |
| --- | ---: | ---: |
| Original minimal | 21 | 9 |
| Original repeat | 21 | 8 |
| Original expanded | 109 | 46 |
| Captured original through final fixture | 118 | 47 |
| Hidden-state guard only | 109 | 38 |
| Visibility-owned scheduling | 109 | 5 |
| Current-generation guard | 109 | 0 |
| Complete probe with stronger controls | 118 | 0 |
| Final development | 354 | 0 |
| Final production | 354 | 0 |

The strengthened controls additionally check that countdown cannot start early and the resumed elapsed display matches the unchanged authoritative monotonic anchor. No clock-anchor fix was needed. The final verifier also runs against the captured original implementation as a red control; its observations are preserved separately under `original-final`.

## Change and coverage

The countdown effect owns a cancellable interval, a generation and a disposed flag. Visibility transitions invalidate queued work before clearing the old interval. Foreground return immediately samples the accepted server clock and creates an interval only if countdown remains in progress. Reaching the start boundary invalidates the current generation before requesting the authority's first prompt. Layout retirement's existing `active` guard prevents sampling before passive effect cleanup completes; disposed and generation guards distinguish retired effects from later active journeys.

The final matrix covers hiding an active countdown, mounting hidden, 16 hidden parent updates, repeated hide/show cycles and retirement. It checks initial and resumed timer ownership, queued callbacks, native hidden wakeups, no early start, no duplicate foreground timer, completed countdown reads, authoritative elapsed time, native answer drafting, idempotent explicit leave, and browser errors. All five journeys run at 390×568, 390×844 and 1280×844 in both React modes: 708 assertions across 30 journeys.

The established elapsed-clock browser matrix passed another 396 assertions across both React modes, including hidden answer drafts and native foreground submissions. The existing repeated-older-observation verifier also passed at 1280px and 390px: its real five-second countdown neither reset nor started early. Its source was captured with only fixture root/output paths changed so the evidence could be kept separate.

Six native Firefox records demonstrate the original hidden timer and its queued sample, the repaired hidden timer removal, only one current callback after foregrounding, no sampling or extra read from a completed countdown, the visible `te` answer draft without a guess submission, and retirement without queued samples or reads and exactly one leave. All records have zero page errors and unhandled rejections. A tile click was initially obscured by the fixture toolbar in Firefox's small viewport; the editor was then filled through its inspected native input UID, and the visible tiles confirmed the draft.

## Verification and limits

Portal verification passed 2,761 unit tests across 297 suites, type checks and the TSDoc audit (25,242 declarations across 1,140 files). The existing configuration skipped 15 suites and 93 tests. No additional unit test was added to mirror timer internals; the regression exercises the real UI callback chain.

All six isolated artifacts built and passed their audits: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. **YouTube used the fixture build, not release certification.** Eight hosted-gameplay, profile and Reddit browser tests passed against the exact new temporary artifacts in 85.983 seconds. Existing latency thresholds were unchanged.

The 1,505 selected source/build inputs were re-enumerated and hashed before and after verification with no changes. All 1,300 built files were preserved and compared by SHA-256 before removing the exact temporary output root. The private related-verifier cache was removed. The scoped reverse patch check and diff whitespace check passed. No adapters, provider boundaries, protocol schemas, locales, authority scoring or visible product copy were changed; unrelated shared-checkout work is excluded from the scoped diff.

Early fixture attempts are excluded from the result table: the unused recorded-hook probe, the initial timer marker, the input-value assertion for an editor that clears its proxy value, and mock snapshots with fractional timestamps rejected by the authority schema. The corrected fixture uses integer authority timestamps, inspects visible draft tiles and records countdown callbacks through their actual source marker. Those excluded attempts and all completed process handles are documented in the evidence directory and `cleanup.json`.

All verification jobs reached terminal status. Both Firefox fixture servers were intentionally stopped with SIGINT (outer handles reported 130); their exact caches were removed by fixture cleanup and no owned process remained. Both created tabs were closed, leaving the original blank tab.

This avoids measured animation work and removes the countdown's wait for its next 100 ms timer callback on foreground return. It does not claim a network speedup, change background reconciliation policy, or resolve the separate stressed buffered-transition timing investigation. The broad game-improvement goal remains active.
