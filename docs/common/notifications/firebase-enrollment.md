# Firebase account and device enrollment

Firebase project `riddle-quest-ec2b2` owns player identity, browser subscriptions, device consent and account deletion. Supabase owns operator login, authored campaigns, scheduling and delivery receipts. Players do not sign into Supabase or Google to enroll. Their existing verified Firebase UID authorizes the connection, regardless of the email or platform used to create it.

## Player flow

An eligible account sees a separate Notifications modal after the startup welcome menu closes. First-time players finish Instructions first, and the request waits for registration, guidance and any other dialog to close. The same action remains in Settings. The modal offers a manager registration handoff once per account visit when the saved preference is On. The game does not inspect whether a device is already connected. The manager's page checks existing permission and subscriptions. Default On preserves global consent without granting browser permission. Guests and platforms without an eligible manager registration provider do not receive this handoff.

Jest guests see the Settings notification control disabled and displayed as Off, without a browser compatibility error or permission action. The existing platform registration state enables the control after registration through Profile.

Registration failures and preference-save failures have separate translated messages and retry controls. The game never reports device readiness. A successfully issued handoff does not imply that a browser subscription or manager device registration exists.

The explicit registration action saves account consent and calls `createNotificationEnrollment`. Firebase validates the current account, deletion boundary, provider claims and global preference, then issues a random one-time code. The code expires after ten minutes and is stored only as a hash in Firebase. It travels in the handoff URL fragment, which the manager removes from the visible URL after loading.

The game does not open or track popup windows. Its modal displays the validated, account-bound manager link in a selectable, read-only field with a Copy setup link button. If the browser denies clipboard access, the button selects the field for manual copying. The private handoff is excluded from game screenshots and cleared on expiry, consent Off or account retirement. The game stores no pairing proof, listens for no enrollment messages and performs no device-status request on focus or startup.

The [November 25 sandbox setup record](evidence/jest-popup-fallback-2026-11-25.md) records the observed frame restriction, corrected modal flow and source verification.

The shared `/push/` page requests browser permission, installs its own service worker and registers the browser subscription. A server-only Vercel bridge redeems the code against Firebase. The client cannot select another UID or provider. Firebase binds the subscription to the verified account and sends only an opaque device hash, target, revision, locale and expiry to the manager. The manager's page confirms completion on the device. New games have no completion listener; the legacy message remains compatible with older uploaded clients.

Previously granted permission does not require another prompt. Opening a fresh connection link on that browser enrolls it automatically after permission and account checks. A returning manager page verifies that a local subscription still exists before renewing its Firebase lease. Game visits no longer renew device leases. The current browser lease lasts 30 days, so a device that never revisits the manager page can expire. Manager acknowledgements include lease expiry, allowing synchronization retries. This cannot create a subscription or restore revoked consent. New devices must grant permission once; historical Firebase logins cannot recover missing subscriptions. On iOS, the player installs the enrollment page on the Home Screen and transfers the one-time connection code to that installed app.

## Shared platform capability

`src/notifications/controllers/managerNotificationProvider.ts` owns account consent and the transient handoff. Its only setup operation is `register`. `src/notifications/browser/firebaseRegistration.ts` binds that operation to the existing authenticated callable, validates the expected UID, account lifetime, manager origin, path, code and expiry, and returns the handoff. Neither module exposes device permission, response handling or delivery status. A platform with a server gateway can supply the same registration callback through its gateway without importing Firebase into its browser artifact.

Jest and Facebook currently use this shared capability. Their game artifacts contain neither a notification worker nor Firebase Messaging; enrollment and browser push run on the separately hosted page. Native Android retains its FCM adapter. Yahoo retains its independent anonymous hosted subscription because its candidate build has no account identity. Reddit requires a Devvit gateway adapter, while YouTube, Netflix and GameSnacks retain their existing notification restrictions. A generic enrollment page does not grant a platform permission to add forbidden SDKs or network traffic.

The Firebase pairing authority resolves trusted provider claims against the canonical account profile. It accepts the existing verified Jest, Facebook, Reddit and Android account forms, conventional Firebase account providers, and future custom providers with matching trusted claims and server-owned profile data. It never infers ownership from email or user-supplied metadata. Provider identities remain separate unless an explicit account-linking flow unifies them.

Enrollment is the platform's role. Campaign authoring, scheduling and sending remain in the notification manager. The platform that originally identified a player does not receive the push on their behalf; the enrolled browser or native Android device receives it through its device transport.

## Delivery and device ownership

Each browser credential owns one device handle. Explicit pairing can move that handle to the currently selected account; revisions prevent queued notifications for its previous owner from displaying. The browser registry has no five-device ceiling. Native Android retains its existing separate registration limits.

Campaigns fan out over every eligible device routing row in the selected platform audience. A database cursor pages that audience without a fixed total-recipient cap. Firebase checks account existence, deletion, stored device consent, master preference, revision and expiry before submitting Web Push. The worker checks Firebase again before display and rejects stale revisions, revoked consent and expired messages. If this check is unavailable, it does not display the notification. Per-campaign/device receipts and serialized worker processing suppress duplicate submissions and displays after uncertain retries.

New enrollments on supported browsers use a private FCM token. Existing Web Push subscriptions retain their route. Firebase applies the same account and consent checks to both, and the browser worker handles display and taps. [Supabase FCM delivery](supabase-fcm.md)

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

The reviewed migration, Firebase functions, website and scheduler are deployed; see [release operations](service.md#notification-service-release-on-november-24-2026). Updated game versions still require activation after their release checks. TTL is configured on `expiresAt` for `accountPushDevices`, `accountPushEndpoints`, `accountPushDeliveries`, `notificationPairings` and `notificationPairingLimits`; runtime expiry checks already fail closed independently of TTL cleanup. Preserve the scheduler setup described in [service operations](service.md).

The [November 25 manager registration release](../../jest/evidence/jest-manager-registration-only-2026-11-25.json) confirms that version `01a211e5-afe7-7735-a223-04c1e3f67488` is ready and active. It was activated at 08:50 UTC and removes device-status polling, pairing-proof storage, popup tracking and enrollment responses from the game. The post-menu registration modal and private manager handoff remain. An old version-pinned preview or already-open tab must be distinguished from the active build when checking behavior.

Follow the [standing Jest release authorization](../../jest/jest-html5-operations.md#build-and-upload) after completing a Jest game build. Other platform uploads and game publication retain their explicit authorization requirements. Real-device enrollment and live push delivery remain acceptance work after the updated client is activated or opened through its inactive preview.

## References

- [Firebase Web Push permission and registration requirements](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Browser notification permission restrictions](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [Jest notification channels](https://docs.jest.com/sdk/html5/notifications)
