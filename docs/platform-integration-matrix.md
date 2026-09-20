# Platform integration matrix

Each release owns its provider SDK and exposes only capabilities approved for that provider. Missing capabilities stay absent from the shared UI; another target's SDK must never fill the gap.

| Target | Provider integration | Identity and saves | Commerce and social | Ads |
| --- | --- | --- | --- | --- |
| Jest | Jest HTML5 SDK | Signed player exchange and Jest player data | Registration, profiles, referrals, notifications, purchases, subscriptions, and milestones | No approved Jest ad API |
| Facebook | FBInstant | Player signature exchange and FBInstant player data | Payments, contexts, matchmaking, tournaments, referrals, notifications, presence, and overlay identity | Result interstitials and opt-in rewarded video; controlled by backend flags, age policy, provider API availability, and placement IDs |
| Reddit | Devvit Web and Payments | Server-side Reddit identity exchange and same-origin storage gateway | Reddit Gold purchases, matchmaking, tournaments, and presence | No game ad integration |
| YouTube | YouTube Playables Game API | Playable Save | Provider lifecycle, locale, audio, readiness, and health reporting | Forbidden by the self-contained Playables contract |
| Netflix | Partner contract required | Engineering-only local save adapter | Blocked until the private Netflix Games SDK and credentials are supplied | No ads unless Netflix's partner contract explicitly approves them |
| Yahoo | Partner contract required | Engineering-only local save adapter | Blocked until a Yahoo Games partner SDK and delivery contract are supplied | No ads unless Yahoo's game partner contract explicitly approves them |

Facebook ad activation requires both deployment environment variables:

```text
VITE_FACEBOOK_INTERSTITIAL_PLACEMENT_ID
VITE_FACEBOOK_REWARDED_PLACEMENT_ID
```

The authoritative Facebook client configuration must also enable `interstitials` or `rewarded_ads`. Rewarded video is restricted to the `continue` placement. Showing a video does not grant currency or entitlement in the browser; any future valuable reward must be recorded by an idempotent server-authoritative flow.
