# In-App Purchase Setup Guide - Qwordly

This guide matches the current code in `src/services/IapService.ts` and Firebase Functions config in `firebase-functions/src/iapConfig.ts`.

## Quick Overview

This repo is configured to sell 5 coin packs (consumable, one-time purchases):

| Pack | Coins | Product ID |
| ---- | ----- | ---------- |
| Tiny | 50 | `com.qwordly.coinpack1` |
| Small | 100 | `com.qwordly.coinpack2` |
| Mid | 250 | `com.qwordly.coinpack3` |
| Large | 500 | `com.qwordly.coinpack4` |
| Huge | 1000 | `com.qwordly.coinpack5` |

App identifiers:

- Android package name: `com.grindhead.qwordly` (from `app.config.js`)
- iOS bundle identifier: `com.grindhead.qwordly` (from `app.config.js`)

## iOS (App Store Connect)

1. Log in to App Store Connect.
2. Go to your app -> Features -> In-App Purchases.
3. Create 5 products as Consumable using the Product IDs above.
4. Ensure each product is available for testing/review (metadata complete, screenshot uploaded, etc.).

## Android (Google Play Console)

### Create Products

1. Log in to Play Console.
2. Select the app whose package name is `com.grindhead.qwordly`.
3. Go to Monetize -> Products -> In-app products.
4. Create 5 in-app products with IDs matching:
   - `com.qwordly.coinpack1`
   - `com.qwordly.coinpack2`
   - `com.qwordly.coinpack3`
   - `com.qwordly.coinpack4`
   - `com.qwordly.coinpack5`
5. Activate each product (not Draft).

### Testing (avoids "sku-not-found")

Android IAP will fail with `sku-not-found` if you test from a local debug/dev build. For Android, test via Play.

1. Add tester accounts:
   - Play Console -> Setup -> License testing (add your tester Gmail)
   - Play Console -> Testing -> Internal testing (add same tester Gmail)
2. Upload an Android App Bundle (AAB) to the Internal testing track and roll out the release (new versionCode required).
3. Install the build from the Play Internal Testing opt-in link (do not use `expo run:android`, and do not sideload).
4. Ensure the device is signed into Google Play Store with the tester account.
5. Wait for Play propagation (often 15 minutes to a few hours) and retry.

If you still see `sku-not-found`, the usual causes are:

- Wrong Play app selected (package name mismatch with `com.grindhead.qwordly`)
- Product IDs created under a different app
- Product not Active
- Device is logged into a non-tester Play account
- Propagation delay

## Backend Validation (Firebase Functions)

The app validates purchases server-side via Firebase Functions (`validatePurchase`).

Android validation requires Play service account credentials configured as function environment:

- `GOOGLE_SERVICE_ACCOUNT` should be a JSON string containing at least `client_email` and `private_key`.

See `firebase-functions/src/iapConfig.ts` for how credentials are read and passed to the `in-app-purchase` library.

## Code Reference

Product IDs and coin mapping:

- `src/services/IapService.ts`
- `firebase-functions/src/iapConfig.ts`

## Smoke Test Checklist

- Open coin shop -> products display with prices
- Tap a pack -> Google purchase sheet opens
- Complete purchase -> app shows success + coins increase (after server validation)

