# Multiplayer join identity payload — 5 October 2026

Live multiplayer joins and reconnects now read only `username`, `level` and `avatarUrl` from the canonical account inside their transaction. Invitation preview, acceptance and accepted-seat recovery batch the creator and viewer profiles with the same mask. A new acceptance reuses the viewer snapshot already read by that transaction, removing its duplicate profile read.

Account existence remains SDK snapshot metadata, so an existing fieldless profile still gets the established fallback identity. Deletion markers, reciprocal blocks, provider scope, invitation ownership, content selection, active-seat exclusion, receipt recovery, retention deadlines and countdown logic keep their existing checks. Profile documents retain whole-document transaction locking and are read afresh on each SDK retry. The internal viewer snapshot is never added to a public response. Stored accounts and public/private ticket schemas are unchanged.

## Matching reproduction

Twelve cases run against the actual Admin SDK and a private loopback demo Firestore emulator. The catalog query, profile reads, account/deletion checks, queue/ticket writes, invitation acceptance and commits remain real. Observation wrappers forward original transaction `get` and `getAll` methods and their options, then inspect genuinely returned snapshots. They do not fabricate SDK data or omit requested reads.

Synthetic creator and viewer accounts each contain an unused 100,000-character field:

| Observed account | Decoded JSON before | After |
| --- | ---: | ---: |
| Creator / joining player | 100,108 bytes | 79 bytes |
| Viewer / invitation recipient | 100,106 bytes | 77 bytes |

Public joins, private joins and reconnects retain one profile read. Invitation preview and accepted-seat recovery retain two profile document reads, batched into one masked `getAll`. New acceptance reduces profile document reads from three to two, and its decoded aggregate profile payload from 300,320 bytes to 156 bytes. These synthetic decoded JSON sizes exclude metadata and wire encoding. They do not establish representative production account sizes, billing savings or measured production latency.

The matching old implementation fails six payload cases and passes six controls. Adding only masks resolves five cases while new acceptance still fails its duplicate-read assertion. Reusing the transaction's viewer snapshot resolves that final case; all twelve pass.

Controls cover fieldless public/private profiles, missing/deleted account rejection before publishing a seat, and actual SDK retries for both a public join and invitation acceptance. The retry fixtures inject an abort after the original callback queues writes. The SDK rolls back and retries; a changed canonical username, level and avatar are read before the second callback and appear in the committed seat. The resulting ticket count shows that no first-attempt seat was retained. These are controlled retry/rollback probes, not measurements of natural production contention.

The existing catalog-retry unit fixture gained a masked-read transport adapter that delegates to its original single physical read. It still verifies one immutable deck query across callback retries. Actual masked payload and existence behavior are verified by the SDK suite, not by that adapter.

## Verification

- **1,647 backend unit tests / 134 suites passed**.
- **314 Firestore/Realtime Database emulator tests / 21 suites passed**, including twelve new identity-payload cases and existing multiplayer pairing, safety, invitation, rematch, settlement, deletion, provider-context and referral controls.
- **19 focused tests / two suites passed**, retaining existing live-action and settlement timing budgets.
- Backend TypeScript, targeted lint and TSDoc passed: **25,929 declarations / 1,159 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,357 freshly enumerated source inputs** stayed unchanged through final verification, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Owned temporary outputs and matching metadata were removed after verification. All 18 tracked jobs are terminal and owned emulators stopped.

Evidence is in `artifacts/live-join-identity-payload-2026-10-05/`. The initial baseline fixture expected a callable-style error for a direct service call; its deletion assertion was corrected to the existing `account-deleted` service contract before the matching baseline. No production error contract changed and no final gate failed. `report-generation.py` validates old/mask-only/fixed payload traces, read counts, regression results, frozen-source hashes, preserved artifacts, owned cleanup and reverse applicability of the patch before generating `verification-summary.json`. The broader improvement goal remains active; no deployment was made.
