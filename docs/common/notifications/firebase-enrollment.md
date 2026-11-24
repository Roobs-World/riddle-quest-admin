# Firebase account and device enrollment

Firebase project `riddle-quest-ec2b2` owns player identity, browser subscriptions, device consent and account deletion. Supabase owns operator login, authored campaigns, scheduling and delivery receipts. Players do not sign into Supabase or Google to enroll. Their existing verified Firebase UID authorizes the connection, regardless of the email or platform used to create it.

## Player flow

An eligible new account sees the existing translated notification action during welcome onboarding. The same action remains in Settings. Default On preserves the global preference but does not grant browser permission. Guests and platforms without an eligible notification provider do not see the enrollment action.

The game opens a window synchronously from that action and calls `createNotificationEnrollment`. Firebase validates the current account, deletion boundary, provider claims and global preference, then issues a random one-time code. The code expires after ten minutes and is stored only as a hash in Firebase. It travels in the enrollment URL fragment, which is removed from the visible URL after loading.

The shared `/push/` page requests browser permission, installs its own service worker and registers the browser subscription. A server-only Vercel bridge redeems the code against Firebase. The client cannot select another UID or provider. Firebase binds the subscription to the verified account and sends only an opaque device hash, target, revision, locale and expiry to the manager. A completed pairing is confirmed to the originating game through a checked popup message and a fresh authenticated Firebase query.

Previously granted permission does not require another prompt. Opening a fresh connection link on that browser enrolls it automatically after permission and account checks. A returning enrollment page verifies that a local subscription still exists before renewing its Firebase lease. New devices must grant permission once; historical Firebase logins cannot recover missing subscriptions. On iOS, the player installs the enrollment page on the Home Screen and transfers the one-time connection code to that installed app.

## Shared platform capability

`src/notifications/browser/firebaseEnrollment.ts` has no Firebase SDK dependency. It accepts a backend with `createEnrollment({locale})` and `getEnrollmentStatus({pairingCode?})`, a current-account predicate and the configured manager origin. A platform using Firebase directly can reuse `firebaseEnrollmentBackend.ts`. A platform with a server gateway supplies the same interface through its gateway instead.

Jest and Facebook currently use this shared capability. Their game artifacts contain neither a notification worker nor Firebase Messaging; enrollment and browser push run on the separately hosted page. Native Android retains its FCM adapter. Yahoo retains its independent anonymous hosted subscription because its candidate build has no account identity. Reddit requires a Devvit gateway adapter, while YouTube, Netflix and GameSnacks retain their existing notification restrictions. A generic enrollment page does not grant a platform permission to add forbidden SDKs or network traffic.

The Firebase pairing authority resolves trusted provider claims against the canonical account profile. It accepts the existing verified Jest, Facebook, Reddit and Android account forms, conventional Firebase account providers, and future custom providers with matching trusted claims and server-owned profile data. It never infers ownership from email or user-supplied metadata. Provider identities remain separate unless an explicit account-linking flow unifies them.

## Delivery and device ownership

Each browser credential owns one device handle. Explicit pairing can move that handle to the currently selected account; revisions prevent queued notifications for its previous owner from displaying. The browser registry has no five-device ceiling. Native Android retains its existing separate registration limits.

Campaigns fan out over every eligible device routing row in the selected platform audience. A database cursor pages that audience without a fixed total-recipient cap. Firebase checks account existence, deletion, stored device consent, master preference, revision and expiry before submitting Web Push. The worker checks Firebase again before display and rejects stale revisions, revoked consent and expired messages. If this check is unavailable, it does not display the notification. Per-campaign/device receipts and serialized worker processing suppress duplicate submissions and displays after uncertain retries.

The manager's registered browser-device count comes from Firebase, alongside the canonical account count. It excludes native Android devices and does not claim that every account has a reachable device or that every registered device currently permits delivery. Missing bridge configuration displays an unavailable count rather than zero.

## Release configuration

Prepare these values without putting secret values into source, browser variables or logs:

| Location | Setting |
| --- | --- |
| Firebase Secret Manager and Vercel | Matching `NOTIFICATION_MANAGER_BRIDGE_SECRET` |
| Firebase Secret Manager | Stable `HOSTED_PUSH_VAPID_PRIVATE_KEY` |
| Firebase Functions environment | `NOTIFICATION_MANAGER_URL=https://riddle-quest-admin.vercel.app` |
| Firebase Functions environment | Matching `HOSTED_PUSH_VAPID_PUBLIC_KEY` and a real `HOSTED_PUSH_VAPID_SUBJECT` |
| Firebase Functions environment | Optional `NOTIFICATION_GAME_URLS`, a JSON map of provider IDs to trusted HTTPS game URLs |
| Vercel | `NOTIFICATION_MANAGER_URL=https://riddle-quest-admin.vercel.app` |
| Vercel | `FIREBASE_NOTIFICATION_BRIDGE_URL=https://europe-west1-riddle-quest-ec2b2.cloudfunctions.net/notificationBrowserBridge` |
| Vercel | `FIREBASE_NOTIFICATION_TARGETS`, initially only the released and verified game adapters |
| Game builds | `VITE_NOTIFICATION_SERVICE_URL`, the exact enrollment service origin |

Apply the reviewed `firebase_push_devices` Supabase migration, deploy the four new Firebase functions and updated deletion handlers, then deploy the website and release the affected games. Configure TTL on `expiresAt` for `accountPushDevices`, `accountPushEndpoints`, `accountPushDeliveries`, `notificationPairings` and `notificationPairingLimits`; runtime expiry checks already fail closed independently of TTL cleanup. Preserve the scheduler setup described in [service operations](service.md).

Source and build verification do not authorize game uploads, activation or publication. End-to-end enrollment and live push delivery remain acceptance work after the coordinated release.

## References

- [Firebase Web Push permission and registration requirements](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Browser notification permission restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [Jest notification channels](https://docs.jest.com/sdk/html5/notifications)
