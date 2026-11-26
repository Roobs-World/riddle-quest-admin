# Platform integration matrix

Each release owns its provider SDK and exposes only capabilities approved for that provider. Missing capabilities stay absent from the shared UI; another target's SDK must never fill the gap.

| Target | Provider integration | Identity and saves | Commerce and social | Ads |
| --- | --- | --- | --- | --- |
| Jest | Jest HTML5 SDK | Signed player exchange and Jest player data | Registration, profiles, referrals, notifications, purchases, subscriptions, and milestones | No approved Jest ad API |
| Reddit | Devvit Web and Payments | Server-side Reddit identity exchange and same-origin storage gateway | Reddit Gold purchases, matchmaking, tournaments, and presence | No game ad integration |
| YouTube | YouTube Playables Game API | Playable Save | Provider lifecycle, locale, audio, readiness, and health reporting | Forbidden by the self-contained Playables contract |
| Netflix | Partner contract required | Engineering-only local save adapter | Blocked until the private Netflix Games SDK and credentials are supplied | No ads unless Netflix's partner contract explicitly approves them |
| Yahoo | Partner contract required | Engineering-only local save adapter | Provider identity, commerce and social features stay absent until an approved contract is available | No approved Yahoo in-game ad integration |
| GameSnacks | GameSnacks SDK | Target-owned save and lifecycle adapter | Only capabilities permitted by the self-contained target | No Facebook ad integration |

The [platform layout](platform-layout.md) defines canonical source ownership. A retained provider-only server module does not authorize adding its capability to a self-contained browser artifact.

The Facebook browser frontend, SDK adapter and ad UI are removed from this branch. Its authoritative server modules and notification services remain intact. Shared schemas still used by those server modules retain their existing wire contracts.
