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

Jest and Facebook use the shared [Firebase-linked enrollment page](firebase-enrollment.md) outside the embedded game. The existing authenticated game account pairs that browser without another Google login. Their artifacts exclude service workers and Firebase Messaging. Notifications are delivered through our Web Push bridge, not Jest Home/SMS or optional Meta integrations. Legacy Jest cancellation remains to retire old schedules.

Reddit, YouTube, Netflix and GameSnacks retain their existing target restrictions and have no provider in their current build.

## Release transition

Source edits do not change a deployed client or backend. An authorized backend release must retire the old Android Daily scheduler, update the legacy challenge trigger and deploy the Android dispatch adapter. An authorized native release must include the new campaign receiver. Live notification delivery and device acceptance remain unverified until the service, database, bridge and clients are configured.
