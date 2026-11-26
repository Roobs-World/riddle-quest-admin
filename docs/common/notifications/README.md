# Notifications

Registered Jest players get an account-level Notifications switch in Settings. New registrations default to On. An explicit Off survives future sign-ins. Guests see the switch disabled. Signup and the startup menu do not open a notification dialog or issue a device setup link.

Firebase stores the account preference on `users/{uid}`. The Android app obtains the device's FCM token and registers it with its authenticated Firebase UID. It can register an existing permission automatically. Android controls the initial permission grant and users can revoke it in system settings.

The notification manager authors campaigns, selects eligible native installations and schedules delivery. Firebase checks account ownership and consent and calls the Supabase Edge Function. FCM delivers to the Android app's native receiver, which displays the system notification. Tapping a campaign opens the app.

| Platform | Responsibility |
| --- | --- |
| Jest and eligible Facebook accounts | Save the account preference. Browser games do not subscribe to push. |
| Native Android | Register the device with Firebase, receive FCM messages, display notifications and handle taps. |
| iOS and native desktop | No native app or registered transport in this repository. |
| Other web games | No browser push delivery. |

Facebook and Jest identify browser players using game-scoped IDs. Android links Google to its existing Firebase UID. An installed device belongs to the UID that registered its token. [Registration and device ownership](registration-boundary.md)

See [Firebase enrollment](firebase-enrollment.md), [manager API](api.md), [manager operations](service.md) and [Supabase FCM](supabase-fcm.md).
