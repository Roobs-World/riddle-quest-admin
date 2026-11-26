# Notifications

Registered Jest players get an account-level Notifications switch in Settings. New registrations default to On. An explicit Off survives future sign-ins. Guests see the switch disabled. Signup and the startup menu do not open a notification dialog or issue a device setup link.

Jest uses its HTML5 SDK notification API and Developer Console Asset Library. After registered identity, saved preferences and deletion state are ready, the client schedules seven distinct D1-D7 Daily reminders with stable identifiers and the approved `riddle-q-notification` image. Settings Off and account deletion remove current and legacy reminders. Jest owns delivery and display; a validated return payload opens Daily without awarding a response reward. See [Jest notification verification](../../jest/jest-notification-testing.md).

Firebase stores the account preference on `users/{uid}`. The Android app obtains the device's FCM token and registers it with its authenticated Firebase UID. It can register an existing permission automatically. Android controls the initial permission grant and users can revoke it in system settings.

The existing notification manager authors and schedules Android and Facebook campaigns. Operators select Android, Facebook or all configured manager platforms. Firebase checks account ownership and consent and calls the Supabase Edge Function. FCM delivers to Android’s native receiver. A tap on its system notification opens the game. Facebook’s separate dispatcher sends opted-in player IDs to Meta’s App-to-User API, which chooses the delivery channel. Jest's SDK integration leaves these backends and the existing account-preference callable unchanged.

| Platform | Responsibility |
| --- | --- |
| Jest | Save registered account consent, schedule D1-D7 through the Jest SDK, and cancel on opt-out or deletion. Jest delivers and displays the message. |
| Facebook | Eligible players opt in from Settings. Meta selects the Facebook or Messenger surface and handles the response. |
| Native Android | Register the device with Firebase, receive FCM messages, display notifications and handle taps. |
| iOS and native desktop | No native app or registered transport in this repository. |
| Other web games | No browser push delivery. |

Facebook and Jest identify browser players using game-scoped IDs. Android links Google to its existing Firebase UID. An installed device belongs to the UID that registered its token. [Registration and device ownership](registration-boundary.md)

See [Firebase enrollment](firebase-enrollment.md), [manager API](api.md), [manager operations](service.md) and [Supabase FCM](supabase-fcm.md).
