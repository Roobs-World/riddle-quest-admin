# Messenger bot consent — 27 November 2026

The optional **Messenger game updates** Settings action uses `player.isSubscribedBotAsync`, `player.canSubscribeBotAsync` and `player.subscribeBotAsync`. It requires the initialized notification-manager provider, verified 13+ account/configuration gates, all three advertised and callable SDK methods, and `VITE_FACEBOOK_MESSENGER_BOT_ENABLED=true`. The deployment flag defaults off and must stay off until the Messenger use case and `pages_messaging`/Bot review prerequisites are approved.

Opening Settings only reads status and eligibility. A player request rechecks both inside the shared native-dialog gate immediately before subscribing. Metadata waits are bounded; closing Settings, hiding the page, retiring the account or failing eligibility prevents a late prompt. An admitted prompt keeps its original promise; its actual subscription status is refreshed after success or rejection, including after the panel closes. The adapter suppresses another offer when it observes that permission was granted. It invents no unsubscribe API.

Bot permission does not change the game's saved notification preference, grant coins, register different device routing, create content, schedule notifications or send a message. The existing manager consent/opt-out remains authoritative for delivery. This keeps native permission distinct from the current generation-bound `a2u-v1` consent.

Local verification: 13 new consent regressions passed, together with 21 Settings/host-action regressions. They cover disabled/missing support, status restore without prompting, current eligibility, failed and timed-out reads, panel/account retirement, and a native rejection after permission was actually granted. The [combined build/browser evidence](facebook-expanded-api-final-verification-2026-11-27.md) also confirms explicit single admission, action removal and unchanged notification-manager preferences. No real Messenger subscription or message was performed.

The [current SDK player reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) requires `canSubscribeBotAsync` before prompting. Its status getter is not a substitute for eligibility.

## Stored notification content remains separate

`createNEZPNotificationContentAsync` is not enabled by this consent action. The [A2U reference](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api), rechecked on 27 November, validates stored-content app/recipient ownership at send time and supports inline cards as an alternative. It does not document a way to retrieve and verify the browser-created title, subtitle and image against the manager's authored plan. A client-returned ID therefore cannot establish that authored content by itself.

A meaningful stored-content integration still needs a manager-authored plan, current-context recipient scope, authenticated generation-bound receipt storage, a dispatch consumer, and content verification or explicit manager inspection/approval. None of those prerequisites can be replaced by a dormant SDK declaration or a gameplay-owned notification sender. Existing manager-authored inline A2U delivery remains unchanged.
