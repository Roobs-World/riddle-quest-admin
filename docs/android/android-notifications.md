# Hosted notifications on Android

Android uses the same hosted notification manager as browser targets. The manager authors campaign titles, bodies and images, and schedules server-side dispatch. Native FCM is the Android device transport. There is no native iOS application in this integration; Safari and Home Screen web apps use the browser transport.

The app has one Notifications preference, controlled on its notification Settings screen. A missing preference defaults to On. Explicit saved Off remains Off, including legacy records whose invitation and Daily flags are both false. A malformed saved record fails closed. Android permission is separate from this preference and only prompts after a Settings action. Startup and foreground restoration never prompt.

## Authority and registration

The app retains Firebase JS authentication, anonymous Android provisioning and Google linking without changing uid. It does not create a second native authentication identity. Native Firebase Messaging supplies the installation token.

`setAndroidPushSubscription` verifies Firebase authentication, Android provider, App Check, the expected account and account deletion. The app supplies a durable native `deviceEpoch` and a stable private UUID `deviceId`. An independent `androidNotificationDevices` record fences the operation across token rotations before any master preference or token writes; the token transaction also refuses an older operation or an equal operation bound to a different account. The authoritative token revision increases independently. Automatic registration and rotation cannot change the canonical master preference in either direction; only explicit Settings changes can. A local saved Off still disables that installation. Off applies locally before contacting the server, cancels displayed notifications and image work, and records a newer disabled token fence when a cached token exists. It needs no fresh FCM token request.

The authoritative token, uid, consent, stable device identity, device epoch and registration revision stay in `androidPushTokens`. The server synchronizes only `{version, tokenHash, revision, enabled, locale, expiresAtMs}` to `/api/devices/android/registration` on the manager. Supabase receives neither raw FCM tokens nor game uids. A stale manager row cannot bypass Firebase's current binding, capability, consent, revision or deletion checks.

Legacy clients may still submit their old consent payload. They cannot enroll an active manager campaign subscription and cannot overwrite a modern fenced token binding. Legacy Off still revokes the account's notifications and disables known manager references. Install the updated APK before expecting campaign text/images.

## Server configuration

Configure these values through the authorized deployment process:

| Host | Setting | Required value |
| --- | --- | --- |
| Firebase Secret Manager | `NOTIFICATION_MANAGER_BRIDGE_SECRET` | The same high-entropy server-only secret used by Vercel, at least 32 characters |
| Firebase Functions environment | `NOTIFICATION_MANAGER_URL` | Exact HTTPS origin of the hosted manager, with no path or trailing slash |
| Vercel server environment | `NOTIFICATION_MANAGER_BRIDGE_SECRET` | Matching bridge secret |
| Vercel server environment | `ANDROID_NOTIFICATION_BRIDGE_URL` | Exact HTTPS URL of `dispatchAndroidNotification` in `europe-west1` |

Use URL-safe random secret material compatible with the manager's configuration validation. Never bundle it into the app. The manager does not receive an FCM service-account key. Firebase continues using its existing server credentials and project registration.

A missing manager configuration leaves the saved preference On with delivery `not-configured`. Native delivery is not marked ready until registration synchronization succeeds. Registration HTTP work has an eight-second bound and refuses redirects.

## Campaign dispatch and display

The manager sends the portable `AndroidDispatch` contract to the authenticated Firebase endpoint: token hash, expected revision, campaign notification ID, title, body, optional HTTPS image and immutable expiry. Firebase binds the immutable payload digest to a receipt keyed by campaign and token hash before FCM. Repeated requests return the recorded outcome; conflicting bytes are rejected. An uncertain attempt is never blindly resent.

Firebase rechecks the current token revision, campaign-capable client, master preference, account provider, freshness and deletion before sending a data-only FCM message. Distinct campaigns do not share a global collapse key. FCM acceptance is recorded separately from actual device delivery.

Native display validates the account, local consent, OS permission, campaign identity, registration revision and expiry. It preserves manager-authored text within the shared limits. Each campaign has a distinct notification tag and opens the app launcher when tapped. Campaigns do not create an in-app notification feed or grant rewards.

Images use bounded WorkManager processing. Downloads require admitted HTTPS URLs, have network and byte limits, and undergo image-size validation. Display rechecks owner, consent, revision and expiry after processing. The exact manager-authored title and body appear immediately. A successful image download updates that same notification without another alert; an unavailable image leaves the authored text visible. The receiver never generates substitute content or artwork. The app icon and channel name remain Android system metadata.

## Rotation and lifecycle

`onNewToken` persists the new token and notifies active JavaScript. Authenticated restoration refreshes it when JavaScript is available or the app next enters the foreground. Only acknowledgement of that exact token clears its pending marker. Native code never creates another Firebase identity to refresh in the background.

The stable device record also tracks the current token hash. Rotation retires the previous same-device binding and disables its manager reference, so repeated rotations do not consume extra installation slots.

Native command generations prevent an older JavaScript operation from reactivating Off or rebinding a replacement account. Registration revisions also fence delayed campaign and image work. Retiring the controller when the game closes leaves established background delivery enabled; explicit Off and account retirement cancel local display.

FCM supports background messages, but delivery remains subject to Android permission, connectivity, expiry and OS restrictions. A force-stopped app must reopen before receiving again. See [Firebase background handling](https://firebase.google.com/docs/cloud-messaging/android/receive-messages) and [delivery prerequisites](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages). Supplied images require WorkManager because the receiver has a short processing window. [Firebase message processing](https://firebase.google.com/docs/cloud-messaging/android-message-priority).

## Release verification

Build Functions and the native APK after changing this integration. Run tests and browser/device harnesses only when explicitly requested. An authorized deployment must configure the bridge, deploy the Firebase dispatch endpoint and updated registration callable, apply the manager schema, and install the updated APK. Retire the old daily reminder scheduler. No live notification, deployment, game upload or publication follows from source changes or builds.
