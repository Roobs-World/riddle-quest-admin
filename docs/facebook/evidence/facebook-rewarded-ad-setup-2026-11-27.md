# Facebook rewarded-ad setup — 27 November 2026

The existing Meta rewarded placement is approved and the two deployed Functions now enable rewarded continuation. Actual ad display and the resulting extra attempt remain unverified: the browser connection became unavailable before the hosted game could reload its startup configuration. This is not a no-fill result.

## Meta configuration observed

| Setting | Observed value |
| --- | --- |
| Instant Games app | Riddle Quest, `1748953042991569`; Development mode, configured for ages 13+ |
| Audience Network property | RiddleQuest, `957348766757902` |
| Ad space | Riddle Quest Continue, `1765482364671970` |
| Existing placement | Riddle Quest Continue Rewarded, `1748953042991569_1765482768005263`, Rewarded Video |
| Review checklist | Green checks for onboarding, placement, payment account, game bundle and Audience Network Approval |
| Hosted game | Version 9, bundle `29168977262783270`; the role-account runtime advertises `getRewardedVideoAsync` |

The placement was reused; no duplicate placement was created. The original checkout's `platforms/web/facebook/.env.facebook` contains the same public ID in `VITE_FACEBOOK_REWARDED_PLACEMENT_ID`. Audience Network's payment-account check does not establish readiness for Instant Games in-app purchases. Commerce remains disabled.

## Configuration rollout and source preservation

In project `riddle-quest-ec2b2`, region `us-central1`, each function below changed from `FACEBOOK_DISABLED_FEATURES=commerce,rewarded_ads` to `FACEBOOK_DISABLED_FEATURES=commerce`. The grant was updated before the startup projection. The [Cloud Functions v2 PATCH API](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch) used only the `serviceConfig.environmentVariables` update mask, preserving the other environment entries. This was a configuration update to the existing deployed source, not a source upload.

| Function | Verified state and revision | Updated at (UTC) | Build ID |
| --- | --- | --- | --- |
| `grantFacebookRewardedContinue` | ACTIVE; `grantfacebookrewardedcontinue-00022-moq` | `2026-11-27T06:39:30.252112044Z` | `ea99d099-ca8a-40a0-908c-a759e1b31378` |
| `getFacebookClientConfiguration` | ACTIVE; `getfacebookclientconfiguration-00039-ger` | `2026-11-27T06:51:21.054317238Z` | `7737f92a-4640-498e-9f1a-6748352cc0f4` |

Google regenerated build metadata and source generations during the updates. Independent downloads of both original archives and both resulting archives were byte-for-byte identical: **1,223,827 bytes**, SHA-256 **`c2fc176be530aebec257d0a14590c8f044b3fee239f4f9f0157be0d68f31e9a7`**. The runtime remains `nodejs22`.

| Function | Original source generation | Resulting source generation |
| --- | --- | --- |
| `grantFacebookRewardedContinue` | `1795665754059664` | `1795761503460266` |
| `getFacebookClientConfiguration` | `1795665828526815` | `1795762226012771` |

The source bucket is `gcf-v2-sources-329028367192-us-central1`; each object is `<FunctionName>/function-source.zip`. The original checkout's ignored local Functions environment was also updated to retain only `commerce` in the disabled-feature list. These observations verify the two named functions, not every deployed function's environment.

## Hosted observation and remaining acceptance

The real app-role session reached the Classic **Out of Attempts** modal on version 9 with **625 coins** and a **50-coin** continue option. It showed no ad choice because that running tab had loaded the earlier disabled startup projection. Browser access was lost before a reload and ad request. No ad impression, completed video, server reward claim or restored attempt was observed. The newer modal wording on the `facebook` branch was not uploaded during this setup.

When browser access returns:

1. Reload the authorized role-account game session to obtain the enabled startup projection and resume the exhausted riddle.
2. Record the balance and choose the rewarded-video option once. Follow [Meta's rewarded-ad flow](https://developers.facebook.com/documentation/games/monetize/in-app-ads/rewarded-ads); allow the ad to complete normally without clicking its destination.
3. Confirm the game returns to the same riddle with exactly one additional attempt and an unchanged coin balance. Confirm the server continuation records `facebook-rewarded` funding.
4. Complete the authorized cancellation/failure checks: no completed video means no extra attempt or coin change. Record an actual provider error if one occurs; do not infer no-fill from missing browser access.

The [existing implementation evidence](facebook-rewarded-continue-2026-10-02.md) describes the bounded SDK-mediated reward and retry behavior. `showAsync()` success is not an independently verifiable ad receipt; the server controls session eligibility and one-use accounting, and this path never grants coins. The broader device, failure and emergency-switch acceptance in [launch checklist P5-05](../facebook-launch-todo.md) remains open.

No test suite, browser harness, new game upload, publication or review submission was performed for this configuration update. Existing Jest backend integrations and payment readiness were not changed.
