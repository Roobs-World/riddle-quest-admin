# Facebook rewarded extra try — 2 October 2026

## Result and deployment state

The requested Classic/Daily loss-screen choice is implemented locally: watch an opt-in Facebook rewarded video for one extra try, or spend 100 coins for the same extra try. Both share the existing one-continue-per-session limit. Video does not mint coins, charge coins or provide repeated unlimited guesses. This does not change races or any other target's ads.

No backend deployment, Meta placement/settings write, real ad impression, feature-switch activation, Testing upload or public promotion was performed during this work. Existing configured rewarded placement: `1748953042991569_1765482768005263`. Its real approval/fill must still be checked. Production availability must not be inferred from passing local tests or the existence of this ID.

Follow the numbered P5-05 setup/rollout/device procedure in [the shared launch checklist](../facebook-launch-todo.md). The implementation claim is released; owner/operator/device portions remain unclaimed.

## Behaviour

1. The exhausted-session modal shows the translated video choice only when the Facebook-specific capability is available. Paid continuation remains 100 coins. The video option can be used with no coins; the paid option requires sufficient balance.
2. Facebook authenticated startup configuration, 13+ audience, advertised rewarded SDK support and a configured placement govern availability. Shared UI imports no Facebook ad SDK. All 16 locales have the new button key.
3. The adapter loads and shows the opt-in video. Only successful `showAsync()` completion proceeds to the claim. `USER_INPUT` cancellation is quiet; cancellation/no-fill/load/display failure grants nothing and leaves the paid alternative available.
4. A synchronous client lock covers provider display and the server request. Coin/Skip/close/Escape choices cannot race that operation. Stale account/session/unmount responses cannot apply a local continuation.
5. `grantFacebookRewardedContinue` requires Facebook authentication, App Check, the account-operation/deletion guard, the server `rewarded_ads` switch and a matching valid exhausted session. Strict input contains mode, riddle, session token and request ID, not an amount or arbitrary identity.
6. The existing authoritative session transaction grants the same single extra attempt used by paid continuation. Rewarded funding costs zero and records `continueFunding=facebook-rewarded`; it does not change the coin balance. Paid/rewarded choices cannot stack. Claims before exhaustion, for the wrong session/riddle or after expiry fail.
7. After SDK completion, a temporary failed claim can be retried with the same in-memory request ID without rewatching. Authoritative idempotency prevents duplicate grants. This retry observation does not survive a full page reload; a saved browser flag would not be trustworthy proof of an impression.
8. Existing dialog exclusion and 90-second post-reward interstitial suppression remain in place. No 50-coin ad-grant path is enabled.

## Security boundary requiring owner acceptance

[Meta's HTML5 rewarded-ad guide](https://developers.facebook.com/documentation/games/monetize/in-app-ads/rewarded-ads) describes granting the gameplay reward after SDK display success. The guide was read through the authenticated official documentation connector. That browser success is not a signed receipt independently verifiable by the server.

The server controls eligibility, account/session binding, expiry, one-use limits and coin accounting, **not proof that an impression occurred**. When enabled, a modified authenticated client could invoke the bounded extra-try endpoint without watching. App Check does not turn it into an ad receipt. The owner must explicitly accept this bounded SDK-mediated gameplay reward, or leave the feature disabled pending an applicable HTML5 verification contract. Coin rewards remain separately blocked/omitted without server-verifiable authority. Native Android/Unity verification documentation is not an HTML5 contract.

An emergency-off switch can also reject a claim after an ad has already completed. Real hosted acceptance and an operational support policy for that edge case remain required.

## Verification

All results are local checks on the shared, changing workspace, not a frozen release certification. No production traffic was generated.

| Check | Result |
| --- | --- |
| `pnpm check:types` | Passed across workspace packages |
| `pnpm --dir firebase-functions build` | Passed; module-cycle audit passed |
| `pnpm --dir firebase-functions lint` | Passed |
| `pnpm check:facebook-copy` | Passed: 736 required strings, 16 locales |
| Facebook secret and commerce-activation audits | Passed; unverified commerce remains unreachable |
| Focused Facebook portal tests | 4 suites, 28 tests passed |
| Focused rewarded callable/session transaction tests | 2 suites, 30 tests passed |
| `pnpm --dir firebase-functions test:deploy-scripts` | Passed, including the updated 23-export Facebook backend audit fixtures |
| `pnpm verify:functions:node22` | Passed under Node 22.23.1: 118 suites, 1,449 tests |
| Final `pnpm --filter @qwordly/portal test` | Passed: 225 suites, 1,848 tests; 14 suites/103 tests intentionally skipped by this configuration |
| Final `pnpm --filter @qwordly/portal test:facebook:playwright` | Passed: rebuilt Facebook injected harness, 1 suite/1 integration test |
| Final `pnpm build:jest`, `build:facebook`, `build:reddit`, `build:youtube`, `build:netflix`, `build:yahoo` | All passed, including target-isolation/artifact/content audits |

The injected browser exercise uses the actual built Facebook UI and controlled provider/backend replies. It verifies five confirmed wrong guesses, the video/100-coin choices, no coin charge/grant on cancellation/no-fill, disabled competing controls, Escape exclusion, SDK completion preceding authenticated/App Check claims, a failed server response followed by same-ID retry without another video, unchanged balance and restored editable extra-try row. Final run also checks that all three loss actions fit a 390×844 viewport. Screenshots were visually inspected locally at desktop and phone widths; ephemeral files are `/tmp/facebook-rewarded-loss-options.png` and `/tmp/facebook-rewarded-extra-try.png`.

An earlier broad client run failed seven cases in the concurrently edited `raceAuthorityObservation.test.ts` because of unavailable localStorage. Its author subsequently changed that unrelated test; the final broad run passes all 1,848 cases. The earlier Daily-calendar compilation failure also no longer reproduces. Historical launch notes are retained rather than erased.

## Remaining acceptance

1. Verify the placement belongs to this Instant Games app and is approved/filling using Meta-approved testing.
2. Record owner acceptance of the SDK-mediated, non-receipt trust limitation above.
3. Review/deploy the full backend unit including the new callable, initially with rewarded ads disabled; validate the server switch and revision.
4. Enable only approved rewarded configuration, build an immutable Testing package and upload it through the existing release procedure. Do not enable purchases or public traffic as a side effect.
5. Accept actual completion/cancellation/no-fill, zero-coin/paid alternatives, reload, duplicate/tab/device races, deletion, pause/resume and emergency-off behaviour on supported Facebook web/iOS/Android surfaces.
6. Attach candidate hash and sanitized real-host evidence to P5-05; reconcile the older coin-reward tracker requirement as explicitly omitted or independently verified. Obtain separate release sign-off before public promotion.
