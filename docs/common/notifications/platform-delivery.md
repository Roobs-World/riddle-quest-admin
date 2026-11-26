# Native notification delivery

The manager owns content, schedules and delivery receipts. Android is the implemented native transport. The managed Edge request is restricted to Android data messages for `com.roobsworld.riddlequest`. The app's receiver validates the account, revision and consent, then posts an Android system notification. Tapping it opens the app's launcher activity.

Game browser clients save account preferences. The manager excludes browser FCM and Web Push registrations from every audience. Browser enrollment endpoints are retired and the legacy manager worker removes its subscription.

For an opted-in Facebook player, the separate Facebook dispatcher submits the campaign to Meta’s App-to-User service. Meta can show it on facebook.com, in its apps or through an eligible Messenger channel. Meta selects the surface and handles the response. Success in the manager means Meta acknowledged creating the notification. [Facebook delivery channels and app access](../../facebook/evidence/facebook-notification-channels-2026-11-26.md)

iOS and native desktop delivery require native clients with their own verified device registrations and receivers. See [registration and device ownership](registration-boundary.md) and the [manager API](api.md).

Production checks cover the Firebase, Supabase and Vercel endpoints. [Backend verification](evidence/native-notification-backend-2026-11-26.json) · [Facebook and Android manager rollout](evidence/facebook-manager-rollout-2026-11-26.json)

An isolated Android installation received a live FCM campaign, displayed the authored text, and opened the game on tap. [Android notification check](../../android/evidence/native-notification-tap-2026-11-26.md)

## Jest

Jest requires scheduling through its SDK for the current registered player. The manager owns an English daily plan (`jest-daily-v4`) and returns it from the private `/api/devices/jest/registration` bridge. It supplies seven different bodies of at most 100 ASCII characters, CTAs, D1–D7 offsets, stable `riddle-quest-dN-v4` identifiers and the approved `riddle-q-notification` image reference. The plan is authored in `notification-manager/server/jest/plan.ts`; it is not part of the generic calendar campaign audience.

The `getJestNotificationPlan` Firebase callable verifies App Check, signed-account claims, the live account, deletion guards and its saved Notifications preference. It sends only an opaque recipient hash, ordered revision, English locale and expiring consent to the manager. A server-only Supabase table mirrors those registrations. Stale revisions cannot overwrite later opt-outs. The manager returns an empty plan for disabled accounts; the callable validates the response and rechecks consent before returning it.

The Jest adapter fetches the plan at registered startup and when the setting changes. It validates the complete plan before replacing schedules, checks current account and consent at each SDK call, and serializes cancellation with scheduling. Opt-out and account deletion remove current and legacy identifiers. Manager outages leave existing valid schedules in place and retry without inventing local content. The adapter adds no entry payload, notification tap handling or reward.

Deploy the reviewed Supabase migration and manager API, then the Firebase callable, before activating a client that consumes this handoff. A manager production deployment requires explicit owner authorization under [manager operations](service.md#vercel-setup). The Jest build remains covered by its standing upload and activation authorization. Hosted Simulator acceptance must be recorded separately from build checks.
