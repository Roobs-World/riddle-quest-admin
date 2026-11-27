# Facebook API parity and ad policy — 27 November 2026

This change on the owner-requested `facebook` branch adds an interstitial opportunity every three completed levels and excludes active subscribers from both interstitial and rewarded ads. The audit found that supported Facebook replacements for the former Jest client's features are already wired. Jest backend integrations remain supported.

## Former Jest operations and Facebook coverage

The audit traced the client adapter before its removal (`b54e9d501^`), then followed the current Facebook entry and adapters rather than treating every Meta API as a requirement.

| Former Jest responsibility | Current Facebook integration |
| --- | --- |
| Initialization, loading progress and game-ready signal | `FacebookPlatformBootstrap`: `initializeAsync`, `setLoadingProgress`, `startGameAsync` |
| Player and signed identity | `getID`, nonce-bound `getSignedPlayerInfoAsync`, server exchange and renewable Firebase App Check |
| Preferences, progress and deletion cleanup | Serialized `getDataAsync`, `setDataAsync`, `flushDataAsync`; shared save and account-deletion controllers |
| Entry payload, referral attribution and invitations | Validated `getEntryPointData`, server-issued referral tokens, `shareAsync`/`inviteAsync`, server binding and settlement |
| Screenshots and profile presentation | Local PNG share-card rendering; Meta-owned name/photo overlays rather than extracting those values into game profiles |
| Product catalog, checkout and unfinished purchases | `payments.onReady`, `getCatalogAsync`, `purchaseAsync`, `getPurchasesAsync`; authoritative grant precedes `consumePurchaseAsync` |
| Notification scheduling and cancellation | Verified player consent and the notification manager's Meta A2U dispatch; no gameplay notification receiver or reward handler |
| Analytics and lifecycle | Advertised `logEvent` receives sanitized shared events; `onPause`/`onResume` coordinate gameplay, audio, saves and presence |

Jest registration overlays and its first-milestone marker are provider-specific. Facebook uses its signed launch identity, while achievements remain game-owned. The current official [Instant Games IAP guide](https://developers.facebook.com/documentation/games/monetize/in-app-purchases) explicitly excludes recurring subscriptions; no Facebook subscription checkout was added. Existing server-recognized subscription entitlement is sufficient to suppress ads. One-time Facebook commerce retains its [payment approval and webhook-readiness gates](../facebook-payments.md).

## Interstitial opportunities

- Count unique successful Classic and Daily level completions together within the authenticated session. Opportunities occur at 3, 6, 9 and subsequent multiples of three.
- Failed guesses, losses and races do not count. A result shown again does not increment the counter again.
- Preserve the existing 90-second interval between interstitial impressions, 90-second separation after rewarded video, and ten-impression session cap.
- Consume an opportunity even if policy suppresses it or Meta has no fill; do not surprise the player with a carried-over ad on the next level.
- Recheck that the originating result is still current after asynchronous work. Dismissal prevents a loaded ad appearing over the next level.

This retains the existing puzzle-game interval above Meta's documented 30-second minimum and follows its [interstitial timing guidance](https://developers.facebook.com/documentation/games/monetize/in-app-ads/interstitial-ads).

## Authoritative ad eligibility

The backend applies the existing `hasActiveSubscription` rule to the authenticated account. It folds subscriber exclusion into `interstitialsEnabled` and `rewardedAdsEnabled`, leaving the existing nine-field client-configuration response intact. Subscription status is not accepted from browser save data or a client claim.

| Verified entitlement | Interstitial | Optional rewarded video |
| --- | --- | --- |
| Active subscription | Suppressed | Suppressed |
| Remove Interstitial Ads durable purchase only | Suppressed | May be offered |
| Neither | Subject to cadence, flags and SDK eligibility | Subject to flags and SDK eligibility |
| Unknown configuration or failed refresh | Suppressed | Suppressed |

Eligibility refreshes at startup, on resume, before SDK ad creation and after ad loading. The adapter reads the current policy rather than retaining startup entitlement indefinitely. Rewarded-option visibility updates while the same recovery capability remains in place, so a subscription or flag update does not retire an in-flight operation. An earned but undelivered continuation remains retryable only for the same mode, question and server session, using its original request ID without another ad. A delivered receipt remains idempotent but does not keep a disabled reward action visible.

## Verification and release status

- `pnpm build:facebook` passed, including TypeScript, platform boundaries, commerce activation, locales, licenses and artifact isolation. The artifact contains 418 files, totals 4.44 MB, and has 0.66 MB of initial resources. Its audit found no Jest client, native module or secret leakage.
- `pnpm --dir firebase-functions build` passed, including directory layout, deployment-source preparation, TypeScript, module-cycle, artifact and function-capacity audits.
- `pnpm check:monetization` and `git diff --check` passed.

Regression coverage was added for cadence, repeated receipts, dismissed results, subscription changes while loading, stale configuration reads, failed reads and earned-claim retries. Tests and browser harnesses were not run, following repository instructions.

No backend deployment, Facebook upload, publication, review submission or live verification of the new cadence/subscription policy was performed for this change. The earlier [version 9 rewarded-ad verification](facebook-rewarded-ad-setup-2026-11-27.md) proves that an existing real placement displayed and granted a continuation; it does not prove this new policy is deployed.
