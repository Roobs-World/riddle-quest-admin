# Default notification delivery

One hosted notification service owns campaign content, scheduling, the queue and delivery history. Clients implement the same NotificationProvider contract. Device adapters account for operating-system and browser APIs without creating separate management websites or content stores.

| Client | Default device adapter |
| --- | --- |
| Android React Native app | Native FCM through the authenticated game backend |
| Android browser | Standards-based Web Push |
| iOS and iPadOS Home Screen web app | Standards-based Web Push |
| Desktop browser | Standards-based Web Push |

The iOS scope is Safari/Home Screen web apps, as selected by the user. No native iOS project or APNs application integration is introduced. [Apple supports Web Push for Home Screen web apps on iOS 16.4 and later](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Permission must follow a user action. Unsupported browsers and embedded runtimes report unavailable delivery.

The Web Push service accepts Google, Mozilla, Apple and Microsoft push endpoints. It uses the browser-issued subscription, rather than guessing the user's device API from their OS. The user writes notification title, body and optional image in the manager. Device support determines image presentation; the game supplies no fallback copy or generated artwork.

## Android React Native

The native provider has one default-On master preference and preserves saved Off values. OS notification permission remains separate and is requested only from Settings. Native account changes and token rotations renew registration through the existing authenticated Firebase JS account, without creating another identity.

The manager stores opaque token hashes and consent revisions in Supabase. Firebase alone resolves raw FCM tokens and current account ownership. The server-only registration and dispatch bridges require a shared credential. Public browser enrollment cannot impersonate a native device.

Each native send checks current master consent, registration capability, token ownership, revision, expiry and deletion. A durable campaign/device receipt prevents blind retries after uncertainty. Data-only FCM lets the native receiver enforce local consent and account ownership before displaying content. WorkManager processes optional images and rechecks ownership before updating a notification.

A new native Android build and the configured bridge are required. Old clients that cannot process generic campaigns are excluded. Account deletion clears native token bindings and delivery receipts.

## Platform exceptions

Facebook uses the default hosted browser provider. No optional Meta A2U/bot delivery integration is active. [Meta hosts Instant Games in iframes or mobile WebViews](https://developers.facebook.com/documentation/games/build/overview), where browser notification features may be unavailable. The game reports that limitation; native Android FCM cannot supply push APIs inside another application's WebView.

Jest has a documented launch requirement for a registered-player D1-D7 notification sequence. Its [launch checklist](https://docs.jest.com/launch-checklist#notifications) allows a developer backend using the Jest API as an alternative to its client SDK. The SDK is not an exclusive platform mandate. Generic FCM or Web Push does not satisfy that documented Jest sequence.

The existing Jest schedule/remove adapter and cancellation remain, but manager-to-Jest campaign authoring and delivery are not enabled. That required sequence needs a manager-authored content handoff before a future Jest launch. Do not add optional platform-specific delivery paths unless a confirmed requirement or explicit request calls for them.

Reddit, YouTube, Netflix and GameSnacks retain their existing target restrictions and have no provider in their current build.

## Release transition

Source edits do not change a deployed client or backend. An authorized backend release must retire the old Android Daily scheduler, update the legacy challenge trigger and deploy the Android dispatch adapter. An authorized native release must include the new campaign receiver. Live notification delivery and device acceptance remain unverified until the service, database, bridge and clients are configured.
