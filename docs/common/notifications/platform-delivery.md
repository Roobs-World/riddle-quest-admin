# Native notification delivery

The manager owns content, schedules and delivery receipts. Android is the implemented native transport. The managed Edge request is restricted to Android data messages for `com.roobsworld.riddlequest`. The app's receiver validates the account, revision and consent, then posts an Android system notification. Tapping it opens the app's launcher activity.

Browser clients save account preferences. They cannot receive or display a manager campaign. The manager excludes browser installations when selecting and admitting deliveries. Browser enrollment endpoints are retired and the legacy manager worker removes its subscription.

Meta’s App-to-User service chooses the Facebook surfaces where a message appears. The manager cannot select a native installation or exclude facebook.com through that API. [Facebook delivery channels and app access](../../facebook/evidence/facebook-notification-channels-2026-11-26.md)

iOS and native desktop delivery require native clients with their own verified device registrations and receivers. See [registration and device ownership](registration-boundary.md) and the [manager API](api.md).

Production checks cover the Firebase, Supabase and Vercel endpoints. [Backend verification](evidence/native-notification-backend-2026-11-26.json) · [Manager verification](evidence/native-manager-2026-11-26.json)
