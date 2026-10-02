# Reddit canonical post creation — 1 October 2026

The prior install, upgrade and moderator handlers separately read the retained
post key, submitted a post and wrote its ID. Moving that unchanged sequence into
the tested server helper reproduced three submissions from three overlapping
requests. A lost provider response also permitted another submission on retry.
Both failing tests are retained in `reproduction.log` under
`artifacts/reddit-canonical-post-review-2026-10-01/validation`.

The handlers now call one helper with the real `@devvit/web/server` Reddit and
Redis adapters. An atomic `set` with `{nx: true}` claims the existing installation
key before submission. It has no expiry. A successful response replaces the
pending marker with the validated `t3_` ID. Contenders reuse an already completed
post or fail temporarily while creation remains pending. Redis/provider transport
uncertainty, invalid response IDs and corrupt existing values never trigger an
automatic replacement. Existing installations retain their original key and ID.

The pinned Devvit 0.14.6 SDK types and implementation support `nx` and return the
provider's string reply. Its supplied Redis mock normalizes a failed NX result to
an empty string. The helper requires the exact successful `OK` reply. Reddit's
official documentation confirms that requests can run concurrently and that Redis
is installation-scoped. [Reddit Redis documentation](https://developers.reddit.com/docs/capabilities/server/redis).
The atomic conditional-write and reply semantics are documented by
[Redis SET](https://redis.io/docs/latest/commands/set/).

Executed local checks:

- Seven focused tests pass: overlapping lifecycle/moderator calls; uncertain
  submission; claim failure before/after persistence; result-write failure
  before/after persistence; missing/corrupt references; a contender observing the
  winner's completed ID; and invalid provider response IDs. Their deterministic
  in-memory Redis fixture models the pinned SDK's atomic operation and replies;
  these are not live Devvit Redis or Reddit endpoint tests.
- The package passes TypeScript and all 42 tests under both the workspace Node 24
  runtime and pinned Node 22.23.1. Its contract passes at 413 regular files/7.18 MiB
  with isolated clients, a bundled CJS server and the single approved gateway host.
- All six target builds and artifact audits pass. Client code and UI copy are
  unchanged. Artifact hashes are checked against the prior tested reference.
- Source documentation and maintainable-size checks pass. The prior backend's
  1,401-test evidence remains applicable to its unchanged selected runtime sources.

A persistent pending marker needs provider inspection and a reviewed maintenance
action; there is no automatic timeout or reset endpoint. This deliberately avoids
claiming exactly-once external creation where Reddit's submission contract does
not provide an idempotency receipt. See the
[operations runbook](../reddit-games-operations.md#canonical-game-post-creation)
for resolution and rollback restrictions. No post was created, Redis state read or
written, package uploaded or provider setting changed during these checks.

Hosted install/upgrade/moderator journeys, the actual post reference, app approval,
real fixtures and physical-device acceptance remain outstanding. This dirty-source
package is local review evidence and remains ineligible for promotion.
