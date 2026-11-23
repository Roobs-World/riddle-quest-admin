# Smaller leaderboard writer transaction reads — 5 October 2026

The atomic leaderboard writer now selects only the canonical account's three public identity fields and five score fields. Each transaction attempt still locks and reads the current account and fully replaces the public leaderboard row. Unused account preferences, progress and economy fields are no longer loaded by this projection task.

The writer still performs one account read. Its ownership, score calculations, missing-account handling, removed-avatar behavior and commit-dependent success logging retain their existing behavior. This change affects backend payload size; it does not establish a reduction in production request latency.

## Matching reproduction

The actual Admin SDK and a private loopback demo Firestore emulator exercise the existing writer. A synthetic canonical account contains a 100,000-character unused field and an unused coin balance. An observation seam forwards the original transaction methods and measures returned document JSON; it does not supply filtered snapshots.

| Fixture measurement | Before | After |
| --- | ---: | ---: |
| Decoded account JSON | 100,175 bytes | 146 bytes |
| Observed account reads | 1 | 1 |

The selected fixture snapshot contains only its username, avatar and score map. Display name is also selected and absent from this particular account. These are decoded synthetic JSON sizes, not network wire bytes or real account-size distributions.

The matching nine-case emulator suite fails its payload check on the old writer, with eight reliability controls passing. All nine pass after the change. Four cases were added: the payload observation, an account with no selected public fields, and two actual SDK abort/retry cases. In the retry cases, the first callback queues a public row before a fixture injects a retryable abort. The actual SDK rolls it back and retries; the next attempt either reads updated identity/scores or observes account deletion and publishes no row. These are injected SDK aborts, not measurements of natural production contention.

The matching 37-case unit suite fails three field-mask assertions on the old implementation and passes after the change. Two cases were added for fieldless-account defaults and membership changing between attempts. The existing single-player completion latency fixture now models masked reads through its same physical-read seam. It keeps the existing four-read / 600 ms deterministic Classic preparation control; that fixture is not payload evidence or production timing.

## Final verification

- **1,630 backend unit tests / 131 suites passed**.
- **251 real Firestore/Realtime Database emulator tests / 15 suites passed**.
- **74 focused tests / four suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,686 declarations / 1,150 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,348 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and their matching metadata were removed after verification. All 12 tracked jobs are terminal, including the expected initial red probe, and owned emulators stopped.

No final gate failed. The broader improvement goal remains active. No deployment was made.

Evidence is in `artifacts/leaderboard-writer-payload-2026-10-05/`. `report-generation.py` checks matching old/fixed SDK payload traces, red/fixed counts, final gates, fresh source enumeration, preserved hashes, cleanup, exact owned source snapshots and reverse applicability of the patch before generating `verification-summary.json`.
