# Android campaign delivery and tap

On 26 November 2026 a Google Play API 37 emulator received one data-only campaign through the live Supabase sender and Firebase Cloud Messaging. Android displayed the authored title and body while Riddle Quest was in the background. Tapping the notification at 04:03:37 UTC resumed the game’s main activity and dismissed the notification. [Notification shade screenshot](native-notification-shade-2026-11-26.png)

| Check | Observed |
| --- | --- |
| Installed package | `com.roobsworld.riddlequest`, debuggable version 1.0.0, version code 1, x86_64 |
| Installed APK SHA-256 | `67a103179397b86af72d672906f5a8a2847e13e2f88c34636b1ce43ff26f2102` |
| Recipient | Fresh Firebase Messaging token issued to the isolated installation with Android notification permission |
| Sender | Local Android manager adapter called the local Firebase dispatch handler. A private Firestore emulator held the synthetic account and token binding. The handler called the production Supabase `fcm-push` Edge Function. |
| Provider response | One attempt, one Firestore dispatch receipt marked `accepted` at 04:03:02 UTC |
| Android display | Notification channel `riddle-quest`. The title was “Riddle Quest device check” and the body was “Tap to open the installed game.” |
| Tap | Android System UI launched `MainActivity` with action `MAIN`, category `LAUNCHER` and no URI. The activity resumed and the campaign disappeared from the active notification list. |
| Cleanup | The Firebase SDK deleted the test token and Firebase installation. The temporary emulator was shut down. |

The fixture created the local account binding and supplied a single campaign directly to the manager’s Android adapter. This run covered the live delivery provider, native receiver and OS tap. Production sign-in, Play Integrity enrollment, the hosted admin scheduler and physical phone display still require a compatible registered installation for a combined release check. [Deployed backend checks](../../common/notifications/evidence/native-notification-backend-2026-11-26.json)

A read-only check of the connected Samsung found production package version code 3, which lacks the Android notification permission in its manifest. Its signing certificate differs from both locally available APKs. The separately installed development package uses the `.dev` application ID and had notification permission denied. The sender restricts campaign delivery to the production application ID.
