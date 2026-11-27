# Facebook rewarded-ad setup — 27 November 2026

The approved Meta rewarded placement now displays a real ad in the hosted version 9 game. After video playback, the continuation callable succeeded and the same Classic riddle resumed with an active input row and the balance unchanged at **625 coins**. The existing client and server continuation logic provides one additional attempt. Broader device and failure acceptance remains open.

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

## Hosted display and continuation observed

The first role-account session showed only coin options because it had loaded the earlier disabled startup projection. After browser access returned, a fresh **Play** launch from the Meta dashboard resolved a stale outer loader stuck at 0%. The existing version 9 game then showed **Watch a video for an extra try** in the Classic **Out of Attempts** modal, alongside the **50-coin** continue option, with a balance of **625 coins**.

One invocation of the game's video button displayed a real sponsored Meta rewarded video and reached a 100% progress endcard. Meta still presented a generic **Skip ad** / lose-reward warning. Choosing **Continue watching** replayed the same video once; the game's ad button was not invoked again. A subsequent media inspection confirmed **23.728 seconds** elapsed out of **23.728 seconds**, with `ended=true`. **Return to Game** then resumed the same Classic riddle with an active fresh input row and **625 coins**. No console errors were observed. The warning did not disappear during this observation; this does not establish that skipping before completion earns a reward or that an SDK cancellation occurred. See [Meta's rewarded-ad flow](https://developers.facebook.com/documentation/games/monetize/in-app-ads/rewarded-ads).

A narrow production log inspection of `grantFacebookRewardedContinue` since 07:10 UTC found one preflight and one successful grant response on revision `grantfacebookrewardedcontinue-00022-moq`:

| Request | UTC timestamp | HTTP status |
| --- | --- | --- |
| Preflight | `2026-11-27T07:21:20.241121Z` | 204 |
| Continuation grant | `2026-11-27T07:21:24.509906Z` | 200 |

### Why the resumed grid has five empty rows

The visible grid always renders five rows. A successful `continueGranted` transition clears displayed guesses but preserves the cumulative `attemptsUsed` count of five and sets `hasUsedContinue=true`. The server's next-guess limit is five plus one continued attempt. The empty grid therefore does not award five new attempts.

This behavior is present in hosted source `af20085bce70fbe73aedebce68975a414d9dac20` and current `main` at `4d96e6cf5`:

- [GameFrameControls.tsx](../../../src/gameplay/components/GameFrameControls.tsx), line 187 in both revisions: fixed five-row presentation.
- [gameSession.ts](../../../src/gameplay/session/gameSession.ts), hosted line 842 / main line 884: continuation clears visible guesses while retaining the snapshot's attempt count.
- [useAttemptRecovery.ts](../../../src/gameplay/hooks/browser/useAttemptRecovery.ts), line 85 in both revisions: successful authority response dispatches `continueGranted`.
- [singlePlayerSession.ts](../../../firebase-functions/src/gameplay/sessions/singlePlayerSession.ts), lines 392 and 403 in both revisions: rewarded continuation costs zero, preserves submitted-attempt count and records the consumed continuation.
- [singlePlayerGuessTransition.ts](../../../firebase-functions/src/gameplay/sessions/singlePlayerGuessTransition.ts), line 59 in both revisions: the server caps the continued session at six total attempts.

These source semantics, the successful hosted grant response and the resumed game establish the one-attempt continuation path. No private player/session document was inspected, and the restored attempt was left unused; a seventh-guess rejection was not exercised. The newer modal wording on the `facebook` branch was not uploaded during this setup.

## Remaining acceptance

The [existing implementation evidence](facebook-rewarded-continue-2026-10-02.md) describes the bounded SDK-mediated reward and retry behavior. `showAsync()` success is not an independently verifiable ad receipt; the server controls session eligibility and one-use accounting, and this path never grants coins. Mobile, early cancellation, no-fill, other failure and emergency-switch checks in [launch checklist P5-05](../facebook-launch-todo.md) remain open. The generic endcard warning observed after completed playback is not a cancellation/failure acceptance result.

No test suite, browser harness, new game upload, publication or review submission was performed for this configuration update. Existing Jest backend integrations and payment readiness were not changed.
