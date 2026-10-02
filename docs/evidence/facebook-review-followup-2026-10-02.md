# Facebook authentication and review follow-up — 2 October 2026

Facebook MCP authentication is working for Riddle Quest (`1748953042991569`).
The official Meta connector confirms the admin viewer role and **read** caller
permission. This establishes access for inspection, not App Review acceptance.
The app remains in development mode. The conflicting App Review responses and
the visible unsubmitted draft remain unresolved.

The authenticated Chrome Basic settings page visibly contains the selected
**Data deletion callback URL** and the saved value
`https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/facebookDataDeletionCallback`.
This narrows the earlier MCP finding: its empty `data_deletion_url` field does
not establish that the callback is absent. No field was edited or saved.
An unsigned GET to that exact saved address returns **405**. A read-only Functions
metadata check confirms the callback is ACTIVE, scoped to the same Meta app ID,
and configured with its deletion-status URL. Neither probe proves signed
deletion, replay safety of the deployed revision, or independent acceptance.
Preserve the existing callback while completing those checks.

Fresh metadata for `getFacebookClientConfiguration`,
`claimFacebookNotificationPermissionPrompt`, and
`acceptFacebookNotificationPermissionPrompt` confirms all three are ACTIVE and
have `FACEBOOK_DISABLED_FEATURES=commerce,rewarded_ads`. Their deployment times
are approximately 17:21 UTC. This inspection did not deploy anything or read
secrets. Native notification prompt testing is permitted by those switches;
first authoritative win, seven-day retry, permanent acceptance, 13+ audience,
and all three advertised FBInstant bot APIs still determine eligibility. A
hosted configuration response and physical-device consent remain to be verified.
Scheduled notification delivery is a separate outstanding task.

Purchases remain staged because the real signed purchase/refund contracts and
their public server verifier are missing. Rewarded coin grants cannot trust
browser completion. The bounded rewarded extra-try path remains disabled pending
its owner rollout and device acceptance. Connector authentication does not remove
those gates or change Jest's purchases and notifications.

The cross-platform build checks had a concrete gap: Netflix and Yahoo builds
honoured their output override, but their package audit commands hardcoded the
default folder. A stale clean artifact could mask provider SDK contamination in
the actual build. The standalone audit now uses an explicit directory first,
then only the selected target's trimmed output environment value, then its normal
default. Both package commands let the audit resolve that directory. A missing
selected directory fails; it never silently falls back.

Four actual CLI/filesystem regression tests reproduce the pre-fix failures and
pass after the change. The package-command tests leave a clean default artifact
and place Facebook SDK code in the selected output; the audit must reject it.
Precedence tests cover explicit paths, trimmed and empty overrides, another
target's environment, and missing selected output. Initial fixture-setup failures
are retained separately and are not the diagnostic baseline.

Validation:

- All **40 artifact-audit tests** and **146 release-script tests** pass.
- Facebook: **24 unit suites / 213 tests** pass; its browser test is excluded
  from that unit invocation and separately passes below.
- Jest: **10 SDK, purchase, notification and matchmaking suites / 149 tests** pass.
- Both injected Facebook and Reddit Chromium journeys pass. These are local SDK
  and same-origin API contracts, not real Meta/Reddit device acceptance.
- All six isolated builds and audits pass: Facebook, Jest, Reddit, YouTube,
  Netflix and Yahoo. Each standard build now audits its own selected output;
  independent explicit-directory audits also pass.
- Facebook and Jest each contain **404 byte-identical files**, and Reddit
  **415 byte-identical files**, compared with the previous redirect verification.
  This change modifies build validation, not their runtime artifacts.
- The existing **31 Jest recorded-race browser cases remain unresolved** against
  the new Live PvP entry. No full Jest authentication-suite pass is claimed.

Evidence, file hashes, exact commands, retained failures and narrowly selected
provider metadata are under `artifacts/target-audit-output-2026-10-02/`.
These builds are diagnostic, not an immutable clean-source upload candidate.
No deployment, upload, publication, provider setting, purchase, ad reward,
notification delivery, signed deletion or secret read occurred.

Provider/device acceptance, actual signed fixtures, review reconciliation,
secret issuance/least privilege, translation completion and a clean reviewed
release remain outstanding. Reddit additionally retains its owner MFA/host
approval and hosted-contract evidence gates.
