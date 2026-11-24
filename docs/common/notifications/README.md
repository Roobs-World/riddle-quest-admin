# Notification settings

Hosted Settings has one **Notifications** row, using the same On/Off control as sound and accessibility. Notifications default to On when the player has no saved preference. Profile and multiplayer do not expose notification controls.

`src/settings/browser/playerPreferences.ts` applies and persists `notificationsEnabled` through each target's existing preference storage. The Settings provider in `src/notifications/components/NotificationSettingsContext.ts` keeps a pending update alive while the player changes modals. Target adapters implement `NotificationSettingsCapability`; referral sharing no longer owns notification state.

For registered Jest and Facebook accounts, the authenticated `setNotificationPreference` callable also stores the master preference at `users/<uid>.notificationsEnabled`. Server push delivery rejects an explicit `false`. Existing provider permission remains a separate requirement. Default On does not grant browser or Meta permission and does not open a permission prompt.

Jest applies the setting to D1–D7 engagement reminders, race-results reminders and browser challenge push. Turning it Off cancels current and legacy reminder identifiers, waits behind pending scheduling work, and revokes browser challenge delivery. The push worker checks a persisted account-bound preference before displaying a queued message. Restoring On may refresh previously granted browser permission without prompting.

Facebook requests Meta bot permission only after the player switches Notifications On in Settings. Completing a riddle or race no longer triggers a permission request. Age, feature, API and server consent gates still apply.

Targets without notification delivery omit the row. Native Android retains its platform-owned notification preferences and device permission flow.

Deploy the backend callable and delivery guards before uploading a client that uses them. Deploying, uploading or activating a build requires the corresponding release authorization. The Jest server push payload includes `accountId`; the updated worker suppresses older payloads that lack an account identity.
