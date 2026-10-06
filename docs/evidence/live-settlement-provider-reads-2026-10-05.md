# Provider-specific live settlement reads — 5 October 2026

Jest and Reddit result settlement no longer fetches the other winner's source ticket. The only consumer of that document in settlement is Facebook's frozen context destination. Facebook still reads the canonical source ticket and carries its original context into the durable delivery outbox.

The production change is one condition in `firebase-functions/src/race/raceLiveService.ts`. The existing settlement test now covers all three providers, both winning seats, a retry after rival deletion, and a failing winner source read. This pass builds on the preceding settlement improvement without changing its cancellation, reward, privacy or retry policy.

| Provider, other player wins | Reads before → after per attempt | Behavior when source-ticket read fails |
| --- | --- | --- |
| Jest | 9 → 8 | Result settles without making that read |
| Reddit | 9 → 8 | Result and referral outbox settle without making that read |
| Facebook | 9 → 9 | Required destination read still fails before any grant or outbox write |

When the caller wins, the caller's ticket was already read and no additional ticket fetch was needed. A retry uses one fewer read per attempt for Jest and Reddit. All providers retain one fresh deletion read per participant per transaction attempt.

The pre-fix regression has **6 failures / 15 cases**: extra reads in two Jest and two Reddit cases, and blocked settlement in the Jest and Reddit source-read failure cases. The Facebook controls pass before and after. The fixed cases also check the winner's canonical outbox identity, Facebook's independent frozen destination, no context field in Reddit delivery, no grant to an account deleted before a retry, and no extra write or payout on a subsequent result observation.

Timing remains four stages: 800 ms with 200 ms simulated reads, or 1,600 ms for the two-attempt retry fixture. This pass reduces document work and removes an unnecessary failure dependency; it does not claim an additional wall-clock latency reduction beyond the preceding pass. The injected transport measurements do not represent production network latency.

## Verification

- **1,597 backend unit tests / 129 suites passed**.
- **218 real Firestore/Realtime Database emulator tests / 10 suites passed**. Coverage includes ordinary live play, concurrent polls, scoring, account deletion, invitations, rematches, push, signals, history, Facebook context delivery and both Facebook/Reddit referral delivery.
- **19 focused tests passed**: 15 provider settlement cases and the existing latency/authorization/join-retry cases. Explicit verbose output preserves all 15 provider read traces.
- Backend TypeScript and targeted lint passed; **25,557 TSDoc declarations / 1,145 files passed**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture, not release certification**.
- **8 built-client browser tests / 3 suites passed**. The buffered single-player transition threshold remains 100 ms.
- **2,343 freshly enumerated source inputs** stayed unchanged across final gates, including shared compiled core code and the backend's installed core package.
- All **1,300 build files** and six matching target inventories were preserved with SHA-256 hashes. The private build root and its metadata were removed; emulators stopped. All five tracked process handles are terminal.

No UI, translations or adapter contracts changed. No deployment was performed. The previous goal turn was progress: it reduced settlement stages and verified deletion-order behavior. This turn is progress: it removes unnecessary provider reads and demonstrates that their failures no longer prevent legitimate settlement.

Evidence is in `artifacts/live-settlement-provider-reads-2026-10-05/`. `report-generation.py` verifies the baseline and final traces, source snapshot, test counts, target audits, preserved hashes, cleanup and reverse applicability of this pass's `owned.diff`, then generates `verification-summary.json`.

The overall goal remains active. The single-player review confirmed parallel session/account reads for guesses and durable terminal completion before response delivery. It also found that `completeGameLogic.ts` calls `ensureUserDocumentComplete` before its completion transaction. That helper performs a separate account read and can repair incomplete profiles. The next audit should measure this work and test concurrent repair/progression before changing it.
