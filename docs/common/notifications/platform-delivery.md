# Native notification delivery

The manager owns content, schedules and delivery receipts. Android is the implemented native transport. The managed Edge request is restricted to Android data messages for `com.roobsworld.riddlequest`. The app's receiver validates the account, revision and consent, then posts an Android system notification. Tapping it opens the app's launcher activity.

Game browser clients save account preferences. The manager excludes browser FCM and Web Push registrations from every audience. Browser enrollment endpoints are retired and the legacy manager worker removes its subscription.

For an opted-in Facebook player, the separate Facebook dispatcher submits the campaign to Meta’s App-to-User service. Meta can show it on facebook.com, in its apps or through an eligible Messenger channel. Meta selects the surface and handles the response. Success in the manager means Meta acknowledged creating the notification. [Facebook delivery channels and app access](../../facebook/evidence/facebook-notification-channels-2026-11-26.md)

iOS and native desktop delivery require native clients with their own verified device registrations and receivers. See [registration and device ownership](registration-boundary.md) and the [manager API](api.md).

Production checks cover the Firebase, Supabase and Vercel endpoints. [Backend verification](evidence/native-notification-backend-2026-11-26.json) · [Facebook and Android manager rollout](evidence/facebook-manager-rollout-2026-11-26.json)

An isolated Android installation received a live FCM campaign, displayed the authored text, and opened the game on tap. [Android notification check](../../android/evidence/native-notification-tap-2026-11-26.md)
