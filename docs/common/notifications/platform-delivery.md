# Default notification delivery

One hosted notification service owns campaign content, scheduling, the queue and delivery history. Clients implement the same NotificationProvider contract. Device adapters account for operating-system and browser APIs without creating separate management websites or content stores.

Game platforms enroll player devices and maintain consent. The notification manager sends every campaign to the eligible registered devices in its selected audience. Selecting all platforms includes every supported enrolled transport; it does not turn historical account profiles into device registrations. Browser delivery uses system notifications through `ServiceWorkerRegistration.showNotification`, with the Riddle Quest icon. The installed web app is named Riddle Quest. The browser and operating system control the final layout and source attribution. Android uses its native notification receiver through FCM.

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

## Signup coverage

| Game client | Device signup |
| --- | --- |
| Jest and Facebook | Shared Firebase-linked enrollment, offered during the welcome shown to eligible new and returning accounts and in Settings |
| Native Android | Native permission and FCM registration through the app's notification screen |
| Yahoo hosted-push client | Browser permission and an anonymous hosted device registration |
| Reddit | No released enrollment adapter; an external enrollment flow requires the Devvit gateway and Reddit approval for off-site navigation and collection |
| YouTube, Netflix and GameSnacks | No device signup under the current self-contained target restrictions |

An existing player can enroll on their next visit. Playing previously, signing in, or leaving the game's notification preference On does not grant operating-system permission or create a missing browser subscription. Each browser or native device must complete its permitted signup once. Existing registrations can be renewed without asking again while permission and account consent remain valid.

## Release transition

Source edits do not change a deployed client or backend. An authorized backend release must retire the old Android Daily scheduler, update the legacy challenge trigger and deploy the Android dispatch adapter. An authorized native release must include the new campaign receiver. Live notification delivery and device acceptance remain unverified until the service, database, bridge and clients are configured.
