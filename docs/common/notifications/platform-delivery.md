# Native notification delivery

The manager owns content, schedules and delivery receipts. Android is the implemented native transport. The managed Edge request is restricted to Android data messages for `com.roobsworld.riddlequest`. The app's receiver validates the account, revision and consent, then posts an Android system notification. Tapping it opens the app's launcher activity.

Game browser clients save account preferences. The manager excludes browser FCM and Web Push registrations from every audience. Browser enrollment endpoints are retired and the legacy manager worker removes its subscription.

For an opted-in Facebook player, the separate Facebook dispatcher submits the campaign to Meta’s App-to-User service. Meta can show it on facebook.com, in its apps or through an eligible Messenger channel. Meta selects the surface and handles the response. Success in the manager means Meta acknowledged creating the notification. [Facebook delivery channels and app access](../../facebook/evidence/facebook-notification-channels-2026-11-26.md)

iOS and native desktop delivery require native clients with their own verified device registrations and receivers. See [registration and device ownership](registration-boundary.md) and the [manager API](api.md).

Production checks cover the Firebase, Supabase and Vercel endpoints. [Backend verification](evidence/native-notification-backend-2026-11-26.json) · [Facebook and Android manager rollout](evidence/facebook-manager-rollout-2026-11-26.json)

An isolated Android installation received a live FCM campaign, displayed the authored text, and opened the game on tap. [Android notification check](../../android/evidence/native-notification-tap-2026-11-26.md)

## Retired platform history

The notification-manager workspace no longer contains the Jest gaming-platform registration API, authored notification plan or active declarative registration schema. Firebase source and deployed backend remain unchanged; this manager-only removal does not retire the existing Firebase callable. Facebook delivery continues through its own manager registration and Meta A2U dispatcher.

The already-applied [26 November SQL migration](../../../notification-manager/supabase/migrations/20261126201858_jest_manager_registration.sql) is retained as immutable migration history. It does not supply an active route or campaign audience in this source. No remote table, function, registration or consent tombstone was changed by this removal. Any database retirement requires a separate reviewed migration and deployment; do not replay history as a new integration or drop retained consent state merely to remove a name.

The [November 26 rollout](../../jest/evidence/growth-fund-fixes-2026-11-26.json) describes the prior deployed system, not this branch's supported integrations.
