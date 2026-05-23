# Security and Privacy Remediation Notes

Last updated: 2026-05-23

## Completed in repo

- Removed server-only OpenAI, Apple shared secret, Google service account, and Facebook app secret values from Expo `extra`.
- Added ignore rules for Firebase Admin service account JSON, Functions runtime config, and local env files.
- Hardened Firestore rules so client writes cannot change coin balances, stats, progress, purchase flags, achievements, or owned-progress records.
- Restricted avatar profile URLs to Firebase Storage avatar objects under the authenticated user's own path.
- Hardened Storage rules to validate `request.resource` content type, file size, and upload metadata for avatars.
- Added avatar upload metadata from the React Native client to satisfy the Storage rule.
- Added App Check enforcement flags to sensitive callable functions.
- Added admin authorization checks to manual riddle-generation callable functions.
- Redacted IAP purchase tokens and receipt validation payloads from function logs.
- Replaced the vulnerable `in-app-purchase` dependency with direct Apple and Google validation helpers.
- Replaced placeholder legal URLs with `roobsworld.com` URLs and exposed Privacy, Terms, Licenses, account deletion, and data export links from Settings.

## Requires off-repo action

- Rotate the committed Firebase Admin service account key in Google Cloud IAM.
- Rotate every secret that appeared in tracked `.env`, Functions `.env.default.backup`, or `.runtimeconfig.json` files.
- Purge historical secrets from git history using an audited history rewrite such as `git filter-repo`, then force-push according to the repository's release process.
- Enable Firebase App Check enforcement for the deployed callable functions in Firebase after clients have valid App Check providers configured.
- Complete Apple App Privacy and Google Play Data Safety forms from the current data inventory.
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

- Privacy Policy: `https://www.roobsworld.com/privacy`
- Terms of Use: `https://www.roobsworld.com/terms`
- Licenses and third-party notices: `https://www.roobsworld.com/licenses`
- Account deletion: `https://www.roobsworld.com/account/delete`
- Data export: `https://www.roobsworld.com/account/export`
