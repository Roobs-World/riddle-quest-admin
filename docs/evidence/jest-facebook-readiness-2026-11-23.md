# Jest and Facebook readiness, 2026-11-23

The source `012020b5d` CI run finished with failure in all four browser jobs.
Its workspace and backend jobs passed. Local checks confirm the follow-up
fixture fixes, but a complete CI run on the follow-up commit remains pending.
The fixes preserve production game logic and the assertions for receipts,
identity, timeouts, keyboard boundaries and rendering.

## CI scope and observed failures

[Production readiness run 45092990341](https://github.com/Grindhead/riddle-quest/actions/runs/45092990341)
checks source `012020b5d4ce570fc8041a9d1591b411f0020165`. Its Node 24 workspace job
passed the 3,990 scoped shared/web tests, audits, types, architecture checks and
Jest/Facebook builds. Its separate Node 22 Functions job passed all 3,277 backend
tests and its runtime, type, build and coverage gates.

The [workflow](../../.github/workflows/production-readiness.yml) retains 140
audited browser commands in four disjoint shards of 35, with `fail-fast: false`.
Unknown leaves fail closed. Provider-only checks outside Jest/Facebook are
excluded; mixed leaves retain their applicable shared/Jest/Facebook cases. HTML
validation, upload preflights and the development completion receipt still
require their actual successful gates.

The four browser failures were:

- Shard 1 passed its first 24 commands, then failed
  `test:modal-close-commit:browser` at
  `verify-modal-close-commit-browser.mjs:55`. The injected fixture toolbar
  intercepted an ordinary click on the settings dialog's **Close** button.
  The toolbar's empty background covered the control on the 390 × 568 viewport.
- Shard 2 failed `test:gameplay-receipts:browser` at
  `verify-firebase-gameplay-receipts-browser.mjs:203`: the generated Firebase stub
  lacked `getCurrentDailyChallenge`. Its collector recognized named imports, but
  the real adapter now forwards a namespace to the shared host implementation.
- Shard 3 failed `test:offline-keyboard-boundary:browser` at
  `verify-offline-keyboard-boundary-browser.mjs:48`, timing out after 30 seconds
  while waiting for draft `PI`. The fixture sent physical keys before initial
  journal-backed answer admission was ready.
- Shard 4 passed its full scoped E2E step, including the ten-minute mobile soak,
  but its repeated fresh-build Facebook upload preflight failed waiting for
  the `0:02.0` context standing. The fixture sampled its window endpoints
  independently. A one-millisecond boundary produced a `604800001` ms window,
  which the real response parser correctly rejected.

## Harness corrections and local proof

The Firebase fixture helper now discovers the actual runtime namespace through
TypeScript without executing Firebase, while preserving named aliases and
excluding type-only exports. Both affected collectors use it. Only Firebase IO
is injected; the real adapter orchestration and receipt/ownership assertions stay
in place.

Positive keyboard fixtures wait for an enabled, non-inert answer key before their
first physical input. The offline commitment event and all later negative checks
are unchanged. No forced input, assertion removal or timeout increase is used.

The modal-close fixture keeps its toolbar geometry and stacking order. Its
background is now transparent and ignores pointer events, while the six toolbar
buttons retain pointer events. Hit-testing confirms that every toolbar button
receives its own clicks and that the **Close** center reaches the modal control.
The original native click succeeds. No forced click or production CSS change is
used, and the full original matrices retain their assertions and timeouts.

The local live-render race reproduction exposed another stale instrumentation target:
instrumentation appended a wrapper to the portal `racePresentation.ts` forwarding
facade and called undefined `originalLetterStates`. It now wraps the shared
implementation through an exact alias and asserts one matching declaration.

Both immediate and held Facebook context responses now derive their seven-day
window from one clock read and the shared duration constant. Advancing-clock
regressions exercise the actual callable parser. The held response is now valid,
so its existing stale-context check proves ownership rejection rather than
malformed-response rejection. Production guards and UI expectations are unchanged.

These results distinguish original CI from local follow-up checks. They do not
substitute for a complete CI pass on the follow-up commit:

| Verification | Result |
| --- | --- |
| Scoped types | `pnpm check:types:jest-facebook` passed |
| Initial grouped browser command | Source `012020b5d` CI passed 8 suites, 36 tests and 380 route checks |
| Firebase fixture helper | 4 tests passed, including runtime/type-only re-exports and a module that throws if executed |
| Gameplay receipts | All original assertions passed at 1,280 px and 390 px in development and production |
| Shared Firebase race profile recovery | 110 checks per React mode |
| Full offline keyboard boundary | 1,719 checks per React mode |
| Live-render, scoped solo/race | 516 checks per React mode |
| Full modal-close matrix | 228 checks per React mode, plus all six toolbar hit-tests and a native modal Close click |
| Selected browser shard 1 follow-up | All 34 follow-up commands passed with exit code 0; the unchanged initial group of 8 suites passed in the original CI run |
| Full selected browser shard 2 | All 35 commands passed with the default matrices and React modes |
| Full selected browser shard 3 | All 35 commands passed with the default matrices and React modes |
| Full selected browser shard 4 | All 35 commands passed with exit code 0 and the default matrices and React modes |
| Facebook context fixture | Four advancing-clock cases and three existing parser tests passed; 50 complete context journeys and a fresh full upload preflight passed |
| Initial-input samples | Per mode: Classic preparation 15 checks, Facebook `auto` recovery 14, stable solo requests 12, static solo keyboard 11, solo hint recovery 12 scenarios |

Receipt/profile evidence is under `/tmp/rq-firebase-fixture-exports/`;
readiness logs use `/tmp/rq-answer-readiness-*`; live-render logs are
`/tmp/rq-live-render-fixed-{development,production}.log`. Modal-close proof uses
`/tmp/rq-modal-close-fixed-{development,production,inspect}.log` and before/after
screenshots under `/tmp/rq-modal-close-*.png`. These local files are
ephemeral. A complete scoped CI run on the follow-up commit remains pending;
local results do not substitute for all four browser shards and their subsequent
release checks.

## Recorded deployment baseline

The baseline upload receipt was updated at `2026-11-23T01:10:50.206Z`.
The earlier official Jest inventory observation recorded the English-only
`012020b5d` preview, version `1.0.0-dev.20261123011027.012020b5d4ce.ddabfe54`, ID
`01a205f4-903a-728a-bc6b-98acbc2da5d8`, as READY and inactive, with no processing
error. This records the baseline before the follow-up upload, not the status of a
later preview. [Exact preview](https://jest.com/g/riddle-q?versionId=01a205f4-903a-728a-bc6b-98acbc2da5d8).
The same baseline observation recorded the active October build
`1.0.0-dev.20261025-review-complete`, ID
`01a17226-db08-708f-86a1-6733b1fe4824`. These harness fixes have not activated,
published or submitted a game build, or deployed backend changes.

The worker's public health reports source `012020b5d`, HTTP 200, `configured`,
`workerEnabled: true` and `autoMergeEnabled: true`, following the owner's explicit
approval. Current deployment/base/ticket/exact-CI-head checks remain required.
An actual paid repair and Sentry-originated delivery have not been exercised;
game uploads and production backend deployment remain separate operations.
See the [Sentry worker runbook](../sentry-worker.md) for configuration, verified
webhook/poll behavior and operational limits.

## Natural scheduler execution

The deployed `dailyChallengeScheduler` is ACTIVE on Node 22, revision
`dailychallengescheduler-00056-kax`, serving 100% of traffic. Cloud Scheduler is
ENABLED with schedule `0,30 0,2,3,6-9 * * *`, timezone `UTC`, and a 900-second
attempt deadline. The natural 02:00 slot produced a Cloud Run request at
`2026-11-23T02:00:33.685347Z`: HTTP 200, latency `109.724781499s`.
Scheduler recorded `AttemptFinished` at `02:02:24.848790836Z`. No manual trigger
or configuration change was used. Its reported next slot was
`2026-11-23T02:30:01.678007Z`.

Two warnings rejected generated candidates during quality review; the invocation
completed successfully. The exact current revision returned no ERROR logs in
`2026-11-22T23:06:54Z` through `2026-11-23T02:05:06.185Z`. At the latter time,
Sentry's preceding-24-hour query for `runtime:firebase-functions` and that exact
revision returned zero matching issues. This is a bounded post-run observation,
subject to ingestion delay. The latest earlier failed request observed was HTTP
500 on old revision `dailychallengescheduler-00054-fix` at
`2026-11-22T09:00:27.151138Z`; it does not identify a failure of the current run.
