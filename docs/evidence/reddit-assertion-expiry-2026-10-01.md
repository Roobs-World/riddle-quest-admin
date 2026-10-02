# Reddit assertion expiry — 1 October 2026

Reddit gateway verification now checks fresh server time after persisting the
one-use replay record. Previously, a valid signed assertion could pass its initial
age check, wait beyond the acceptance window during the Firestore write, then reach
the operation handler. The shared verifier now rejects that delayed completion.
Identity exchange, account deletion, storage and gameplay all use this verifier.

The existing signature, exact operation/payload binding, 60-second inclusive maximum
age and five-second future allowance remain intact. Custom maximum ages and fixed
unit-test clocks retain their existing contract. Invalid or backward later clocks
fail closed. Initial stale assertions are rejected before nonce persistence. If
persistence succeeds but time subsequently expires, the spent nonce remains stored;
the caller needs a freshly signed request. The fix neither removes the replay
receipt nor extends its existing 24-hour retention timestamp.

The new regression cases initially failed: five assertions demonstrated that stale,
unsafe or backward post-write time was accepted. The original failing log is retained.
The final unit tests pass. A real Admin SDK integration against the local Firestore
emulator also verifies expiry after a successful write, unchanged receipt retention
and rejection of a replay. Existing concurrent one-use and quota/TTL cases pass.
The destructive integration setup now refuses any project without a `demo-` prefix
or any emulator address outside loopback.

Executed evidence is retained in the
[manifest](../../artifacts/reddit-assertion-review-2026-10-01/manifest.json) and
[validation logs](../../artifacts/reddit-assertion-review-2026-10-01/validation/):

- Focused Reddit security/endpoints: 32 tests passed.
- Pinned Node 22.23.1 full backend verifier: TypeScript, ESLint and 116 suites /
  1,398 tests passed, including Facebook, Jest and other provider backend coverage.
- Node 22 local Firestore emulator: four integration tests passed in
  `demo-riddle-reddit-gateway`.
- Backend build/module-cycle, TSDoc and source-size audits passed.
- Jest, Facebook, Reddit, YouTube, Netflix and Yahoo builds and artifact isolation
  audits passed; Reddit package checks passed all 35 tests.

No client SDK, interface, locale, network destination, Devvit configuration or
provider feature flag changed. Facebook retains the native SDK integrations and
local notification configuration recorded in the
[configuration follow-up](facebook-config-readiness-2026-10-01.md). No deployment,
upload, installation, payment, message send or production database mutation occurred.
The working tree remains dirty; this evidence is not a canonical release receipt.

The current trackers still have 33 incomplete Facebook requirements and 13 incomplete
Reddit requirements. Provider approval, real signed fixtures, hosted/device evidence,
reviewed clean-source handoffs and retention/backend rollout remain unproven. The
Facebook translation corpus also retains its documented source/answer-length
constraint. Passing local tests does not close those requirements or establish
approval for Reddit's proxy host. Deploy the reviewed complete Functions/rules unit
and retain the actual signed hosted results before advancing release status.
