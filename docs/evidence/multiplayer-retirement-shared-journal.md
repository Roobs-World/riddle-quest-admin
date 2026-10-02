# Shared recovery journal preservation during retirement

A new injected-browser gate verifies actual browser storage cleanup while matchmaking providers are removed or replaced. It covers pending, failed and empty searches; newer challenge journals from the same or another account; desktop/mobile; and normal, denied-first-read and denied-second-read observations. All 72 cases pass.

The second-read cases return the session's old owned record from the first cleanup observation, then immediately replace physical storage with another tab's newer selection. The subsequent cleanup observation throws. Each case asserts that both reads were exercised and that the newer serialized record remains exactly unchanged. There are 24 such race cases.

Pending searches settle before any SDK response, and a later old matched result cannot overwrite the newer journal. Provider replacement retains explicit fresh-search behavior with a new request receipt. The production revision guard already handles these boundaries, so no production change was required. A negative test-bundle control removes the expected-revision comparison and fails because another tab's selection is deleted.

The original second-read setup left a newer revision present before both observations, which correctly short-circuited cleanup after its first read. Its passing log is retained separately, but the final gate adds the intervening write and explicitly verifies its second observation; only that final log supports the 24 race cases.

Evidence is in `artifacts/race-retirement-shared-journal/verification-held.json`. The manifest retains preceding gates and adds this check, for 63 checks. This verifier-only batch does not claim a fresh full client suite or all-target build. Concurrent accepted-run recovery changes are still underway in the other user-owned chat, so the preceding full-suite/build proof does not establish current whole-source completion. Observed source hashes are identified as observations, not a guarded compilation digest.

Full-source dashboard recording remains pending. No hosted Jest update, publication or Firebase deployment occurred in this batch. The multiplayer reliability audit remains active.
