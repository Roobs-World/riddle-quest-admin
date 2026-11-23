# Atomic single-player profile repair — 5 October 2026

Single-player completion now computes missing profile fields from the account snapshot inside its completion transaction. Profile repair, progression, rewards, achievements and the completion receipt commit together. Cached and superseded completions can repair an existing legacy account in that same transaction; a missing account is never recreated. The exported standalone repair helper also uses a transaction and recomputes defaults when Firestore retries.

`firestoreService.ts` exposes the pure `prepareUserDocumentCompletion` calculation and retains the transactional `ensureUserDocumentComplete` helper. `completeGameLogic.ts` uses the pure calculation with its fresh account snapshot instead of running a separate repair before settlement. Successful ordinary completion combines repair fields into its existing single account update.

## Reproduced problem

The old helper read an account, built replacement stats/progress objects and scalar defaults, then performed an unguarded document update. The regression inserts a legitimate server progression/purchase update between those operations. The old repair changes 550 coins to 300, paid access from true to false, Classic progress from 6 to 5, game count from 10 to 9, multiplayer wins from 2 to 1, and removes the newly unlocked badge. The matching baseline fails; the fixed helper retries with the new account snapshot and preserves all of those fields while filling missing defaults.

The tested hypotheses were a stale object overwrite, scalar defaults overwriting newer grants, an avoidable repair read/write before completion, and accidental account recreation on replay. No cross-request account or authorization cache was introduced.

## Timing control

| Account state | Simulated completion before → after | Sequential transport stages before → after |
| --- | --- | --- |
| Complete profile | 600 → 400 ms | 3 → 2 |
| Legacy profile needing repair | 800 → 400 ms | 4 → 2 |

The fixture applies 200 ms to each document read and to the old standalone repair write. Both paths remove one document read, from five to four. The legacy path also removes its separate repair write; those fields are now part of the completion account write. The post-commit account read remains in the measurement.

These tests use the real completion and profile-repair code, with a trusted terminal-state finalization fixture and simulated persistence. They exclude transaction commit/network latency and are not measurements of production request time. Separate real-Firestore tests use actual session issuance and authoritative guesses.

## Real transaction checks

Five new emulator cases verify:

- Concurrent completion of real winning and losing sessions produces one receipt and one progression/reward grant, retains paid access and unrelated multiplayer counters, fills legacy defaults, and replays unchanged.
- A corrupt completion receipt aborts without persisting profile repair.
- An existing completion receipt can replay after the fixture removes the account without recreating that account.
- A real progression/purchase transaction and concurrent standalone repair preserve the new balance, paid access, progress, counters and badge.

Only derived leaderboard/content-generation projections are stubbed in those new cases. Session issuance, guesses, completion binding, profile repair, economy and receipts use the real Admin SDK and private Firestore emulator. The missing-account case exercises internal replay behavior, not authorization for a deleted client identity.

## Final verification

- **1,600 backend unit tests / 130 suites passed**.
- **225 Firestore/Realtime Database emulator tests / 13 suites passed**, including the five new repair cases, live multiplayer, Facebook context delivery and Facebook/Reddit referral ledgers.
- **75 focused tests / 4 suites passed**, including the two timing controls and profile/completion/security checks.
- Backend TypeScript, targeted lint and the module-cycle audit passed: 194 production modules and 1,101 runtime references.
- TSDoc passed: **25,597 declarations / 1,147 files**.
- All six isolated target builds and artifact audits passed. **YouTube used an incomplete-content fixture; this is not release certification**.
- **8 built-client browser tests / 3 suites passed**. The buffered single-player transition threshold remains 100 ms.
- **2,345 freshly enumerated source inputs** stayed unchanged across final gates, including compiled shared core code and the backend's installed core package. All **1,300 build files** and six target dependency inventories were preserved with SHA-256 hashes.
- All 13 tracked process handles are terminal. Private builds, their six matching metadata records, and owned emulators were cleaned up.

Early probe failures are retained: the first unit fixture did not return its retry result and its complete-profile fixture omitted the paid-access field; both were corrected. The first real loss fixture used too few guesses and was corrected to use the production attempt limit. Three missing test comments were corrected. A broad preflight omitted Node's required VM-modules flag and failed Yahoo OAuth tests for that setup reason; the frozen final run restored the flag and passed the full suite. These probes do not support the final pass claim.

No UI, translated text or target adapter contracts changed. No deployment was performed. The previous goal turn was progress through provider-specific settlement reads; this turn is progress through removal of a reproduced profile-overwrite race and fewer completion stages. The overall goal remains active.

Evidence is in `artifacts/single-player-atomic-repair-2026-10-05/`. `report-generation.py` re-enumerates the source snapshot, checks baseline/fixed traces, regression output, final gate counts, build hashes, cleanup and reverse applicability of the owned patch, then writes `verification-summary.json`.
