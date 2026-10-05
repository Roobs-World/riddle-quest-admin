# Live stream watchdog recovery — 5 October 2026

The Firebase live race observer now retires and retries a connection that stops returning headers, heartbeat chunks, or its final response. The existing 15-second deadline now bounds the whole connection. Healthy streams keep the same revision deduplication, normal renewal, and retry backoff. An old queued deadline cannot cancel a newer heartbeat, and a retired connection cannot notify its former player.

## Reproduction and diagnosis

The installed Firebase SDK exposes both a chunk iterator and a final `data` promise. A response containing a valid notification followed by EOF without a final result frame ends the iterator while leaving `data` pending. The previous observer demoted health after 15 seconds but waited forever for that final promise; it never renewed the stream. Foreground reconciliation remained on its 500 ms fallback indefinitely.

The regression uses the installed SDK parser with intercepted fetch, a dummy app, and no real requests. The original fails twice at the expected second SDK connection. A complete result frame is the passing control. Expanded tests also reproduce pending headers and a stalled iterator. Racing only the final promise fixes the EOF case but leaves the earlier waits pinned (four failures); racing the whole connection fixes them. A separate test dispatches a previously queued deadline after a newer heartbeat; that failed until deadline generation ownership was added.

The fix owns a separate AbortController per connection and races the whole SDK consumption against a local cancellation promise. Its deadline begins before setup and renews on each received heartbeat. Timeout aborts that SDK attempt and releases the local wait even when a fixture ignores cancellation. Global retirement aborts the current attempt and retry. Late SDK channels have handlers and ownership guards; status callbacks that synchronously retire the observer cannot admit a change notification or a new timer.

## Verification

- All 14 focused unit tests pass, including actual SDK incomplete/complete response controls, pending headers, heartbeat expiry and extension, obsolete chunks, queued deadlines, and reentrant retirement.
- The frozen original fails 24 of 104 expanded browser assertions. The repaired harness passes 312 assertions in each React mode, covering six scenarios at three viewports (36 journeys). Related live signal failure tests add 132 passing assertions per mode: **888 final browser assertions**.
- The harness renders the actual LiveRaceGame, signal hook, polling policy, strict core schema, and native answer editor. It substitutes the SDK boundary and authority fixture. Pending explicit answers remain admitted during reconnect; drafts do not resubmit or displace the held command. Parent renders do not renew healthy subscriptions. Retirement admits no late notifications and leaves once.
- Firefox recorded the original stream remaining open and unhealthy versus the repaired stream aborting and renewing, with health restored and polling returning from 500 to 5,000 ms. Native typing displayed `piano`; Enter produced exactly one confirmed answer. Retirement stopped stream/status/change activity with all signals aborted and no errors or unhandled rejections.
- Full portal suite: **2,769 tests / 298 suites pass** (93 tests / 15 suites intentionally skipped). Types pass. TSDoc passes for 25,281 declarations across 1,141 files.
- All six isolated target builds and artifact audits pass. YouTube uses the fixture build; this is not release certification. Eight built-artifact browser tests across three suites pass; the existing latency threshold is unchanged.
- 1,507 selected source inputs were re-enumerated and hashed. No runtime source drift occurred. Three test documentation annotations were refined during verification; earlier and final snapshots differ only in this test file. Full gates passed afterward. An earlier confined run failed because the existing Reddit redirect suite needs a loopback listener; the approved loopback run passes. These failures are preserved in the evidence.
- 1,300 built files were copied and hash-compared before removing the private output. All owned jobs reached terminal results; temporary servers/caches and the two Firefox tabs were closed.

## Scope and reproduction

Production watchdog/backoff durations are unchanged. Browser fixtures shorten the deadline to 300 ms and base retry to 40 ms; unit tests exercise the real 15-second / 500 ms policy. These are recovery/ownership checks, not network latency benchmarks. No backend, scoring, account, provider contract, or visible text changed. The actual authenticated Firebase SDK remains the production transport. Isolated artifact audits continue to enforce target restrictions.

The new verifier is registered for both React modes and in the main browser regression command:

```sh
pnpm --dir packages/portal test:live-signal-watchdog:browser
python3 artifacts/live-signal-watchdog-2026-10-05/report-generation.py
git apply --check --reverse artifacts/live-signal-watchdog-2026-10-05/own.diff
```

Machine-readable results, source/SDK fingerprints, comparison logs, screenshots, native Firefox records, exact owned diff, preserved builds, and cleanup accounting are under `artifacts/live-signal-watchdog-2026-10-05`. Early browser fixture helper failures are excluded and preserved separately. The broad improvement goal remains active.
