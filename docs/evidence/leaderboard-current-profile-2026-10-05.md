# Current leaderboard display fields with smaller account reads — 5 October 2026

Leaderboard reads now hydrate names and avatars from the canonical account snapshots they already fetch to check liveness. A stale or failed best-effort copied profile update no longer makes the response display an earlier name or image. Removed, empty or invalid current avatars are omitted; current username/display-name fallback never restores the older copied name.

The existing batch read selects only username, display name and avatar. Canonical fallback and multiplayer ranking queries now select those identity fields plus their five existing score inputs. These changes reduce unnecessary account data loaded inside the backend, with no additional account load. Dedicated ranking scores, projection timestamps, query ordering, requested/candidate limits and ownership/deletion checks retain their existing behavior. Canonical fallback and multiplayer score calculations also retain their existing inputs and semantics.

No read repairs or writes the stored leaderboard, account or economy. Score backfill, global instantaneous ranking and the atomic writer's account-read implementation are outside this pass. Current names and avatars are observed when a client fetches the leaderboard; existing client cache behavior is unchanged.

## Reproduction and payload evidence

The real callable wrapper and actual Admin SDK run against a private loopback demo Firestore emulator. The matching old implementation fails nine of ten probes. The existing deletion/subject-ownership control passes on both versions. All ten probes pass with the fix:

- Current identity is returned for XP, total-wins and best-streak boards while projection scores and timestamps remain unchanged.
- Removing an avatar or username cannot restore its copied older value.
- An existing account with no selected display fields remains live, uses the existing Player fallback and keeps its projection score.
- Deleted accounts and mismatched subject ownership remain excluded before hydration.
- Actual SDK field masks are exercised for the existing account batch, canonical fallback query and multiplayer query.

Each payload fixture contains a synthetic 100,000-character unused account field and an unused coin balance. The SDK observation seams call the original database methods and measure decoded document JSON for that fixture, rather than supplying fake filtered snapshots.

| Read path | Decoded fixture data before | After | Observed canonical account loads |
| --- | ---: | ---: | ---: |
| Dedicated-board account batch | 100,153 bytes | 79 bytes | 1 → 1 |
| Canonical fallback query | 100,176 bytes | 147 bytes | 1 → 1 |
| Canonical multiplayer query | 100,176 bytes | 147 bytes | 1 → 1 |

The fixed batch contains only the fixture's name and avatar; the fixed queries additionally contain its selected score map. Display name is selected too and is absent from those particular fixtures. These measurements do not represent network wire bytes, real profile-size distributions or production latency. The isolated matching probes capture the absolute sizes; the full emulator gate independently verifies the same field sets, one-load controls and size budgets.

The matching 35-test unit suite fails 14 cases on the old implementation and passes completely after the fix. Eleven cases were added, and existing canonical-query and ownership controls gained explicit field-selection assertions. The fixtures model current account identity separately from copied rows. They cover all three dedicated stat types, removed/invalid avatars, current-name fallback, read-only behavior, one existing batch and retained ownership filtering.

## Final verification

- **1,628 backend unit tests / 131 suites passed**.
- **247 real Firestore/Realtime Database emulator tests / 15 suites passed**, including ten new observer cases, atomic leaderboard refresh, real single-player completion, live multiplayer, deletion, Facebook context and Facebook/Reddit referral ledgers.
- **72 focused tests / four suites passed**.
- Backend TypeScript, targeted lint and TSDoc passed: **25,671 declarations / 1,150 files**.
- All six isolated target builds and artifact audits passed. **YouTube used the incomplete-content fixture; this is not release certification**.
- **Eight built-client browser tests / three suites passed**, retaining the 100 ms buffered single-player transition threshold.
- **2,348 freshly enumerated source inputs** stayed unchanged through final gates, including compiled and installed shared core code.
- **1,300 built files** and six dependency inventories were preserved with SHA-256 hashes. Private outputs and their matching metadata were removed after the gates. All 11 tracked jobs are terminal, including the expected initial red probe, and owned emulators stopped.

No final gate failed. No renderer, translations, target adapter, public schema or deployment changed. The previous goal turn removed the duplicate Classic account fetch. This turn improves observed profile freshness and reduces decoded account payload across three leaderboard read paths. The broader improvement goal remains active.

Evidence is in `artifacts/leaderboard-current-profile-2026-10-05/`. `report-generation.py` checks matching old/fixed SDK payload traces, red/fixed counts, final gates, fresh source enumeration, preserved hashes, cleanup, exact owned source snapshots and reverse applicability of the patch before generating `verification-summary.json`.
