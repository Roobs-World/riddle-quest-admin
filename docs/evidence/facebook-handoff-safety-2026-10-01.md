# Facebook draft handoff safety — 1 October 2026

Status: implemented and verified locally. No Meta upload, deployment or promotion
was performed. This follows the [native sharing](facebook-native-sharing-2026-10-01.md)
and [referral retention](facebook-referral-retention-2026-10-01.md) review work.

Facebook preparation and draft commands now share one exclusive local lock for the
receipt directory. The preparer checks all retained hash-scoped attempts before
replacing the rebuildable ZIP or its gate receipt. `begin` refuses another handoff
while an older attempt is transmitting/ambiguous, malformed or missing its matching
immutable archive. An orphan archive from an interrupted begin also blocks preparation.

Outcome commands explicitly require `--archive-hash`. They re-hash the retained
read-only file and validate its matching barrier, so an unrelated later build,
changed HEAD or changed singleton gate cannot make the earlier attempt unreachable.
Initial begin still requires exact gated bytes and a clean source worktree.

`recover --archive-hash HASH` verifies an orphan immutable archive and records an
ambiguous outcome. It never replaces bytes or supplies another upload instruction.
The operator must reconcile Meta before acceptance. A killed process may leave a
local lock: it is never automatically stolen or removed. Investigate the process
and receipts before manually clearing a confirmed stale lock.

Each promotion attestation is write-once in `promotion-HASH.json`; prior promotion
receipts remain untouched. Existing receipt/archive formats remain readable. These
commands record local human evidence and make no provider network call. Their
existence is not proof that Meta accepted or promoted an artifact.

## Verification

Seven new real command/filesystem tests passed in isolated temporary Git repositories:

- Concurrent preparation/begin cannot enter while another command holds the lock.
- Another hash and preparation cannot replace an unresolved attempt's bytes.
- Orphan recovery is ambiguous, refuses repeat recovery, and blocks new preparation.
- Ambiguous, acceptance and promotion select the original archive after HEAD, the
  latest ZIP and the singleton receipt change; duplicate promotion is rejected.
- Missing, malformed and cross-artifact barriers fail closed.
- An accepted history permits later preparation, while an older unresolved attempt
  still blocks it.
- A stale process lock remains intact for investigation.

The full release-script suite passed **135 tests**, including Jest and YouTube
release contracts. TSDoc and file-size audits passed. No browser/UI or provider
runtime bundle changed in this follow-up; all six isolated target builds and prior
injected-browser verification are retained in the earlier review evidence.

[Logs/source manifest](../../artifacts/facebook-handoff-review-2026-10-01/manifest.json)
and [operator commands](../facebook-instant-games-operations.md) record the local
review state. The checkout contains concurrent multiplayer changes and is dirty;
no release-ready clean commit or upload eligibility is claimed.

Remaining acceptance still needs a clean reviewed source commit, the required
backend/config rollout, owner/provider approval work, and an actual non-production
Meta draft plus physical-device tests. The global lock coordinates this local
receipt directory; independently operated checkouts/machines still require one
operator to coordinate the provider handoff.
