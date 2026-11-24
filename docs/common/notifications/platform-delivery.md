# Platform notification delivery

The notification manager owns every campaign title, body and image. Game code owns consent, device registration, routing and provider transport. It must not invent a message, generate a replacement image or substitute bundled content when manager content is absent.

The current manager dispatches Web Push campaigns to registered browser installations. A browser subscription is not a Jest player identity, a Meta bot subscription or an Android FCM token. Those transports need their own authenticated manager integration before they can deliver campaigns.

| Target | Preserved transport | Current campaign delivery |
| --- | --- | --- |
| Hosted browsers and custom browser targets | Hosted Web Push provider and service worker | Manager campaigns, when the service is configured and the browser grants permission |
| Jest | Jest SDK notification schedule/remove adapter | Paused until a manager-to-SDK handoff exists; legacy schedules are cancelled |
| Facebook | Meta bot permission, canonical recipient identity, consent ledger and A2U transport | Paused until a manager-to-Meta dispatcher exists |
| Android | Native FCM registration, account binding, consent and data-message transport | Paused until a manager-to-FCM dispatcher exists |

## Jest

The [Jest notification API](https://docs.jest.com/sdk/html5/notifications) schedules for the current registered player. Its request has no recipient field. The SDK adapter remains the required delivery path; browser Web Push must not bypass it. A hosted Web Push campaign cannot immediately notify another Jest player.

A future handoff must authenticate the player, return only that player's manager-authored campaign plan, validate the content and provider schedule, and pass it through `JestPlatformPort.scheduleNotification`. The manager must also supply Jest's required CTA; the current Web Push campaign model has no CTA field. Use manager-provided image content or an explicitly manager-selected approved asset reference. Do not generate cards or select an app-owned fallback image.

The game currently cancels every known D1–D7 and race identifier when a registered session mounts. Settings Off and account deletion preserve cancellation and session/deletion guards. There is no content fetch or automatic schedule. Already scheduled messages on another device can remain eligible until the player returns and the SDK removes them; a new client build cannot revoke another player's schedules server-side.

## Facebook

Permission remains behind the [FBInstant bot subscription APIs](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) and the player's Settings action. Server transport retains canonical Facebook identity, current master preference, deletion checks, dispatch admission and the fixed [Meta A2U endpoint](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api).

The legacy invitation outbox lacks manager-authored content. Its trigger marks queued work `skipped` with `reason: manager-content-required`; it does not call Meta or FCM. In-game invitations and their acceptance continue through the existing authoritative lobby and inbox paths.

A future manager dispatcher must resolve canonical recipients and recheck consent, deletion, invitation validity, expiry and blocks before claiming a unique provider attempt. It must pass manager-authored content into the existing Meta transport and retain its conservative handling of uncertain responses. The current Meta adapter accepts title and body only. Campaign images require a verified provider-supported extension; do not silently drop an image or invent a media API.

## Android

Native permission, account-bound FCM tokens, installation limits, opt-out, token cleanup and notification display remain. The registration callable records invitation and Daily consent without creating a daily schedule. The hardcoded Daily scheduler and its translated message table have been removed.

A future manager dispatcher must authenticate a server-to-server FCM integration, resolve current token ownership and consent, recheck account deletion and message expiry, and preserve idempotent admission before using the native send transport. Client code must never receive FCM server credentials. The Android receiver requires title and body in the incoming data; it does not supply fallback message text.

The existing Android display supports title/body and canonical Daily or live-challenge routes. It has no remote campaign image renderer or generic campaign route. Add those native capabilities before accepting manager campaigns that require them. The OS notification channel name and required small app icon are device UI metadata, not authored campaign content.

## Release transition

No live backend, provider configuration or game artifact is changed by these source edits. An authorized backend release must retire the deployed `sendAndroidDailyReminders` scheduled function and update the legacy challenge trigger. Retain consent and account-deletion token cleanup. A released Jest build cancels legacy schedules when the registered player opens it. New manager-native delivery requires its own implementation and verification before enabling sends.
