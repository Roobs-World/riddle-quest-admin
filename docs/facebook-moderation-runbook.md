# Facebook social moderation runbook

Last source audit: 2026-10-02

Owner decision, 2026-09-19: routine resolved player reports and support correspondence must be deleted 90 days after closure, with documented exceptions for active disputes or legal obligations. This resolves the period decision for those records only. The operator assignment, auditable closure/exception process and purge implementation remain release gates; no automatic expiry is claimed.

This runbook describes the moderation intake that exists in source. It does not claim that an operator roster, response-time promise, sanction system, or production retention policy exists. Those items require owner/counsel approval before release. No chat or moderation admin panel is implemented or permitted by the product plan.

## Intake contract

An authenticated player can report a server-established recorded rival or the retained human opponent of their own Live PvP seat. The request accepts exactly one target selector, plus the fixed category and request ID:

- either `targetUserId`, the provider-neutral Firebase UID already projected for a legacy recorded rival, or `liveTicketId`, the current player’s own opaque 64-character lowercase hexadecimal live seat;
- `category`: `harassment`, `cheating`, `inappropriate_identity`, `spam`, or `other`; and
- `requestId`: an opaque 8–160 character idempotency key using only ASCII letters, digits, `_`, and `-`.

The client cannot submit narrative text, a Meta/Jest player ID, platform name, photo, evidence URL, sanction, or reward. The server writes `socialModerationQueue/{reportId}` with `reportId`, `reporterId`, `targetUserId`, the fixed category, `status: queued`, and `createdAtMs`. For a live report the queue additionally stores a domain-separated SHA-256 `liveTicketBinding`; the raw ticket is not copied into the report. The resolver validates ownership, both private run/seat identities, the same provider/pool/match, retained expiries, account existence and deletion guards in the report transaction. Bots, cancelled/deleted seats and mismatched bindings are rejected. The report ID is a SHA-256 derivation of the reporter and request ID. An exact replay is queue- and count-stable; reusing the key with a different target, category or live-seat binding fails closed. Each reporter can create at most five unique reports per UTC day; the server-only rate record contains reporter UID, UTC day, count, and update time.

Firestore rules deny every client read and write to the queue and rate records. Treat Firebase/GCP administrative access as privileged production access: use an individually attributable account, least privilege, MFA, and the normal access-review process. Never export the queue to chat, issue comments, analytics, spreadsheets, personal storage, or a local fixture.

## Immediate safety versus moderation

Reporting does not itself prove misconduct or apply a global sanction. The separate block action is immediate and player-controlled: it requires the same recorded-rival relationship or private retained live-seat authorization, removes interaction eligibility, and waits for both presence visibility directions to be revoked before acknowledging success. The presence trigger repeats revocation as reconciliation. The live UI masks the opponent after confirmation; the existing engine ends an unfinished blocked pair as a tie without a reward and excludes future pairing. A report may be submitted before or after the block, and neither action awards coins. Reporting alone does not change a competitive result; blocking an unfinished live pair follows the existing authoritative tie policy.

The current queue is intake-only. Source defines no operator mutation endpoint, adjudication status vocabulary beyond `queued`, suspension/ban mechanism, appeal workflow, or notification to either party. Do not manually invent status fields or edit user economy/progression in the Firebase console. Until a reviewed, auditable disposition process exists, operators may inspect aggregate queue health and escalate a suspected safety emergency through the owner's incident process, but must not claim a completed adjudication workflow.

## Triage procedure

1. Record the incident identifier, reviewer identity, UTC access time, deployed revision, and purpose outside player-visible systems. Do not copy report rows into that record.
2. Confirm the production project and use a read-only query bounded by `status == queued` and an explicit time window. Never enumerate unrelated user documents or provider identity records.
3. Treat category and relationship as allegations, not evidence. Correlate only with server-authoritative game/race records already covered by the approved incident purpose. Meta names/photos are not available to this queue and must not be fetched into it.
4. For an imminent safety or security incident, use the provider-scoped kill switch or ordinary incident-response path appropriate to the affected capability. Do not change balances, tournament results, referral rewards, or purchase records from a moderation review.
5. Record only aggregate operational metrics needed for queue health: count, oldest queued age, and category totals. Suppress cells with very small counts if publishing them could identify a player.
6. End the privileged session and retain the access/audit record under the approved operational policy. Do not mark reports resolved until the disposition schema, authority, evidence standard, appeal path, retention, and deletion effects have been approved and implemented.

## Deletion and retention

Game-account deletion removes moderation rows where the player is either reporter or target, removes their daily rate records, recursively deletes their blocks/known-rival records, and revokes presence ACLs. This prevents the queue from retaining either direct Firebase UID after deletion. It does not establish deletion from Firebase/GCP access logs, backups, screenshots, external incident records, Jest/Meta systems, or an operator export.

The queue and rate-limit collections currently have no TTL policy. Before public release, the owner and counsel must approve a bounded retention period and its treatment of open safety investigations; engineering must then add and deploy the corresponding TTL/index or reviewed purge process and verify it against deletion races. Until that happens, documentation and privacy notices must describe retention as unresolved rather than promise automatic expiry.

## Verification commands

```sh
pnpm --dir firebase-functions exec jest --config jest.config.js --runInBand \
  src/__tests__/socialSafety.test.ts \
  src/__tests__/socialSafetyCallables.test.ts \
  src/__tests__/deleteAccount.test.ts
pnpm --dir firebase-functions test:race:rules
```

The Live PvP source review and two provider artifact journeys were completed on 2026-10-02; see [live safety evidence](evidence/live-race-safety-2026-10-02.md). The independent repository source review was also performed on 2026-08-22 against the service, callable schema, rules, deletion cleanup, and presence revocation paths. Required pre-release evidence still includes the production access roster, approved disposition and appeal policy, approved retention, deployed rules/index verification, sample audit record, and an end-to-end role-account report/block exercise on Facebook web, iOS, and Android.
