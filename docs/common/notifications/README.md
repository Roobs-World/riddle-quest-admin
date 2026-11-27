# Notifications

Registered Jest players get an account-level Notifications switch in Settings. New registrations default to On. An explicit Off survives future sign-ins. Guests see the switch disabled. Signup and the startup menu do not open a notification dialog or issue a device setup link.

Firebase stores the account preference on `users/{uid}`. The Android app obtains the device's FCM token and registers it with its authenticated Firebase UID. It can register an existing permission automatically. Android controls the initial permission grant and users can revoke it in system settings.

The notification manager authors and schedules campaigns. Its Jest adapter also supplies the current registered player’s seven-day SDK plan; see [platform delivery](platform-delivery.md#jest). Operators select Android, Facebook or all configured platforms. Firebase checks account ownership and consent and calls the Supabase Edge Function. FCM delivers to Android’s native receiver. A tap on its system notification opens the game. Facebook’s separate dispatcher sends opted-in player IDs to Meta’s App-to-User API, which chooses the delivery channel.

| Platform | Responsibility |
| --- | --- |
| Jest | Save the registered account’s preference and apply the manager-owned D1–D7 plan through the Jest SDK. |
| Facebook | Eligible players opt in from Settings. Meta selects the Facebook or Messenger surface and handles the response. |
| Native Android | Register the device with Firebase, receive FCM messages, display notifications and handle taps. |
| iOS and native desktop | No native app or registered transport in this repository. |
| Other web games | No browser push delivery. |

Facebook and Jest identify browser players using game-scoped IDs. Android links Google to its existing Firebase UID. An installed device belongs to the UID that registered its token. [Registration and device ownership](registration-boundary.md)

See [Firebase enrollment](firebase-enrollment.md), [manager API](api.md), [manager operations](service.md) and [Supabase FCM](supabase-fcm.md).
