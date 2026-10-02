# Jest preservation and deployed Facebook prompt checks — 2 October 2026

Facebook MCP authentication is confirmed for Riddle Quest app
`1748953042991569`, with an admin viewer role and `read` caller permission.
This does not confer write access or establish provider acceptance.

The fresh, read-only Functions inspection supersedes the earlier deployed-off
finding. `getFacebookClientConfiguration`,
`claimFacebookNotificationPermissionPrompt`, and
`acceptFacebookNotificationPermissionPrompt` are ACTIVE; all three now have
`FACEBOOK_DISABLED_FEATURES=commerce,rewarded_ads`. Their deployment timestamps
are 2 October around 15:34 UTC. This inspection performs no deployment or
configuration change and does not identify the deployed source bytes. It proves
these switches permit prompt testing, independently of whether an actual player
is eligible and the host advertises the required FBInstant bot APIs. SDK consent,
first authoritative win, weekly retry and permanent accepted state still govern
the prompt. Delivery, physical-device acceptance and review approval are separate.

Purchases remain gated by the missing real signed purchase/refund contracts.
Rewarded coin grants cannot rely on a browser `showAsync()` result. The bounded
extra-try path also retains its owner rollout/device acceptance gate. MCP access
does not remove these requirements.

The Jest subscription-cancellation browser fixture omitted its
`subscription-cancel-inactive` branch and returned success. The real app therefore
correctly displayed renewal cancellation, contradicting the test's unavailable
assertion. The isolated original test timed out twice; a five-second diagnostic
located the message wait. A synthetic SDK/UI probe confirmed the cancellation
call and success presentation. The fixture now returns the existing documented
`not_active` error, preserving active paid access. The original assertion passes.
No runtime adapter, purchase grant, notification implementation or game text changes.
Temporary diagnostic code was removed from the test.

The complete authentication baseline was interrupted after 25 passes and 14
failures. One failure was the corrected fixture; the others observed so far
exercise the former recorded-race UI. Current `RaceTo10Game` opens Live PvP, while
this authentication harness intentionally omits production matchmaking and
provides recorded-race fake services. The failed inbox probe showed the live
intro, disabled start, no uncaught errors and unavailable opponent search. It is
not evidence that the real Jest live adapter fails, and it is not a full-suite
pass. No recorded-race case was deleted, skipped in source, or weakened.

An explicit scoped run passes **42 authentication/solo/provider-SDK cases**, with
**31 recorded-race cases excluded from that invocation**. It covers signed guest
startup, slow startup, registration and login recovery, restored language,
subscriptions, referrals, notifications, optional profile errors and account
deletion. Those 31 declarations still need migration/reachability review against
the current multiplayer product before the original full suite can be called
green. The scoped command and exact selection are retained, including the skips.
Ten SDK, purchase, notification and Firebase matchmaking unit suites pass
**149 tests**. These are injected/local checks, not real provider receipts.
The Facebook SDK lifecycle and Reddit same-origin browser checks also pass.
Reddit is separately rechecked against its owned private artifact. These checks
cover the current live entry/transport recovery path for those targets and do
not replace the unresolved Jest recorded-race verification.

All six isolated builds and artifact audits pass: Jest, Facebook, Reddit,
YouTube, Netflix and Yahoo. The Jest browser checks serve a suite-owned temporary
artifact outside the repository, avoiding concurrent canonical build replacement.
Other target builds also use unique temporary directories. Source may change in
other chats; the file hashes are diagnostic provenance, not a locked clean release
or permission to upload. Historical full-run failures and the initial output-path
guard rejection are retained rather than represented as successful checks.

Evidence is under `artifacts/jest-auth-readiness-2026-10-02/`, including per-case
progress, the scoped selection, red/fixed probes, unit results, build audits,
artifact hashes and the three narrowly selected deployed metadata responses.
No raw provider tokens, signed receipts or secret values are read. No real
purchase, ad reward, notification, deployment, upload or publication occurs.
