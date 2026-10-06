# Skip empty single-player projection work — 5 October 2026

Single-player losses and anonymous Daily wins now return after durable completion and any required referral settlement, without fetching the profile for an empty set of projection tasks. Named wins retain the fresh profile lookup and leaderboard update. Every Classic win, including anonymous play, retains the lookup and content preparation. Required tasks remain awaited together and recoverable failures retain their existing handling.

The change is in `firebase-functions/src/gameplay/completeGameLogic.ts`. Eligibility is calculated before the post-commit profile read. The guard follows both the atomic completion transaction and referral settlement, so it cannot return before progression, rewards, achievements, the receipt or a required referral retry have completed.

## Evidence

The initial timing regression failed on both complete and legacy losing profiles: each made one unnecessary post-commit read. The matching baseline takes 400 ms with 200 ms simulated reads. The fixed path takes 200 ms and reduces document reads from four to three. This uses the actual completion/profile code with injected persistence and a trusted terminal-state finalization fixture; transaction commit and production network latency are outside the model.

An eight-case mode/win/identity matrix separately models the projection phase with a 200 ms profile lookup, a 250 ms leaderboard task and a 400 ms content task. The baseline fails five empty-work cases while all three required-work controls pass. The fixed matrix passes all cases and verifies unchanged balance/statistics on receipt replay.

| Completion | Fresh profile read | Required tasks | Projection model before → after |
| --- | --- | --- | --- |
| Classic loss, named or anonymous | Skipped | None | 200 → 0 ms |
| Daily loss, named or anonymous | Skipped | None | 200 → 0 ms |
| Anonymous Daily win | Skipped | None | 200 → 0 ms |
| Named Daily win | Retained | Leaderboard | 450 → 450 ms |
| Anonymous Classic win | Retained | Content preparation | 600 → 600 ms |
| Named Classic win | Retained | Leaderboard and content preparation | 600 → 600 ms |

The zero values describe only the simulated post-commit projection phase; they do not claim an instantaneous game request. Existing tests continue to verify that the slower independent task is awaited and a failed leaderboard task cannot suppress or leave content preparation running beyond the response.

Real-Firestore coverage was expanded from two Classic result cases to all eight mode/win/identity combinations. Actual opaque session issuance, authoritative guesses, completion, legacy-profile repair, concurrent settlement and replay run against the emulator. The surrounding three checks retain corrupt-receipt rollback, missing-account replay without recreation, and concurrent progression/purchase preservation. Derived leaderboard/content projections are stubbed in that emulator fixture; the separate unit matrix proves task eligibility and waiting behavior.

## Final verification

- **1,608 backend unit tests / 130 suites passed**.
- **231 real Firestore/Realtime Database emulator tests / 13 suites passed**, including the 11 single-player repair/result cases, live multiplayer, Facebook context delivery and Facebook/Reddit referral ledgers.
- **33 focused tests / 3 suites passed**, preserving both losing-profile timing traces and all eight projection traces.
- Backend TypeScript and targeted lint passed. TSDoc passed: **25,608 declarations / 1,147 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **8 built-client browser tests / 3 suites passed**. The buffered single-player transition threshold remains 100 ms.
- **2,345 freshly enumerated source inputs** stayed unchanged across final gates, including compiled shared core code and the backend's installed core package.
- All **1,300 build files** and six matching dependency inventories were preserved with SHA-256 hashes. Private build output and its metadata were removed, owned emulators stopped, and all 11 tracked process handles are terminal.

A preflight TSDoc failure identified one missing comment in the new replay test; it was corrected before the final source snapshot. No other final gate failed. No UI, translation or adapter contract changed, and no deployment was performed.

The previous goal turn was progress through atomic profile repair and removal of its separate transport stages. This turn is progress through eliminating empty projection reads with positive controls for required work. The broader improvement goal remains active.

Evidence is in `artifacts/single-player-empty-projections-2026-10-05/`. `report-generation.py` re-enumerates current source inputs and validates matching baseline/fixed timing and projection traces, gate counts, build hashes, cleanup and reverse applicability of the owned patch before generating `verification-summary.json`.
