# Platform payment rails — 22 September 2026

## Enforced release behavior

| Target | Payment rail | Release behavior |
| --- | --- | --- |
| Jest | Jest Payments | The game renders the SDK catalog's `price` and `currency`. Purchase grants and interrupted-purchase recovery remain server-authoritative and idempotent. |
| Facebook Instant Games | Meta IAP | The staged adapter renders Meta's formatted catalog `price`, including regional currencies. Commerce remains unavailable until the signed purchase-verification contract is captured and activated. Stripe is not used. |
| Reddit Devvit Web | Reddit Gold | Products and checkout use Devvit Payments and Reddit Gold. The Devvit server owns fulfillment and recovery. Stripe is not used. |
| YouTube Playables | No IAP | Purchase code is prohibited by the release contract and rejected by the artifact audit. |
| Netflix candidate | No IAP | The provider-neutral candidate is self-contained and rejects checkout, network, Firebase, analytics, and advertising code until an approved partner contract exists. |
| Yahoo candidate | No IAP | The provider-neutral candidate is self-contained and rejects checkout, network, Firebase, analytics, and advertising code until an approved partner contract exists. |
| Direct web/PWA listings | No active checkout | Directory listings reuse the commerce-disabled canonical build. Stripe may be activated only in a dedicated authenticated web target with signed webhooks, server-authoritative idempotent grants, refunds, and live checkout evidence. |

The word “coins” always describes the in-game balance. Purchase buttons display
the provider-owned price string or provider currency. No client converts a USD
catalog amount into another currency.

## Release gate changes

The canonical monetization policy now matches the dashboard for Yahoo and
Netflix: both candidates are explicitly commerce-disabled. The monetization
audit additionally requires Facebook to preserve Meta's formatted price,
requires Yahoo to use its standalone entry, and requires the Yahoo/Netflix
artifact audit to reject checkout code. This removes the earlier contradictory
policy statement that described dormant Yahoo Stripe source as active in the
deployed provider-neutral candidate.

## Verification

- Monetization policy audit passed for all 55 tracked targets.
- 102 focused Jest, Facebook, and Reddit commerce tests passed; two browser-only
  cases remained gated in the unit invocation and are exercised by the aggregate
  browser verification.
- 39 artifact-boundary and Facebook activation tests passed.
- The full isolated-target verification passed: Jest, Facebook, Reddit,
  YouTube, Netflix, Yahoo, and the additional GameSnacks candidate built and
  passed their artifact boundaries; 44 browser cases passed across the six
  primary targets, and the Devvit package contract passed.
