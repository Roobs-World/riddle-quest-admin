# Registration and device ownership

Facebook initializes the preference after its age and platform eligibility checks. Eligible Facebook players opt in to Facebook delivery using Settings. Firebase records the choice and account generation against the signed Facebook identity. Returning players retain their choice. A pre-existing master preference of On requires a separate affirmative Facebook choice before enrollment. The signup and Settings flows do not issue pairing codes or request browser notification permission.

Android identifies the installation using its native FCM registration. Firebase requires an authenticated Android account and a production App Check token for the approved Android app to register an enabled token. The manager holds an opaque device reference. The native receiver validates consent, account, revision and expiry before posting a notification.

Android links Google to its existing Firebase UID. Facebook sign-in identifies a player by the game-scoped player ID. It does not provide the verified Android UID or a common email address that the manager can use for device routing. [Facebook identity and channel verification](../../facebook/evidence/facebook-notification-channels-2026-11-26.md)
