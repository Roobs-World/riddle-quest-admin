# Firebase account and device enrollment

Firebase stores the master notification preference on `users/{uid}.notificationsEnabled`. The verified Jest identity exchange initializes the field when the signed player first registers. Eligible Facebook sessions initialize it through `setNotificationPreference`. A subsequent login or device registration preserves an explicit opt-out.

Android registers the native FCM token in `androidPushTokens` with its owning Firebase UID, consent, registration revision and expiry. `androidNotificationDevices` tracks installation ownership and rejects stale device operations. The authenticated Firebase bridge sends only an opaque registration reference to the manager. The Android client renews an authorized route on restore and handles OS permission separately.

The browser enrollment callables are retained for compatibility with old clients. New browser enrollment and sending are closed. Historical browser credentials can be disabled. The manager's campaign audience consists of admitted native installations.

An Android native token belongs to one installation and authenticated account. The browser cannot obtain that token from the operating system. Playing in the browser can change the preference for an already associated account. Linking a separate browser identity requires verified ownership. [Identity and device ownership](registration-boundary.md)

The [November 25 setup record](evidence/jest-popup-fallback-2026-11-25.md) describes the retired browser pairing flow. For native delivery, see [Android operations](../../android/android-notifications.md) and [Supabase FCM](supabase-fcm.md).
