# Referral reconciliation and hosted public-search transport

Read-only hosted observations are kept separate from local demo-emulator checks. No player identifiers, tokens, signed payloads, request bodies or production wallet documents were saved.

## Earlier Simulator referral warning

The observed warning was `2026-10-22T07:51:01.518Z`: verifyJestReferrals timed out. Cloud Logging identifies a CORS OPTIONS request at 07:50:46.575321Z with latency at least 15 seconds. A new instance started at 07:50:46.627638Z and its startup probe succeeded at 07:51:14.480710Z, approximately 27.85 seconds later. The client uses a 15 second transport deadline that includes preflight. The warning occurred 14.94 seconds after the OPTIONS request. There was no accompanying POST until 07:57:15.268728Z and no 4xx/5xx request in 07:45–08:00. This supports a cold-preflight timeout before the grant handler ran, rather than an invalid referral-token rejection.

A fresh hosted session later produced a cold OPTIONS at 20:26:43.054909Z, startup ready at 20:26:52.481786Z and POST at 20:26:52.813189Z; a second POST followed at 20:27:16.501650Z. No request in 20:20+ exceeded 15 seconds or returned 4xx/5xx in the queried window. No capacity, timeout or retry behavior was changed.

## Later reconciliation and durable rewards

`packages/portal/src/jest/sharing/useJestSharing.ts` calls listReferralsSigned and verifyReferrals on registered startup/remount and on transition to registered identity. Failure does not persist a consumed marker or advance a local conversion checkpoint. It has no same-session retry loop.

[Current Jest referrals documentation](https://docs.jest.com/sdk/html5/referrals), read through the Jest connector on 2026-10-22, defines listReferrals as retrieval of registered conversions and a signed snapshot, with no consume/acknowledge operation. The provider controls snapshot retention and attribution.

`jestReferralReceipts.ts` scans every signed eligible conversion, skips permanent deterministic inviter/invitee receipts and grants at most 20 new pairs per invocation. Later calls can pass the first 20 already-granted entries, including beyond 500 existing receipts. The latest-verification document is diagnostic metadata; it does not suppress old ungranted conversions.

`jestReferralGrant.ts` rereads candidate receipts and account-deletion boundaries inside a Firestore transaction. Both wallets and the receipt commit atomically. A failure before commit leaves the conversion eligible; a lost success response after commit cannot duplicate the reward. Local emulator verification checked a failed pre-commit attempt followed by success, and three concurrent replays after ignoring the first success response: one receipt and exactly one reward to each wallet. See referral-replay-emulator.log and verify-referral-replay.cjs. Focused selection/transport suites pass 49 + 13 tests.

A referral is not irreversibly consumed by an app timeout. Recovery requires another registered launch/remount and the provider continuing to list the conversion. The app cannot promise eventual delivery if the player never returns or the provider removes conversion history. A toast can be missed after a lost response even though the authoritative wallet already contains the reward.

## Hosted public-search transient error

Root observed a temporary error during initial public matching, then automatic recovery before the offered Retry could be clicked. joinLiveRace OPTIONS began 20:32:50.094747Z, instance ready 20:32:55.051736Z, POST 20:32:55.157442Z. The join 10 second budget was not exceeded by that cold start.

The first updateLiveRace OPTIONS began 20:32:56.437095Z; its instance became ready 20:33:03.465482Z, approximately 6.98 seconds after the start signal. First POST was 20:33:03.616131Z; regular polling followed. The background poll budget is 2 seconds in liveRaceDeliveryDeadline.ts, so this cold preflight plausibly explains the temporary UI warning. Cloud request logs show no 4xx/5xx in 20:32–20:35:30. This is recorded as a transient error followed by existing automatic recovery, not a clean first-attempt happy path or manual retry success. No timeout/capacity change was made.

Sanitized request classifications and startup timing are in hosted-cold-start-timings.json. Logs prove timing and request status classes; the browser was observed by root, so the poll-deadline cause is a correlation rather than a captured client stack trace.
