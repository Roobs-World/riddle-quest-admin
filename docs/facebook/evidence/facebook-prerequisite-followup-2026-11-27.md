# Facebook prerequisite follow-up — 27 November 2026

**Single-account checks can continue, but the connector results do not establish public access, product approval or completion of the six remaining API workflows.** This follow-up records fresh read-only Meta connector observations and official contract research. It does not claim fresh inspection of the product-specific IAP/Bot review, payout, Page/Group, Cross-Play or private-tournament dashboard views.

## Fresh connector observations

The [28 November recheck at 05:06:05 UTC](facebook-prerequisite-recheck-2026-11-28.json) returned the same permission, review, requirement, history and subscription states below. It does not refresh the product-specific dashboard views. The API expansion prerequisites remain unresolved; fresh-save and ad verification on the existing single-account Testing candidate can still proceed.

| Query | Returned state and limit |
| --- | --- |
| App | Riddle Quest `1748953042991569` is active; owner business `2198725140593714`. Active app status is not public game approval. |
| Zero Permission Access | `standard_access: true`, `advanced_access: false`, tier `BASIC`. Aggregate privilege remains rejected/non-live. Preserve role-account access and unresolved public access separately. |
| `pages_messaging` | Standard and advanced access both false, tier `NONE`; API testing `NOT_STARTED`, 0/1. The response reports `use_case_required`, no applicable configured main use case, and no supported connector configuration path; it directs configuration to App Dashboard. |
| Subscriptions | The connector subscriptions query returned `[]` (zero records). This is not a per-player consent result. |
| Review | Status `UNSUBMITTED`, `is_pending: false`, `is_approved: true`; submission history is empty. The approved boolean cannot resolve the contradictory overall/product states. |
| Submission requirements | `can_submit: false`, with a previous submission reported in review. This conflicts with the empty history and non-pending review response; no pending or approved product review is inferred. |
| Privacy/business verification | These requirement checks passed. They do not clear the other permission or product gates. |

Older dated dashboard observations remain in the [prerequisite record](facebook-dashboard-api-prerequisites-2026-11-27.md), [review state](facebook-live-review-state-2026-11-27.json) and [role-access follow-up](facebook-role-access-followup-2026-11-27.json). In particular, their IAP/Bot review, payout, association and private-tournament observations were not refreshed by these connector queries.

## Six unresolved API workflows

| API gap | Required meaningful workflow |
| --- | --- |
| `switchGameAsync` | A real, eligible, intended game owned/configured by the same business and an explicit cross-promotion surface. Portfolio inventory alone does not establish that destination. Qwordly is not an accepted destination for this work. See the [switch-game contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#switchgameasync). |
| `player.getASIDAsync`, `player.getSignedASIDAsync` | A genuine eligible legacy-migration use and a trusted identity-verification/account-link contract. Reading an identifier or signature alone does not establish migration. See [player identity contracts](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player). |
| `player.getAssociatedAppsASIDAsync`, `player.getSignedAssociatedAppsASIDAsync` | A genuine off-platform version of the same game, its Meta app ID, matching business ownership, truthful owner attestation and authoritative account linking. The association UI is irreversible; it must not be exercised merely to increase API coverage. The earlier Cross-Play view was Not Linked, not freshly rechecked here. See [Cross-Play Management](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management). |
| `player.createNEZPNotificationContentAsync` | Manager-authored content, current-context recipient scope, trusted app/recipient/content binding, generation-bound receipt handling, a dispatch consumer and trusted verification or manager approval. A browser-returned content ID cannot authorize a campaign. See the [stored-content boundary](facebook-messenger-consent-2026-11-27.md) and [A2U contract](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api). |

The Firebase/provider-server freeze remains absolute. No client-only identifier collection, content creation or dormant API declaration closes the missing authoritative contracts. Messenger game-update permission is also distinct from notification-manager consent and still needs its actual use case and permission approval. [Messenger game updates](https://developers.facebook.com/documentation/games/retain/notifications/game-updates-messenger)

## Payments, tournaments and community limits

**IAP:** Mock purchases do not populate `getPurchasesAsync` or establish webhook delivery, server grants, refunds or recovery. Webhook delivery requires approved Zero Permission Access or Gaming Profile permission even in development; callback verification alone is insufficient. No fresh payout/IAP dashboard approval or successful payment flow is claimed. [IAP guide](https://developers.facebook.com/documentation/games/monetize/in-app-purchases), [webhook required permission](https://developers.facebook.com/documentation/games/monetize/iap-webhooks#required-permission)

**Private tournaments:** There is no read-only eligibility preflight that proves creation will succeed. Creation can post to the group even if a later score step fails. A chooser `minSize: 3` is a picker hint, not a universal minimum-membership rule; direct entry from a two-member group may qualify. Existing app/host/group/scoring prerequisites remain unverified, and no creation or group post was performed for this research. [Private tournaments](https://developers.facebook.com/documentation/games/retain/tournaments#private-tournaments)

**Community and Rooms:** The known Riddle Quest Page ID is `61593702081276`; this is not a fresh Page-association or player-eligibility check. Group association remains unverified. Rooms acceptance requires a real eligible Room and participants, not a fabricated context or an empty discovery result. [Pages and groups](https://developers.facebook.com/documentation/games/retain/pages-and-groups), [Rooms SDK](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/room)

## Current testing scope

The owner requested continued **single-account checks**. Multi-person context membership, matchmaking, recipient delivery, group tournament participation and Rooms co-play remain untested. Local fixtures, cancellation, empty results and permission advertisements must retain their narrower descriptions. This research did not change app permissions, associations, subscriptions, Firebase, provider-server modules or release state, and did not submit a review, make a purchase or send a social message.
