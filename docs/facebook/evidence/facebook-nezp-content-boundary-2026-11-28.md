# NEZP stored notification content: contract and ownership recheck

Research date: 28 November 2026. Scope: public Meta contracts and repository ownership rules; no SDK invocation, content creation, notification send, configuration change, build or test was performed.

## Finding

Meta deliberately supports **game-client content generation followed by server-owned A2U sending**. A missing signed content receipt is not a missing prerequisite in that provider workflow. A manager-authored rendering job can therefore be a legitimate integration design. It is not equivalent to giving the game scheduling or sending authority. However, authenticating the client that returns a stored-content ID does not prove that Meta stored the exact title, assets or generation approved by the manager. That distinction needs an explicit design decision; it does not justify declaring every non-Firebase notification-manager change forbidden. [Meta Player reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#createnezpnotificationcontentasync), [A2U guide](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api#personalized-content-with-user-information), [repository scope](../../../AGENTS.md), [manager ownership](../../common/notifications/README.md)

## Provider contract

| Boundary | Documented behavior |
| --- | --- |
| Creation | After initialization, `FBInstant.player.createNEZPNotificationContentAsync(payload)` returns `Promise<string>`: a stored-content ID. Meta stores rendered image and text. Documented errors are `INVALID_PARAM`, `NETWORK_FAILURE` and `PENDING_REQUEST`. |
| Rendering input | Required fields are `imageOverlayPath`, `pathToCSS` and `notificationTitle`. `notificationSubtitle`, `initialData` and `recipients` are optional in the SDK payload type. The title can contain player-name template tokens. |
| Recipient scope | Supplied recipient player IDs must belong to the current game context. The documentation does not establish that a solo context supports a self-recipient workflow; that must be verified separately. |

Source: [Player v8 method and payload](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#createnezpnotificationcontentpayload).

| A2U boundary | Documented behavior |
| --- | --- |
| Authority | Backend `POST https://graph.fb.gg/{app-id}/notifications`, authenticated by the app access token, targets a game-scoped `player_id`. |
| Single stored card | The target must be among the creation recipients. The guide describes the stored-content reference but does not provide a complete single-card request example; do not invent missing wire syntax. |
| Stored carousel | `notification_contents` contains 2–5 cards. Each stored ID must belong to the calling app, have been created for the target player and contain title, subtitle and image. Thus the carousel requires a subtitle despite its optional SDK input type. |
| Card data | Each card requires a nonempty payload. Optional card-level button text and game metadata are supported. Context and player metadata are mutually exclusive. Incompatible top-level message/payload/metadata fields are prohibited. |
| Copy and scheduling | Stored cards use creation-time title/subtitle without another send-time copy check. Scheduled carousels capture their content when the A2U notification is created. |
| Inline alternative | Cards can instead contain manager-supplied `message` title/body and optional image URL. Mixed and entirely inline carousels are supported. Inline copy is checked against notification guidelines. |

Source: [current A2U carousel and inline-card contract](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api#carousel-bot-messages-with-stored-content). The [24 September changelog entry](https://developers.facebook.com/documentation/games/whats-new/changelog/?filter=September+24%2C+2026) independently appears in Meta documentation discovery as the inline-card addition; the complete rendered changelog article was not available in the fetched HTML.

## What the content ID does and does not establish

The reviewed Player and A2U contracts document an opaque ID and provider-enforced app/recipient eligibility. They do not document a stored-content GET/inspection endpoint, signed rendered-content receipt, canonical render digest or manager-plan attestation. Targeted Meta documentation searches also did not reveal one. This is a bounded finding about the reviewed public contracts, not a claim that no private or future capability exists.

`getSignedPlayerInfoAsync(requestPayload)` signs the player identity and developer-supplied request payload. Its signature can authenticate a fresh player submission containing a manager nonce, plan reference and content ID. **It does not establish that the ID was rendered from that plan:** the caller supplies the request payload. The signature is not a substitute content attestation. [Signed player information and signature fields](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#getsignedplayerinfoasync)

These facts imply a concrete substitution risk: a modified client could return another content ID that is valid for the same app and eligible target. Manager authentication, nonces, expiry and a single-use job stop unrelated submissions and replay; they do not independently compare Meta's stored text/image with the intended render input. Provider app/recipient validation limits where the substituted content can go. It does not make it manager-authored.

## Viable ownership model and remaining decision

The controlling repository requirement is that the manager owns content, scheduling and sending, while gameplay does not handle delivered notification payloads, acknowledgements, taps or rewards. It does **not** prescribe a cryptographic receipt for every rendering step. The non-Firebase manager is a separate workspace outside the game and Firebase deployment graphs. The owner freeze covers Firebase, its configuration and provider server modules; it is not a blanket freeze of that workspace. [AGENTS.md](../../../AGENTS.md), [platform layout](../../common/architecture/platform-layout.md), [existing manager service](../../common/notifications/service.md)

A proposed manager-owned workflow could:

1. Have the manager author an immutable, expiring rendering job containing approved copy, template/assets, input data and one approved audience binding. The manager selects the purpose and eventual schedule.
2. Give a verified, eligible Facebook session only the rendering job. A Facebook-specific adapter calls the SDK and returns the resulting ID against the same authenticated job. It neither sends a notification nor processes delivery or tap payloads.
3. Keep the result marked as client-returned stored content, with creator, target, account/consent revision, template version and expiry recorded. Restrict reuse to that job and target. Do not infer target identity, current consent or account generation solely from the ID.
4. Let the manager choose whether to accept that rendering trust level, then recheck consent, revision, deletion/cancellation and expiry through an authoritative path before it sends. Secrets, A2U calls, scheduling and receipts stay server-side.

This is a design option, **not an implemented or verified route**. It preserves operational authorship and dispatch ownership while trusting the authorized client to carry out the approved rendering inputs. A narrowly scoped recipient reduces exposure but does not remove that trust assumption; self-recipient eligibility is also unverified. An operator-controlled, isolated creation session can narrow who performs the rendering, but is not a scalable substitute for an authenticated player workflow.

If “manager owns content” must guarantee exact approved text/image even against a modified client, the documented stored-content interface does not establish the necessary content equality. An approved inspection/attestation mechanism or another trusted creation/inspection process would be needed for that stronger guarantee. Use manager-supplied inline A2U content where server-resolved player imagery is unnecessary; that meets exact copy ownership but does not exercise the NEZP SDK method. The provider documentation should not be misrepresented as requiring an attestation it does not describe.

The strongest current integration constraint is separate from rendered-content trust: the protected provider dispatcher cannot consume a stored-content ID. Existing manager APIs delegate Facebook delivery to that Firebase dispatcher, which performs fresh identity, consent, revision and deletion checks and acquires the account-operation lease. The manager's asynchronously updated registration mirror is not an equivalent dispatch-time authority. A new manager-only direct A2U sender would bypass those established checks unless a design preserves them through an available authoritative boundary. No complete design doing so through the current bridge has been identified. This is a concrete unsatisfied repository contract under the Firebase/provider-server freeze, not a Meta prohibition or a ban on all manager changes. [Current manager API](../../common/notifications/api.md), [registration boundary](../../common/notifications/registration-boundary.md), [provider dispatcher](../../../platforms/web/facebook/server/notifications/managerDispatch.ts), [dispatch contract](../../../src/notifications/contracts/managerBridge.ts), [registration synchronization](../../../platforms/web/facebook/server/notifications/managerRegistrationSync.ts)

## Retrieval evidence

Fresh unauthenticated HTTPS fetches requested `Accept: text/markdown`; both contract pages returned HTTP 200 and Markdown:

| Source | Retrieved UTC | SHA-256 |
| --- | --- | --- |
| Player v8 | 2026-11-28 10:46:45 | `093e59f38e599123f629cfeb1ea765782a953f6ede57d0df47bfe515ad41c3b0` |
| A2U | 2026-11-28 10:46:45 | `ad2ed5afa5b51260cbfe98c99225027d126fd8b9364db59d95d6b82ba30f2765` |

Local snapshots: `/tmp/rq-nezp-contract-recheck-player.md` and `/tmp/rq-nezp-contract-recheck-a2u.md`. Meta documentation discovery queries included `"notification_content_id"` (seven results), `"createNEZPNotificationContentAsync" "verify"` (three results), and `"NEZPNotificationContent" "GET"` (zero results). Returned relevant pages were the Player reference, A2U guide and changelog; none exposed a content inspection or attestation contract. General web search returned no results for the narrower lookup/signature queries. No claim of exhaustive discovery or live platform acceptance follows from those searches.
