# Smaller Classic supply worker transaction reads — 5 October 2026

The Classic replenishment worker now selects only eligibility and locale fields for its claim transaction, and only the current lease ID for its settlement transaction. Each attempt still reads and locks the same canonical job document. It no longer loads unused job payload during these two transaction reads.

Claim retains `nextAttemptAtMs`, `completed` and `locale`; settlement retains `leaseId`. Generation inputs, deadline calculation, transaction boundaries, lease duration, provider-failure backoff, completion writes and superseded-owner rejection retain their existing behavior. Unrelated fields remain stored unchanged, and no cached snapshot is reused across attempts. The ID-only discovery query from the previous pass is unchanged.

## Matching reproduction

The actual Admin SDK and a private loopback demo Firestore emulator exercise the real worker. Only the generation provider is stubbed. Observers forward original transaction methods and record genuine returned snapshots; the SDK and emulator apply field masks and execute commits and retries.

A synthetic canonical job contains a 100,000-character unused field:

| Transaction read | Decoded document JSON before | After |
| --- | ---: | ---: |
| Claim eligibility and locale | 100,095 bytes | 53 bytes |
| Settlement lease ownership | 100,156 bytes | 50 bytes |

The worker keeps two transaction reads and two transaction boundaries. These synthetic decoded JSON sizes exclude metadata and wire encoding and do not establish production latency or representative real job-size distributions.

The matching ten-case emulator suite fails the payload assertion on the old implementation; nine reliability controls pass. Selecting claim fields reduces only the claim snapshot, leaving the settlement payload unchanged and the same single case failing. Selecting settlement ownership resolves that case; all ten pass. The original eight-case unit suite gains explicit mask assertions and the masked-read seam, without changing its existing eligibility, generation, backoff and lease controls.

The real SDK cases cover one worker's two-read payload, four concurrent claims granting one worker, provider failure and later eligibility, future/completed/missing-job exclusion, a fieldless existing job correctly failing locale validation, and settlement after lease supersession or job removal. A retryable abort injected after the first claim callback queues its writes exercises actual SDK rollback/retry; the second claim attempt reads the changed canonical locale and only that locale reaches generation. This is an injected abort, not a claim about natural production contention.

## Verification

- **1,640 backend unit tests / 132 suites passed**.
- **279 real Firestore/Realtime Database emulator tests / 18 suites passed**, including ten new worker transaction cases and the existing supply discovery, multiplayer, completion, skip, deletion and referral controls.
- **54 focused tests / five suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,787 declarations / 1,154 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,352 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 15 tracked jobs are terminal and owned emulators stopped.

The initial TSDoc probe identified three missing comments on newly added test type fields; those were repaired before the source freeze and final gates. No final gate failed. Evidence is in `artifacts/classic-supply-transaction-payload-2026-10-05/`. `report-generation.py` validates matching old/intermediate/fixed payload traces, regression counts, source stability, preserved artifact hashes, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. The broader improvement goal remains active; no deployment was made.
