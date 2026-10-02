# Multiplayer observation latency — 2 October 2026

Follow-up: [multiplayer push implementation and backend deployment](multiplayer-push-latency-2026-10-02.md). That report supersedes the future-push discussion below and records the remaining client release boundary.

## Change

The live race client previously polled every 1,000 ms in every phase. A human opponent's accepted progress could therefore wait up to one second before the next request began, independently of backend processing time.

The client now uses one adaptive timer:

- Visible, active human PvP: one observation every 500 ms.
- Searching, countdown, bot play and hidden frames: the existing 1,000 ms interval.
- Result/cancelled journeys: stop scheduling observations.

`packages/portal/src/play/race/logic/liveRacePolling.ts` owns the cadence policy; `LiveRaceGame.tsx` schedules it. The existing delivery lock prevents concurrent background polls. Player commands still supersede a background observation immediately. Existing retry deadlines, outage backoff, receipt ownership, server validation and settlement remain in place.

For a healthy foreground race, the configured polling wait drops from at most approximately 1,000 ms to 500 ms. Assuming changes occur uniformly between polls, expected polling wait drops from approximately 500 ms to 250 ms. This is the polling component of latency, not an end-to-end production benchmark or a guarantee under browser throttling or network failure.

## Cost and deployment

Active foreground human races can make approximately twice as many background callable requests and database reads. Lobby/bot/background cadence and reserved-instance settings were not increased. No Firebase deployment or client publication was performed for this change. The earlier proposal to reserve additional solo instances remains declined and undeployed.

The previous production sample of European live updates measured 149 ms median / 225 ms p95 across 1,132 successful requests. That sample predates this client change, includes test traffic and measures server duration rather than opponent display latency. See `docs/evidence/game-latency-deployed-2026-10-02.md`.

Additional warm multiplayer instances would address startup delays during traffic bursts, rather than the fixed polling wait. Live join/update already had one minimum instance per region at the last deployment inspection. A future authenticated push transport could remove polling wait more directly, but would require implementation and production measurements. [Firebase minimum-instance guidance](https://firebase.google.com/docs/functions/manage-functions#keep_a_minimum_number_of_instances_warm), [Cloud Run WebSocket guidance](https://docs.cloud.google.com/run/docs/triggering/websockets).

## Verification

The enhanced injected two-player browser harness exercises the actual React race presentation and target-neutral transport at 1280 px and 390 px:

| Check | Desktop | Mobile |
| --- | ---: | ---: |
| Background observations in a 3.25-second active human race window | 6 | 6 |
| Observed intervals | approximately 500.3–500.5 ms | approximately 500.4 ms |
| Rival commit to observed counter update, one local sample | 212 ms | 363 ms |
| Guess completion with a background poll deliberately held open | 93 ms | 89 ms |

After releasing the held, obsolete poll, the accepted answer remained visible. The harness also passed lobby identities, countdown, rival progress, a single 50-coin victory grant, bot fallback, navigation and unavailable-capability behavior. All timing samples above use a local injected HTTP authority; they do not estimate production network or Firestore latency. Machine-readable results are in `artifacts/multiplayer-latency-2026-10-02/polling-latency.json`.

The same enhanced harness was run against the earlier candidate with the original one-second timer. It failed the foreground polling-rate assertion as expected, demonstrating that the new check distinguishes the old behavior. The temporary baseline verifier was removed from that owned worktree afterward.

Outage regression checks passed at both widths: polling backed off to three calls over the inspected outage window, answer drafting survived the outage and an online event immediately recovered delivery.

Portal types passed. The focused cadence/deadline tests passed 25 tests across two suites. The complete portal unit run passed 2,198 tests across 261 suites; 15 optional browser suites / 115 tests were skipped by the unit configuration. All six required isolated target builds and provider-boundary audits passed, together with the additional GameSnacks build. Locale checks passed for all 16 supported locales. No visible text or provider SDK was added.

Logs and desktop/mobile screenshots are under `artifacts/multiplayer-latency-2026-10-02/`. Shared-checkout backend/account-deletion, notification and presentation work was left intact. Concurrent changes after these checks require their own verification; this report does not claim the entire changing checkout is release-ready.
