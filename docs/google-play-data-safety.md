# Google Play Data Safety Draft

Last updated: 2026-06-02

Use this draft to complete Play Console Data Safety disclosures. Confirm with the final production build and legal reviewer before submission.

## Data Collected

- Personal info: email address, display name/username.
- Photos and videos: user-selected avatar image.
- App activity: gameplay progress, achievements, riddle attempts, ad interactions, app feature usage.
- App info and performance: crash logs, diagnostics, app performance metrics.
- Device or other IDs: Firebase installation identifiers, FCM token, advertising-related identifiers if enabled by SDK configuration.
- Financial info: purchase history and purchase validation metadata for in-app purchases.
- Analytics data: Firebase Analytics screen views, auth events, gameplay events, purchase events, ad events, and shop events.
- Messages: Firebase Cloud Messaging token and notification delivery metadata.

## Data Sharing

Data may be processed by Firebase/Google services, Sentry, OpenAI for server-side riddle generation, Meta/Facebook login, Google Sign-In, Google Mobile Ads, Apple/Google purchase validation, and app store billing providers.

## Security Practices

- Data is transmitted over encrypted transport.
- Account deletion and data export request paths are linked from Settings.
- Server-only credentials are kept in Firebase Functions secrets.
- Client writes to economy/progress/purchase state are restricted by Firestore rules.

## Review Before Release

Confirm the final production build's SDK list and backend processing before submission. Update the Play Console form if ad personalization, analytics settings, social login, crash reporting, or messaging behavior changes.

## Console Entry Status

This draft is ready for Play Console entry once access is available. The answers should match the current production build, the shared legal metadata, the no-tracking release decision, and the final SDK list before submission. The source-side privacy posture remains verified as of 2026-06-02, but console submission is still external.
