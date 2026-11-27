# Platform integration matrix

On the `facebook` branch, the Jest browser SDK/runtime/release target is removed, while every Jest backend integration and the test tooling remain. Each release owns its provider SDK and exposes only capabilities approved for that provider. Missing capabilities stay absent from the shared UI; another target's SDK must never fill the gap.

| Target | Provider integration | Identity and saves | Commerce and social | Ads |
| --- | --- | --- | --- | --- |
| Jest backend | Server-only signed API integration | Signed player exchange, account lifecycle and avatar sync | Purchase/subscription reconciliation, referral grants, race/presence and manager-owned notification plans | No client SDK or ad capability |
| Facebook | FBInstant v8.0 | Nonce-bound signed player exchange, custom Firebase App Check and FBInstant player data | Signed one-time payments, contexts, matchmaking, tournaments, referrals, manager-owned A2U notifications, presence, and overlay identity | Result interstitials and opt-in rewarded video; controlled by backend flags, age policy, provider API availability, and placement IDs |
| Reddit | Devvit Web and Payments | Server-side Reddit identity exchange and same-origin storage gateway | Reddit Gold purchases, matchmaking, tournaments, and presence | No game ad integration |
| YouTube | YouTube Playables Game API | Playable Save | Provider lifecycle, locale, audio, readiness, and health reporting | Forbidden by the self-contained Playables contract |
| Netflix | Partner contract required | Engineering-only local save adapter | Blocked until the private Netflix Games SDK and credentials are supplied | No ads unless Netflix's partner contract explicitly approves them |
| Yahoo | Partner contract required | Engineering-only local save adapter | Provider identity, commerce and social features stay absent until an approved contract is available | No approved Yahoo in-game ad integration |
| GameSnacks | GameSnacks SDK | Target-owned save and lifecycle adapter | Only capabilities permitted by the self-contained target | No Facebook ad integration |

The [platform layout](platform-layout.md) defines canonical source ownership. A retained provider-only server module does not authorize adding its capability to a self-contained browser artifact.

Facebook ad activation requires both deployment environment variables:

```text
VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID
VITE_FACEBOOK_REWARDED_PLACEMENT_ID
```

The authoritative Facebook client configuration must also enable `interstitials` or `rewarded_ads`. Rewarded video is restricted to the `continue` placement. Showing a video does not grant currency or entitlement in the browser; any future valuable reward must be recorded by an idempotent server-authoritative flow.

Facebook replacement coverage, current SDK references and the distinction between local verification and Meta-hosted acceptance are recorded in the [Facebook operations guide](../../facebook/facebook-instant-games-operations.md#facebook-branch-api-coverage).
