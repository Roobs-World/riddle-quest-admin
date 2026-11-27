# Facebook deployed authority metadata, 27 November 2026

Read-only control-plane metadata checks covered 32 deployed functions for Riddle Quest. The [exact metadata record](facebook-deployed-authority-2026-11-27.json) contains the observed revisions, build IDs, source-object generations, project and app bindings, and eight selected non-secret configuration fields. This establishes selected deployment metadata, not complete backend acceptance.

## Inspection scope

The inspection used Firebase connector project and function-list reads, followed by `gcloud functions describe --v2` with an explicit field projection. It used metadata GET routes only. No function was invoked.

The 32 functions comprise the 25 canonical [`EXPECTED_FACEBOOK_EXPORTS`](../../../platforms/web/facebook/server/scripts/audit-facebook-backend-exports.js), plus:

- `deleteAccount`
- `setNotificationPreference`
- `syncFacebookManagerRegistration`
- `dispatchFacebookManagerNotification`
- `deliverLiveRaceChallengePush`
- `deliverRaceSettlementEvent`
- `deliverRacePerformanceEvent`

`getFacebookClientConfiguration` was inspected through deployment metadata and was not called. Its [current local handler](../../../platforms/web/facebook/server/facebookClientConfigurationCallable.ts) synchronizes an RTDB presence gate, so invoking it would not be a pure metadata read.

## Observed deployment state

All 32 functions were `ACTIVE`, used runtime `nodejs22`, and reported `allTrafficOnLatestRevision: true`. Every selected function had `FACEBOOK_APP_ID=1748953042991569`.

| Function scope | `FACEBOOK_DISABLED_FEATURES` | Selected revision and update |
| --- | --- | --- |
| `getFacebookClientConfiguration` | `commerce` | Revision suffix `00039-ger`, updated 27 November at 06:51 UTC |
| `grantFacebookRewardedContinue` | `commerce` | Revision suffix `00022-moq`, updated 27 November at 06:39 UTC |
| The other 30 inspected functions | `commerce,rewarded_ads` | Exact revisions and timestamps are in the metadata record |

All 32 lacked `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED` and `FACEBOOK_PAYMENT_ENVIRONMENTS`. The [current local payment code](../../../platforms/web/facebook/server/facebookPayments.ts) interprets those omissions as webhook readiness false and accepted payment environment `PROD`. That is a local-source interpretation, not verification of the deployed bytes or a successful payment callback.

All recorded deployment updates predate this thread's 27 November 10:23 UTC start. No Firebase source, configuration, provider server module, or deployed setting changed during this inspection. No build, deployment, function invocation, or database write was performed.

## Remaining acceptance boundary

This inspection does not cover every shared gameplay or race endpoint. It does not establish correspondence between deployed source objects and a Git commit, account-specific entitlements, signed-receipt verification, idempotency, callback delivery, or notification dispatch. An active function and a latest-revision traffic setting do not establish those runtime outcomes.

The [API submission checklist](../facebook-api-submission-checklist-2026-11-27.md) therefore retains its full backend acceptance gate. The selected metadata check is complete; runtime authority and the remaining deployment scope stay open under the owner's Firebase preservation instruction.
