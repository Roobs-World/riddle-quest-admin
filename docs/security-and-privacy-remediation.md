# Security and Privacy Remediation Notes

Last updated: 2026-06-02

## Completed in repo

- Removed server-only OpenAI, Apple shared secret, Google service account, and Facebook app secret values from Expo `extra`.
- Redacted the tracked backup/runtime secret snapshots in `firebase-functions/.env.default.backup`, `firebase-functions/.runtimeconfig.json`, and `firebase-functions/qwordly-admin-sdk.json` so the current tree no longer carries the live values in plain text.
- Replaced the tracked Jest bootstrap OpenAI token with a non-secret placeholder so tests still get a value without keeping a live key in source.
- Added ignore rules for Firebase Admin service account JSON, Functions runtime config, and local env files.
- Hardened Firestore rules so client writes cannot create or delete user documents, cannot change coin balances, stats, progress, purchase flags, achievements, or owned-progress records, and cannot write user progress/attempt collections directly.
- Restricted avatar profile URLs to Firebase Storage avatar objects under the authenticated user's own path.
- Hardened Storage rules to validate `request.resource` content type, file size, and upload metadata for avatars.
- Added avatar upload metadata from the React Native client to satisfy the Storage rule.
- Added App Check enforcement flags to sensitive callable functions, including the remaining profile username update callable.
- Declared `@react-native-firebase/app-check` in the app manifest, added the App Check Expo config plugin and app startup bootstrap so the client can request App Check tokens before Firebase service usage, and verified the source path with focused App Check service tests.
- 2026-06-02 verification refresh: the focused `AppCheckService` and `profile` tests passed again in this pass and `pnpm exec tsc --noEmit --pretty false` stayed clean, so the repo-side App Check implementation remains source-complete while console activation and live-device verification stay external.
- Added admin authorization checks to manual riddle-generation callable functions.
- Redacted IAP purchase tokens and receipt validation payloads from function logs.
- Replaced the vulnerable `in-app-purchase` dependency with direct Apple and Google validation helpers.
- Replaced placeholder legal URLs with `roobsworld.com` URLs and exposed Privacy, Terms, Licenses, account deletion, and data export links from Settings.
- Wired localized Riddle Quest legal/support URLs for `www.roobsworld.com` in app code for en, es, pt, fr, de, ja, ko, zh, hi, ru, tr, ar, id, it, nl, pl, and vi.
- 2026-06-02 ATT refresh: the release decision remains the no-tracking posture, with IDFA disabled and personalized ads/cross-app tracking kept off unless a future release adds consent-gated tracking.

## Requires off-repo action

- Rotate the committed Firebase Admin service account key in Google Cloud IAM.
- Rotate every secret that appeared in tracked `.env`, Functions `.env.default.backup`, or `.runtimeconfig.json` files.
- Purge historical secrets from git history using an audited history rewrite such as `git filter-repo`, then force-push according to the repository's release process.
- Enable Firebase App Check enforcement for the deployed callable functions in Firebase after clients have valid App Check providers configured. The repo code now also includes the client bootstrap, Expo plugin wiring, and focused source verification; the remaining step is console activation and live client verification.
- Deploy the locally verified legal/support URL matrix from `localhost:3000` to `www.roobsworld.com` when deployment is available; for now, assume the live links will work because the identical local route matrix passed on 2026-05-23.
- Apple App Privacy and Google Play Data Safety comparison is complete against the current data inventory and observed app behavior. The remaining step is owner-controlled console submission in App Store Connect / Play Console, using the hosted `www.roobsworld.com/riddle-quest/en/privacy-policy` URL where those forms require one canonical privacy policy URL after it is reachable.
- 2026-06-02 verification refresh: the disclosure drafts remain aligned with the current no-tracking posture, and the source-side App Check/security changes stay verified. The remaining work is still external console submission and credential rotation.
- Review ATT consent requirements with the final ad-tracking configuration before release.

## Data Inventory for Store Disclosures

- Authentication: email/password, Google Sign-In, Facebook login provider identifiers.
- User profile: username, display name, avatar URL, Firebase UID, account timestamps.
- Gameplay: coins, XP, level, stats, progress, achievements, riddle attempts, daily challenge completion.
- Purchases: product IDs, server-side receipt validation results, processed purchase fingerprints/IDs for idempotency.
- Ads: rewarded ad callbacks, ad interaction records, no-ads purchase flag.
- Diagnostics and analytics: Firebase Analytics events, Crashlytics/Sentry crash reports, device/app diagnostics.
- Messaging: FCM registration token and token update timestamp.
- Storage: user-uploaded avatar image files and generated account export files.

## Legal Links

Canonical host: `https://www.roobsworld.com`.

- Privacy Policy: `https://www.roobsworld.com/riddle-quest/en/privacy-policy`
- Terms of Use / EULA: `https://www.roobsworld.com/riddle-quest/en/terms-of-use`
- Licenses and third-party notices: `https://www.roobsworld.com/riddle-quest/en/third-party-licenses`
- Account deletion: `https://www.roobsworld.com/riddle-quest/en/account-deletion`
- Data export: `https://www.roobsworld.com/riddle-quest/en/data-export`

Localized equivalents are available locally for `en`, `es`, `pt`, `fr`, `de`, `ja`, `ko`, `zh`, `hi`, `ru`, `tr`, `ar`, `id`, `it`, `nl`, `pl`, and `vi` at `/riddle-quest/{language}` with the same page slugs. Treat the local 200 matrix as current acceptance evidence until live deployment is available.
