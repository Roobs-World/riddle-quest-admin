# Notifications

The game has one global Notifications preference in Settings, using the same On/Off control as the other preferences. It defaults to On. Profile and multiplayer have no notification controls. Default On records a preference; device permission still requires a player gesture.

`src/notifications/contracts/notificationProvider.ts` defines the common provider interface. Each provider owns restoration, permission, saved consent, activity and retirement. Settings observes its snapshot and sends preference commands. Closing the game retires the controller without revoking background push delivery.

`createNotificationProvider` selects our hosted implementation by default. A platform with a mandatory SDK supplies its own implementation. A platform that prohibits notifications returns no provider. A platform failure never silently changes delivery channels.

| Platform | Delivery boundary |
| --- | --- |
| Android browsers, iOS Home Screen apps and desktop browsers | Hosted Web Push through the Vercel service |
| Jest | Required Jest SDK |
| Facebook | Default hosted browser provider where its runtime supports it; no optional Meta delivery integration |
| Android React Native app | Native permission and FCM adapter behind the same hosted campaign service |
| Reddit, YouTube, Netflix and GameSnacks | No notification provider in the current target |

The manager is the sole author of notification titles, messages and images. The hosted client contains no content fallback, generated artwork or timer-based message delivery. Legacy app-authored engagement and race alerts are retired. Device adapters share one campaign model, queue and management API. Platform integrations are exceptions only when a documented requirement calls for them. See [platform delivery](platform-delivery.md).

The hosted provider registers a browser PushSubscription and a private installation credential. Turning Off closes the local worker consent gate immediately and independently attempts server revocation and browser unsubscription. Failed revocations remain pending for retry. Worker messages must match the installation, platform, expiry and consent gate before display or click handling.

`VITE_NOTIFICATION_SERVICE_URL` explicitly selects the hosted service. With no URL, the preference reports unconfigured delivery and makes no backend requests. Browser transport is replaceable, and new platforms can supply a provider without importing another platform's SDK.

Read the [service and setup guide](service.md), [API contract](api.md), and [Yahoo client guide](../../yahoo/notifications.md). Source builds do not deploy the service, apply database changes or upload games.
