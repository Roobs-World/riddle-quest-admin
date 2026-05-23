# Apple App Privacy Disclosure Draft

Last updated: 2026-05-23

Use this draft to complete App Store Connect privacy disclosures. Confirm with the final production build and legal reviewer before submission.

## Data Types Collected

- Contact Info: email address for account authentication.
- User Content: profile avatar images uploaded by the user.
- Identifiers: Firebase UID, FCM token, device/app identifiers from Firebase, Sentry, Google, Meta, and ads SDKs.
- Purchases: product ID, transaction/receipt validation metadata, purchase state, no-ads entitlement.
- Usage Data: gameplay progress, coins, achievements, riddle attempts, ad interactions, feature usage analytics.
- Diagnostics: crash logs, performance diagnostics, device/app state around crashes.

## Linked To User

Likely yes for authentication, profile, purchases, gameplay progress, FCM token, and diagnostics tied to Firebase/Sentry user context.

## Tracking

The app currently configures Google Mobile Ads and includes an ATT usage description. Personalized ads and cross-app tracking must stay disabled unless ATT consent is collected before tracking starts.

## User Controls

- Privacy Policy link is available in sign-up and Settings.
- Terms of Use link is available in sign-up and Settings.
- Licenses link is available in Settings.
- Account deletion and data export request links are available in Settings.

## Review Before Release

Confirm whether production analytics, crash reporting, ads, social login, and messaging SDK settings match these answers exactly. Update App Store Connect if any SDK is added, removed, or reconfigured.
