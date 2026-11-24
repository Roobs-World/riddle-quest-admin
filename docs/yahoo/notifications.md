# Yahoo hosted notifications

Yahoo uses our shared browser Web Push provider. It does not use a guessed Yahoo SDK or restore the retired Firebase/Stripe browser entry.

Set the game's public build variable `VITE_NOTIFICATION_SERVICE_URL` to the Vercel notification service origin. Map `yahoo` to the exact game origin in the service's `NOTIFICATION_ALLOWED_ORIGINS`. No path, wildcard origin or private key belongs in the game setting.

Notifications have one On/Off row in Settings and default to On. Browser permission remains separate and requires the Settings permission action. Browsers that require installation must meet those requirements. Browser support, permission, OS settings and an active subscription determine delivery after the game closes.

`hosted-notifications-worker.js` receives push events without the game being open. It checks expiry and the stored consent gate, then displays manager-authored title, message and optional image. Clicks open the fixed game launch path. It does not intercept game fetches, run local notification timers or store content templates.

With no service configured, the Settings row explains unavailable delivery and sends no notification requests. The worker still ships in the artifact. Rebuild with the public service origin after the service is ready.

The artifact audit admits only the emitted shared push API module and worker when their integrity manifest matches the build. Firebase, analytics, identity, commerce, multiplayer and other SDKs remain excluded. See the [service setup guide](../common/notifications/service.md).
