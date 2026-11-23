# SMS friend-lobby completion

The existing multiplayer invitation flow already reserves a private lobby before opening Jest's native share dialog. Sender polling keeps that lobby visible after success, cancellation, or sharing failure. Recipient entry joins the original lobby, and only the server's countdown starts the race. [Jest documents](https://docs.jest.com/sdk/html5/referrals) that opening or completing the share dialog does not prove SMS delivery or recipient acceptance.

This change completes sender recovery:

- Guest registration retains the same matchmaking transport and waiting lobby.
- An acknowledged creator lobby stores a bounded, account-bound recovery hint. Reload reopens that exact lobby. Public and recipient seats do not create creator hints.
- A creator opening their own invitation resumes only the original active ticket. The backend validates owner, active pointer, selectors, context, cancellation, expiry, match state, and join-intent binding. Recovery never creates another lobby or resets the countdown.
- Explicit leave, unavailable invitations, race start, terminal state, account replacement, and account deletion clear recovery. Countdown recovery remains valid through the server start time even when it crosses the invitation deadline.
- Existing foreground recovery refreshes the sender heartbeat after returning from SMS. The server still refuses to pair an absent creator.

The lightweight startup hint reader opens only the multiplayer overlay. Full schema validation stays in the deferred multiplayer code, and authenticated server reads decide whether the seat exists. Storage failures preserve the ordinary in-memory lobby flow.

## Public and private lobby separation

The confirmed scope is multiplayer challenges only. General play uses category selection followed by the public opponent-search and countdown lobby. The profile's general Invite action remains a referral action.

Challenge a friend reserves a separate two-seat lobby before opening the SMS share dialog. Its ticket never enters the public queue, and its waiting state never selects a bot. Invitation cancellation, sharing failure, expiry, and recipient rejection cannot turn it into a public search. Leaving explicitly returns to general play.

The private invitation admits the creator and one recipient in a transaction. After acceptance, its two authenticated accounts are fixed; another account cannot join or operate either seat. Before acceptance, access relies on the opaque invitation link. Jest's share API returns dismissal status, without a trusted phone-recipient identity, so the first eligible player accepting the link claims the recipient seat. An unpaired invitation expires after 15 minutes or explicit leave. Storage retention does not extend invitation availability.

Three parallel agents reviewed the public lobby, private access controls, and release consistency. The access review found that a copied link could still show the creator's preview after another player accepted it. The backend now rejects that preview for everyone outside the two participants, including legacy invitations without a stored recipient ID. Creator and recipient recovery remain available. An existing integration suite now covers the boundary, but no tests or browser harnesses ran.

Backend TypeScript compilation, lint, deployment-environment, capacity, and module-cycle checks passed after this privacy change. An independent review found no blocker. The client source did not change; its ZIP was checked against all 418 built entries and the prior upload receipt before another inactive upload.

## Validation and build

Portal and backend TypeScript compilation passed. Static target boundaries, deployment environment, capacity, module cycles, locale completeness, licenses, Console manifest, artifact size, and HTML validation passed. Independent source reviews found no remaining blockers. Existing backend integration coverage was updated, but no tests or browser harnesses ran for this request.

Existing SVG markup was compacted without changing geometry, colors, or element structure to retain the existing artifact budget. The size limits were not changed.

Jest processed version `1.0.0-dev.20261018-sms-lobby.mvdv0egy`, ID `01a14f31-9dc0-7796-90fa-bc1f9840a8b5`, to `ready` with `isActive: false` and no processing error. [Preview the client](https://jest.com/g/riddle-q?versionId=01a14f31-9dc0-7796-90fa-bc1f9840a8b5). The ZIP SHA-256 is `9e7dcf9e1d8d8dbea66445c2f941cb7296c61cd3d9ad22e6eee265d6ff6d5037`.

## Production deployment

The follow-up client upload `1.0.0-dev.20261018-lobby-privacy.mve69njn`, ID `01a15052-3421-7521-9513-070facc7e3a1`, processed to `ready` without an error. The [upload receipt](../../../../artifacts/jest-uploads/lobby-privacy-20261018/upload-receipt.json) records the unchanged ZIP.

After the user's explicit deployment instruction, `joinLiveRace`, `getLiveRaceChallenge`, and `listLiveRaceChallenges` deployed successfully to their existing `us-central1` and `europe-west1` regions in `riddle-quest-ec2b2`. Independent Cloud Functions metadata reads verified all six instances ACTIVE on Node.js 22, with changed revisions and all traffic on the latest revision. The runtime SHA-256 is `a193c45628a351615cea8ee0a12f02b425d7972c704702b8f9173b2af1b31f6e`. The [deployment evidence](../../../../artifacts/sms-lobby-deployment-2026-10-18.json) records each revision and verification result.

The user then requested frontend deployment. After backend verification, Jest activated `01a15052-3421-7521-9513-070facc7e3a1` at `2026-10-18T19:11:07.027Z`. Independent Jest metadata readback confirmed this exact version active, ready, and without a processing error, and the previous version inactive. The [activation receipt](../../../../artifacts/jest-uploads/lobby-privacy-20261018/activation-receipt.json) records both versions. [Open the current game](https://jest.com/g/riddle-q).

The earlier automatic approval-review rejection was resolved by the user's explicit backend deployment request. Deployment used precompiled Functions with the validated Node.js 22 runtime, without test-running predeploy hooks. No tests or browser harnesses ran, and no publication or review submission occurred.
