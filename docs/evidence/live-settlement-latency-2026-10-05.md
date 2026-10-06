# Live match settlement latency — 5 October 2026

Human match settlement now reuses account-deletion snapshots within the current transaction attempt and reads the other winner's source ticket alongside participant accounts. Fresh rollout authorization, ticket ownership, both block lists, account existence, and deletion boundaries remain authoritative. Firestore retries recreate the snapshot map and repeat the deletion checks.

The production change is in `firebase-functions/src/race/raceLiveService.ts`. No client UI, provider adapter, locale, purchase, referral grant, or artifact contract changed.

| Result observer | Document reads before → after | Simulated time before → after |
| --- | --- | --- |
| Caller is winner | 10 → 8 | 800 → 800 ms |
| Other player is winner | 11 → 9 | 1,000 → 800 ms |
| Caller wins, transaction retries after rival deletion | 20 → 16 | 1,600 → 1,600 ms |
| Other player wins, transaction retries after rival deletion | 22 → 18 | 2,000 → 1,600 ms |

Each independent document read and the authorization fixture take 200 ms. These measurements exercise the actual service, scoring engine and public result projection with an injected transport. They measure database stages and document reads; they are not measurements of production network latency or transaction commit time. Ordinary polls and guesses retain their existing three-stage, 600 ms fixture result.

## Diagnosis and controls

The tested hypotheses were that the winner's ticket adds a separate read stage, settlement repeats deletion documents already read in the same attempt, and retaining snapshots across attempts would violate fresh deletion checks.

The first regression test failed against the original service because each participant's deletion document was read twice. Moving only the winner's ticket read made the other-player result take 800 ms while the duplicate-read assertions still failed. Reusing attempt-local snapshots then passed those assertions. The final matching baseline has four failing cases and preserves both timing and document-path traces. The fixed implementation passes all four cases, including a retry with a newly recorded rival tombstone, identity masking, no deleted-account grant, and no additional grant on a later result observation.

A broader emulator run exposed an existing incorrect expectation in the account-deletion concurrency test. The original service reproduced the same failure: expected 125 coins, observed 100. The deletion implementation explicitly cancels unfinished matches without awarding the surviving rival. The test assumed every draw had already awarded the debut badge.

`raceLiveAccountDeletion.it.test.ts` now checks four orderings: cleanup first leaves the survivor at 100 coins with no game increment; guard first allows the normal terminal draw settlement of 125 coins; completion first preserves the clean winner's 225 coins; the concurrent case must agree with the actual terminal settlement receipt. All cases verify statistics, the balance snapshot, the match reward and unchanged account data after four concurrent result replays. The cancellation policy is unchanged.

## Final verification

- Backend units: **1,586 tests / 129 suites passed**.
- Real loopback Firestore and Realtime Database emulators: **136 live tests / 7 suites passed**, including scoring, concurrent polls, rewards, invitations, rematches, push, signals, history and account deletion.
- Focused latency and authorization checks: **8 tests passed**, with explicit verbose output preserving all four timing traces.
- Backend TypeScript and targeted lint passed. The module-cycle preflight passed with 194 production modules and 1,101 runtime references.
- TSDoc: **25,555 declarations / 1,145 files passed**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification.**
- Built-client browser checks: **8 tests / 3 suites passed**. The buffered single-player transition threshold remains **100 ms**.
- A freshly enumerated set of **2,343 source inputs** remained unchanged across final gates, including backend sources, shared core build outputs and the backend's installed core package. All **1,300 build files** and six target dependency inventories were preserved with SHA-256 hashes.
- All 14 tracked process handles are terminal. The private build root and its six matching metadata records were removed; owned emulators shut down.

The first broad run is retained as preflight evidence: its documentation audit found five missing comments in the new test, and its deletion integration test exposed the original expectation failure. After correction, a new source snapshot and all final gates were run. The first and final built-browser runs passed; only the final frozen run supports the final result.

Evidence is in `artifacts/live-settlement-latency-2026-10-05/`. `report-generation.py` re-enumerates source inputs, verifies baseline/fixed traces, test counts, audits, build hashes, cleanup, and the reverse applicability of `owned.diff`, then writes `verification-summary.json`.

The overall improvement goal remains active. A later audit can check whether winner source-ticket reads are necessary for providers that do not use the Facebook destination context. A warm-instance ticket-to-match cache was considered during this pass but was not introduced: the ordinary poll path needs fresh canonical associations and privacy state, and a cache would add hit-rate and invalidation complexity without improving cold requests.
