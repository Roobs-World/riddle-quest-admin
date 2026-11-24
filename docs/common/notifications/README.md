# Notifications

The game has one global Notifications preference in Settings, using the same On/Off control as the other preferences. It defaults to On. Profile and multiplayer have no notification controls. Default On records a preference; device permission still requires a player gesture.

`src/notifications/contracts/notificationProvider.ts` defines the common provider interface. Each provider owns restoration, permission, saved consent, activity and retirement. Settings observes its snapshot and sends preference commands. Closing the game retires the controller without revoking background push delivery.

`createNotificationProvider` selects our hosted implementation by default. A platform with a mandatory SDK supplies its own implementation. A platform that prohibits notifications returns no provider. A platform failure never silently changes delivery channels.

| Platform | Delivery boundary |
| --- | --- |
| Yahoo and admitted custom browser platforms | Hosted Web Push through the Vercel service |
| Jest | Required Jest SDK |
| Facebook | Required FBInstant permission and Meta recipient API |
| Android | Native notification permission and FCM |
| Reddit, YouTube, Netflix and GameSnacks | No notification provider in the current target |

The manager is the sole author of notification titles, messages and images. The hosted client contains no content fallback, generated artwork or timer-based message delivery. Legacy app-authored engagement and race alerts are retired. Required platform transports retain permission and cancellation, while manager delivery needs a supported platform content handoff. See [platform delivery](platform-delivery.md).

The hosted provider registers a browser PushSubscription and a private installation credential. Turning Off closes the local worker consent gate immediately and independently attempts server revocation and browser unsubscription. Failed revocations remain pending for retry. Worker messages must match the installation, platform, expiry and consent gate before display or click handling.

`VITE_NOTIFICATION_SERVICE_URL` explicitly selects the hosted service. With no URL, the preference reports unconfigured delivery and makes no backend requests. Browser transport is replaceable, and new platforms can supply a provider without importing another platform's SDK.

Read the [service and setup guide](service.md), [API contract](api.md), and [Yahoo client guide](../../yahoo/notifications.md). Source builds do not deploy the service, apply database changes or upload games.
