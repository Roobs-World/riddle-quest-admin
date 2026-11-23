# Human waiting, difficulty and matchmaking security

Parallel agents mapped difficulty, public matching, client recovery, stream admission, security boundaries and deployment impact. Work preserves the existing private SMS lobby and the previous Daily-to-Classic and achievement-timing corrections.

## Difficulty

The user's scope confirmation limits the difficulty increase to single-player puzzles. Multiplayer race decks retain their original ten easy and five medium questions. Selection still uses only validated records for the requested category and locale. Both players receive the same immutable deck; previously issued decks and questions are preserved.

Newly authored Daily questions require medium difficulty. Newly authored Classic indices divisible by three require medium difficulty, including retries for that same index. Existing authored questions are unchanged. Attempts, help prices and reward amounts were not changed by difficulty tuning. This is a small content-selection adjustment, not a measured percentage change in player difficulty.

## Waiting and recovery

Modern public joins explicitly request `waitForPlayer: true`. They can wait for a human for up to 15 minutes and end with cancellation instead of an automatic bot. Existing legacy public seats preserve their original six-second bot policy, including recovery through an upgraded client. Private SMS invitations remain separate, temporary two-seat lobbies.

A shared transactional queue helper reconciles new joins, recovered seats and waiting polls. It reads ownership, canonical active pointers, real retention timestamps, heartbeat leases, provider/content scope, profiles, reciprocal blocks and deletion boundaries before committing a match. It excludes private tickets. Waiting players re-enter after foreground recovery or bounded-queue pruning and can pair with existing waiters. Transactions retain the original tickets, selected deck and shared countdown.

Join and recovery reuse their same-transaction public identity snapshot for queue eligibility. Waiting polls and opponent eligibility read only username, level and avatar fields. This preserves profile existence checks without loading unrelated account balances or private storage. Modern waiting, exact recovery and human pairing have payload regression coverage.

Client recovery stores a bounded, account-bound hint only after the server acknowledges a public waiting/countdown ticket. Reload requests that exact `resumeTicketId` under a fresh join intent. Missing, replaced, foreign, cancelled, expired and terminal tickets cannot create replacement seats. Incoming SMS invitations retain priority over saved public hints. Storage failure preserves ordinary in-memory play; compare-before-write protects a newer visit. Start, explicit close and terminal state clear the owned hint. Server deadlines control the progress indicator and timeout presentation.

## Security changes

- Assigned matches and tickets require real unexpired server retention timestamps. Missing assigned authority cannot turn into a replacement bot, including SMS recipient seats. Exact recovery fails closed; a fresh independent join can replace a dead active pointer without resurrecting it.
- Fresh terminal no-op commands allocate no new command receipts. Accepted final commands retain their idempotent receipts.
- Statistics, achievements, win currency and qualifying referral events require an actual server-recorded correct-answer event for the relevant seat. Skips and exhausted guesses cannot satisfy this condition. A zero-answer forfeit still has a displayed outcome, with no reward grant.
- Stream admission serializes at most two simultaneous streams per account across instances. One fixed account document contains bounded server-generated UUID leases. A lease expires within 45 seconds and never outlives its ticket. Ownership, account deletion and retention checks precede listener attachment. Abort, expiry, setup failure and transport failure release listeners; conditional cleanup removes only its own lease and preserves replacements. Existing rules deny browser access to this internal subcollection, and account deletion recursively removes it.
- Private invitation preview, acceptance and recovery validate creator, assigned match and recipient retention, in addition to the established participant and block boundaries.

Independent source review found no remaining blocker in these changes. Authentication, production App Check, strict bounded requests, server-only answers, caller-owned mutations, atomic two-seat pairing, authoritative clocks/results and idempotent settlement remain the trust boundaries. Unaddressed SMS links remain bearer links until the first eligible recipient accepts. Requiring actual answers reduces zero-play farming; it does not prove cooperating players cannot collude after answering. The game is server-authoritative, not end-to-end encrypted.

## Validation and release state

Portal and backend TypeScript compilation passed. Target boundaries, all 16 locales, dependency notices, Console configuration, deployment environment, module cycles, function capacity, changed-backend lint, Jest artifact size and W3C HTML validation passed. Changed test fixtures also passed semantic TypeScript and ESLint checks. The final client has 419 files and 4,716,830 extracted bytes, within the unchanged 4.5 MiB release budget and 0.55 MiB initial-resource budget. ZIP SHA-256 is `affb930bc94669069c5f12442c47a0c90c13a6bf613b32664fcefcb0cfea462a`.

The user explicitly authorized multiplayer emulator/browser tests after confirming the single-player difficulty scope. Separate agents ran isolated backend and browser suites in local demo projects. Direct readback of final per-file Jest results confirms 399 unique passing tests across 19 files: 269 real Firestore integration tests and 130 callable/security unit tests. Coverage includes concurrent pairing, exact and foreign recovery, expired or missing authority, blocked/deleted accounts, private participant isolation, command receipts, reward/statistic eligibility, account deletion and stream admission. Stream tests cover the two-connection limit, listener/transport failure, replacement cleanup, crash expiry and direct browser denial of the internal admission ledger. [Backend results and exact commands](../../../../artifacts/matchmaking-e2e-20261018/backend/summary.json).

Six browser suites passed at 1280px and 390px. Public and private suites use the compiled server services against real local Firestore transactions. They cover waiting past the former six-second fallback, exact-ticket reload, disconnection while a second player joins, shared countdown, score updates, private sender reload and own-link recovery, recipient link entry and inbox acceptance. Four supplementary suites exercise native dialog lifetime, preview ownership, safety recovery and cancellation with controlled transport responses. Public and private suites passed again after the final profile-read correction. [Browser results, commands, screenshots and limitations](../../../../artifacts/matchmaking-e2e-20261018/browser/summary.json).

The original failed runs remain recorded. Tests exposed one production regression in duplicate full-profile reads; the queue now reuses or masks those reads. Other corrections restored fixture prerequisites for the zero-play reward gate, awaited test-owned SDK teardown and updated stale UI selectors and SVG fixture content types. Assertions for settlement corruption and zero-answer reward denial remain intact.

These checks did not invoke production game functions, hosted Jest identity/App Check, the production callable transport or actual SMS delivery. Callable authentication cases use synthetic verified contexts. The browser wait clock advances only local demo state; no 15-minute wall-clock soak ran. Single-player generation tests were outside the user's multiplayer test authorization.

The [prepared backend deployment plan](../../../../artifacts/human-wait-backend-deployment-plan-2026-10-18.json) identifies the complete dependency cohort, including all settlement entry points. These server changes must deploy before activating the new client. In particular, `updateLiveRace`, `retireLiveRaceJoin` and the embedded `redditGameplay` handlers must update together to prevent an old settlement handler from retaining the previous reward policy.

Jest finished processing client version `1.0.0-dev.20261018-solo-wait-e2e.mvec8r8r`, ID `01a150eb-3695-771d-ad4e-4f0770601aef`, to ready, inactive, without a processing error. [Preview the candidate](https://jest.com/g/riddle-q?versionId=01a150eb-3695-771d-ad4e-4f0770601aef). Metadata readback and archive verification are recorded in the [upload receipt](../../../../artifacts/jest-uploads/solo-wait-e2e-20261018/upload-receipt.json). At that point, the lobby build remained active and the prepared backend changes had not deployed.

After the user's instruction to continue on 20 October, all ten backend exports deployed across their sixteen existing regional instances and passed revision and traffic checks. Jest then activated the latest cumulative client `01a1567e-c03d-712d-b40e-2ef13b822050`. Publication and review state remain unchanged. [Deployment and activation evidence](../../releases/evidence/continuation-release-2026-10-20.md).
