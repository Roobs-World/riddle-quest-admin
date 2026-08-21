# Reddit Games incident response

Last updated: 2026-08-20

1. Preserve the immutable package receipt, Firebase revision, timestamps, feature
   flags, and minimized logs. Do not copy raw assertions, secrets, or player IDs into
   tickets or chat.
2. Contain through `REDDIT_DISABLED_FEATURES`. Disable identity if authentication is
   suspect; disable commerce, referrals, notifications, matchmaking, tournaments,
   or presence independently when only that boundary is affected. Ads are always off.
3. For a gateway-secret exposure, rotate `REDDIT_GATEWAY_SECRET` in Firebase and the
   Devvit `redditGatewaySecret` setting as one coordinated cutover, redeploy affected
   Functions, invalidate the old version, and replay negative signature tests.
4. For a UID-secret exposure, disable Reddit identity, rotate `REDDIT_UID_SECRET`, and
   stop. UID derivation changes account identity; recovery/migration requires a
   reviewed incident plan and must not be improvised.
5. For an uncertain upload, keep the release barrier blocked and reconcile the exact
   version in Reddit developer tooling before any retry.
6. For deletion races, keep the affected generation blocked, retain minimal retry
   evidence, and rerun only the idempotent deletion path after confirming old
   executions cannot write. Never manually decrement account generation.
7. Notify the repository owner, privacy contact, Firebase owner, and Reddit support as
   applicable. Counsel decides regulatory/player notices and timing.
8. Restore only after focused regression, artifact audit, same-origin gateway tests,
   real-platform smoke tests, and a written incident review identify cause and scope.
