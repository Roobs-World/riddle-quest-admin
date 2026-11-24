# Notification settings

Hosted Settings has one **Notifications** row, using the same On/Off control as sound and accessibility. Notifications default to On when the player has no saved preference. Profile and multiplayer do not expose notification controls.

`src/settings/browser/playerPreferences.ts` applies and persists `notificationsEnabled` through each target's existing preference storage. The Settings provider in `src/notifications/components/NotificationSettingsContext.ts` keeps a pending update alive while the player changes modals. Target adapters implement `NotificationSettingsCapability`; referral sharing no longer owns notification state.

For registered Jest and Facebook accounts, the authenticated `setNotificationPreference` callable also stores the master preference at `users/<uid>.notificationsEnabled`. Server notification delivery rejects an explicit `false`. Meta permission remains a separate requirement. Default On does not grant Meta permission or open a permission prompt.

Jest uses `JestSDK.notifications.scheduleNotification` and `unscheduleNotification` through its target adapter for D1–D7 engagement and race-results reminders. Turning it Off cancels current and legacy identifiers and waits behind pending scheduling work. The Jest artifact excludes browser notification permission prompts, service-worker push delivery and Firebase Messaging.

The [documented Jest notification API](https://docs.jest.com/sdk/html5/notifications) schedules notifications for the current registered player and has no recipient parameter. Direct incoming challenges therefore remain in the multiplayer inbox. Their idempotent server receipt is marked `skipped` for external delivery. Server-initiated challenge delivery runs only for platforms with a supported recipient API.

Facebook requests permission through the [FBInstant player bot APIs](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) only after the player switches Notifications On in Settings. Server delivery uses Meta's [A2U notification API](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api) at `graph.fb.gg/<appId>/notifications`. Completing a riddle or race does not trigger a permission request. Age, feature, API and server consent gates still apply.

Targets without notification delivery omit the row. Native Android retains its platform-owned notification preferences and device permission flow.

Deploy the backend delivery changes and retire the deployed `setLiveRacePushSubscription` callable before uploading the provider-only Jest client. The removed `JEST_CHALLENGE_PUSH_ENABLED` and `VITE_JEST_CHALLENGE_PUSH_VAPID_KEY` settings no longer enable a delivery path. Historical token TTL and account-deletion cleanup remain until legacy records have been purged. Deploying, uploading or activating a build requires the corresponding release authorization.
