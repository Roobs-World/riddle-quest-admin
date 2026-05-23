# Ad Tracking And ATT Review

Last updated: 2026-05-23

## Current Repo State

- `NSUserTrackingUsageDescription` is present for iOS.
- Facebook SDK config disables advertiser ID collection and automatic app events in Expo config.
- Google Mobile Ads is configured with app IDs from environment variables and test IDs as defaults.
- There is no in-app ATT prompt flow in the audited code.

## Release Decision

Before release, choose one of these paths:

1. No tracking
   - Keep personalized ads and cross-app tracking disabled.
   - Do not access IDFA.
   - Ensure SDK dashboards match the no-tracking posture.

2. Tracking with consent
   - Add an ATT consent prompt before any tracking SDK accesses IDFA or cross-app tracking data.
   - Gate ad personalization and tracking SDK initialization on consent.
   - Update App Store privacy answers to disclose tracking.

## Recommended Default

Ship with the no-tracking posture unless the product explicitly needs personalized ads. This is simpler, safer, and consistent with the current Facebook SDK privacy-focused defaults.
