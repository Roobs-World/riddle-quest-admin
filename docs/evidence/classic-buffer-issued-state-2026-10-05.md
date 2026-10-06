# Classic buffer issuance state and failure settlement — 5 October 2026

The Classic buffer now builds its three future questions from the session state returned by the committed issuance transaction. It removes three follow-up document reads while retaining the current question's independent session read. Fresh and resumed future sessions use the same canonical binding, entitlement and expiry rules, and recovery fields come from the selected transaction attempt.

An internal issuance result carries the opaque token and canonical state. The existing token-only API remains available to current-question and daily callers. The transaction's final result is validated after commit; no result from an aborted attempt escapes. New private documents retain their existing schema and timestamps. The internal state is projected through the existing public response builder and is never added to the public payload.

The buffer also waits for every parallel issuance to settle before propagating a required failure. Previously, an early rejection could release the callable's account-operation lease while sibling transactions were still writing. The updated handler retains the lease through all sibling outcomes, then propagates failure. Successful responses retain catalog order and the existing three-successor limit.

## Matching reproduction

A deterministic fixture executes the real buffer, issuance implementation and response projection. Each persistence or catalog read takes 200 ms. Profile lookup, current-question reconciliation, account leases, HTTP transport and commit latency are outside this model.

| Future session state | Physical reads before | After | Modeled time before | After |
| --- | ---: | ---: | ---: | ---: |
| Fresh | 7 | 4 | 800 ms | 600 ms |
| Resumed | 10 | 7 | 1,000 ms | 800 ms |

The unchanged transaction reads total three for fresh issuance and six for resumed issuance. Direct reads fall from four to one: the current-question read remains. Both tightened timing assertions fail against the old implementation and pass against the final frozen source. These figures establish the removed read dependency, not a measured production speedup.

Nine tests use the actual Admin SDK, private loopback demo Firestore emulator, callable wrapper, account leases and response validation. Catalog selection and current-question reconciliation are fixture-controlled. Fresh and resumed requests observe one direct session read instead of four; persisted successor documents match returned tokens and expiries. Four concurrent buffers share canonical tokens and preserve account progress and economy. Other cases cover hint/attempt recovery, first-gap ordering, unavailable current content, corrupt bindings and failure settlement.

A retryable abort injected after a resumed issuance callback exercises the SDK's retry. The second attempt reads changed canonical hint and attempt state, which appears in the response. This tests fresh resumed state across retries; it does not claim coverage of rollback of newly queued session creation writes or natural production contention.

The lease-lifetime case injects one required failure and holds a sibling at its genuine transaction read. The old handler rejects and releases its lease early; the fixed handler remains pending with the lease active until the sibling settles. Fixture cleanup also waits for all original SDK transaction promises, including in the failing baseline. The matching old implementation fails three cases and passes six. Returning issuance state fixes the two read cases; waiting for all outcomes fixes the remaining lease case. All nine then pass.

## Verification

- **1,643 backend unit tests / 133 suites passed**.
- **288 Firestore/Realtime Database emulator tests / 19 suites passed**, including nine new buffer cases and existing multiplayer, completion, skip, deletion, supply and referral controls.
- **65 focused tests / four suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,852 declarations / 1,156 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,354 freshly enumerated source inputs** stayed unchanged through final verification, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 16 tracked jobs are terminal and owned emulators stopped.

Evidence is in `artifacts/classic-buffer-issued-state-2026-10-05/`. The initial old-source emulator probe was repeated after strengthening fixture lifetime cleanup; the matching baseline and intermediate failure are retained separately. No final gate failed. `report-generation.py` validates reproduction results, final timing traces, regression counts, source stability, preserved artifact hashes, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. The broader improvement goal remains active; no deployment was made.
