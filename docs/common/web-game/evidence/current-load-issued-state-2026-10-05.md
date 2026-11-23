# Current Classic and Daily load issuance state — 5 October 2026

Current Classic and Daily question loaders now build their response from the canonical state returned by the committed issuance transaction. Each ordinary load removes one follow-up private-session read. The terminal reconciliation paths also take both token and state from the new issuance after progress advances or a recorded loss rotates the entitlement, removing two follow-up reads on those paths. A completed Daily win returns completed progress without issuing another question.

The explicit client resume-token validation reads remain. Profile existence checks, regional Daily eligibility, locale selection, current Classic index checks, early pending-completion recovery, content availability and all completion/reward transactions retain their existing behavior. The state-returning issuance API introduced in the preceding buffer pass already validates its final committed result. This pass changes only four issuance call sites in `dailyChallenge.ts`, without adding public fields or changing private document schemas.

## Matching reproduction

Four deterministic cases execute the real current loaders, issuance callback and response projection. Each catalog or persistence read stage takes 200 ms. Profile lookup, early pending recovery, account leases, HTTP transport and transaction commit latency are outside the fixture.

| Loader | Issuance | Modeled time before | After | Session reads before | After |
| --- | --- | ---: | ---: | ---: | ---: |
| Classic | Fresh | 600 ms | 400 ms | 2 | 1 |
| Classic | Resumed | 800 ms | 600 ms | 3 | 2 |
| Daily | Fresh | 600 ms | 400 ms | 2 | 1 |
| Daily | Resumed | 800 ms | 600 ms | 3 | 2 |

Session read counts include binding/session transaction reads and the removed standalone session read. Fresh issuance keeps one transaction read; resumed issuance keeps two. Daily's separate dated content-document read is unchanged. Classic catalog delay is injected separately from document observation. All four tightened timing assertions fail against the old implementation and pass against the final frozen source. These figures show the removed read dependency, not measured production latency.

Fourteen cases use the actual Admin SDK, private loopback demo Firestore emulator, callable wrappers, account-operation leases and public validation. Fresh and resumed loads in both modes make zero standalone session reads, preserve the account and return identities matching persisted private sessions. Explicit resume requests retain one validation read and reject an unknown token with the existing `permission-denied` contract. Recovery cases project canonical hints and attempts.

Real accepted guesses establish wins; real declined-base-limit finalization establishes losses. These cases exercise actual post-issuance completion transactions, Classic progress advancement, completed Daily responses and loss-session rotation. Repeating a load preserves the settled account document and avoids a second reward. Early pending-completion and previous-day recovery are isolated in this new suite so these cases reach the post-issuance branches; the full regression suite retains their separate coverage. Derived leaderboard and generation effects are stubbed, while account, session and receipt persistence remain real.

Two retry cases inject a retryable abort after a resumed issuance callback. The actual SDK retries, reads changed canonical attempt/hint state, and the response projects only that final attempt. These are controlled resumed-state retries, not a claim about natural contention or rollback of newly queued session creation writes.

The matching old-source emulator suite fails ten read assertions and passes four recovery/retry controls. The final implementation passes all fourteen. Initial fixture probes are retained separately: the Daily seed initially omitted its catalog challenge key; unknown-token error expectation and declined-loss finalization were corrected before the matching baseline. A mis-shaped finalization call was also corrected to the actual four-argument API. None of these fixture issues changed production behavior.

## Verification

- **1,647 backend unit tests / 134 suites passed**.
- **302 Firestore/Realtime Database emulator tests / 20 suites passed**, including fourteen new current-load cases and existing multiplayer, buffer, completion, skip, deletion, supply and referral controls.
- **62 focused tests / three suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,897 declarations / 1,158 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,356 freshly enumerated source inputs** stayed unchanged through final verification, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 23 tracked jobs are terminal and owned emulators stopped.

Evidence is in `artifacts/current-load-issued-state-2026-10-05/`. `report-generation.py` validates matching reproduction results, frozen-source timing traces, regression counts, source stability, preserved hashes, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. No final gate failed. The combined focused log contained no timing trace records, so evidence validation initially stopped. An isolated four-case run against the unchanged frozen source captured the traces and passed; the validator now checks that log. The broader improvement goal remains active; no deployment was made.
