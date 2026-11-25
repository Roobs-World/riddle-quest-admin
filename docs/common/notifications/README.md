# Notifications

Games register verified accounts, device routing and notification consent. The existing notification manager owns notification content, scheduling and sending. The receiving device owns system display and notification responses, including taps and dismissal. Gameplay has no push-received callback, notification-response handler, delivery acknowledgement or response-based reward.

The device may launch the configured game URL or native app after a tap. The game then follows its ordinary startup path. A registration or enrollment-complete response only confirms setup; it is separate from a response to a delivered notification.

| Responsibility | Owner |
| --- | --- |
| Account, device routing and On/Off consent registration | Authenticated platform adapter and backend |
| Campaign content, audience, schedule and sending | Notification manager |
| Browser notification display and taps | Manager service worker on the device |
| Android notification display and taps | Native FCM receiver and Android notification APIs |

The browser implementation is `notification-manager/public/push/worker.js`. Android uses `RiddleQuestMessagingService` and `AndroidNotifications` under `platforms/native/android`. Both operate outside gameplay. A user ID alone is not a device push route; a registered browser subscription or FCM token and device permission are still required.

The game has one global Notifications preference in Settings, using the same On/Off control as the other preferences. It defaults to On. Profile and multiplayer have no notification controls. Default On records a preference; device permission still requires a player gesture.

Eligible players receive the notification request in its own modal after closing the startup menu and finishing any instructions, registration or guidance. Sandboxed games that cannot open a setup window provide a private, copyable enrollment link. Setup and delivery failures are distinct from a failed preference save.

`src/notifications/contracts/notificationProvider.ts` defines the common provider interface. Each provider owns restoration, permission, saved consent, activity and retirement. Settings observes its snapshot and sends preference commands. Closing the game retires the controller without revoking background push delivery.

`createNotificationProvider` selects our hosted implementation by default. A platform with a mandatory SDK supplies its own implementation. A platform that prohibits notifications returns no provider. A platform failure never silently changes delivery channels.

| Platform | Delivery boundary |
| --- | --- |
| Android browsers, iOS Home Screen apps and desktop browsers | Hosted Web Push through the Vercel service |
| Jest | Shared Firebase-linked enrollment page outside the embedded game |
| Facebook | The same Firebase-linked enrollment page; no optional Meta delivery integration |
| Android React Native app | Native permission and FCM adapter behind the same hosted campaign service |
| Reddit, YouTube, Netflix and GameSnacks | No notification provider in the current target |

The manager is the sole author of notification titles, messages and images. The hosted client contains no content fallback, generated artwork or timer-based message delivery. Legacy app-authored engagement and race alerts are retired. Device adapters share one campaign model, queue and management API. Platform integrations are exceptions only when a documented requirement calls for them. See [platform delivery](platform-delivery.md).

The hosted provider registers a browser PushSubscription and a private installation credential. Turning Off closes the local worker consent gate immediately and independently attempts server revocation and browser unsubscription. Failed revocations remain pending for retry. Worker messages must match the installation, platform, expiry and consent gate before display or click handling.

`VITE_NOTIFICATION_SERVICE_URL` explicitly selects the hosted service. With no URL, the preference reports unconfigured delivery and makes no backend requests. Browser transport is replaceable, and new platforms can supply a provider without importing another platform's SDK.

Read the [service and setup guide](service.md), [API contract](api.md), and [Yahoo client guide](../../yahoo/notifications.md). Source builds do not deploy the service, apply database changes or upload games.

For authenticated players, [Firebase enrollment](firebase-enrollment.md) describes the shared signup action, device ownership, platform adapters and coordinated release. Firebase is the account and device authority; its device count is distinct from configured delivery platforms.
