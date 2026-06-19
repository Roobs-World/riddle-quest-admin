# In-App Purchase Setup Guide - Riddle Quest

This guide matches the current code in `src/services/IapService.ts` and Firebase Functions config in `firebase-functions/src/iapConfig.ts`.

## Quick Overview

This repo is configured to sell 6 coin packs (consumable, one-time purchases):

| Pack  | Coins | Product ID                             |
| ----- | ----- | -------------------------------------- |
| Tiny  | 250   | `com.roobsworld.riddlequest.coinpack1` |
| Small | 550   | `com.roobsworld.riddlequest.coinpack2` |
| Mid   | 900   | `com.roobsworld.riddlequest.coinpack3` |
| Large | 1600  | `com.roobsworld.riddlequest.coinpack4` |
| Huge  | 3400  | `com.roobsworld.riddlequest.coinpack5` |
| Mega  | 7000  | `com.roobsworld.riddlequest.coinpack6` |

Recommended USD ladder for App Store Connect and Google Play Console:

| Pack  | USD  |
| ----- | ---- |
| Tiny  | $0.99 |
| Small | $1.99 |
| Mid   | $2.99 |
| Large | $4.99 |
| Huge  | $9.99 |
| Mega  | $19.99 |

App identifiers:

- Android package name: `com.roobsworld.riddlequest` (from `app.config.js`)
- iOS bundle identifier: `com.roobsworld.riddlequest` (from `app.config.js`)

## iOS (App Store Connect)

1. Log in to App Store Connect.
2. Go to your app -> Features -> In-App Purchases.
3. Create 6 products as Consumable using the Product IDs above.
4. Ensure each product is available for testing/review (metadata complete, screenshot uploaded, etc.).

## Android (Google Play Console)

### Create Products

1. Log in to Play Console.
2. Select the app whose package name is `com.roobsworld.riddlequest`.
3. Go to Monetize -> Products -> In-app products.
4. Create 6 in-app products with IDs matching:
   - `com.roobsworld.riddlequest.coinpack1`
   - `com.roobsworld.riddlequest.coinpack2`
   - `com.roobsworld.riddlequest.coinpack3`
   - `com.roobsworld.riddlequest.coinpack4`
   - `com.roobsworld.riddlequest.coinpack5`
   - `com.roobsworld.riddlequest.coinpack6`
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

- Wrong Play app selected (package name mismatch with `com.roobsworld.riddlequest`)
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

## Seeding Backend Catalog

The backend and client expect a `productPricing` collection in Firestore containing the canonical coin pack entries. For QA and staging you can seed this using the included script `scripts/seedProductPricing.js`.

Prerequisites:

- A Google service account JSON with Firestore write permissions. Recommended IAM role: `roles/datastore.user` (Cloud Datastore User). Alternatives: `roles/datastore.owner` or `roles/firebase.admin`.
- Set `GOOGLE_APPLICATION_CREDENTIALS` to point at the service account JSON.

From the repository root run:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="e:\path\to\your-service-account.json"
node scripts/seedProductPricing.js
```

The script upserts the following documents under `productPricing/{productId}`:

- `com.roobsworld.riddlequest.coinpack1` (250 coins)
- `com.roobsworld.riddlequest.coinpack2` (550 coins)
- `com.roobsworld.riddlequest.coinpack3` (900 coins)
- `com.roobsworld.riddlequest.coinpack4` (1600 coins)
- `com.roobsworld.riddlequest.coinpack5` (3400 coins)
- `com.roobsworld.riddlequest.coinpack6` (7000 coins)
- Firestore `regionalPrices` should mirror the USD ladder above for fallback display.

After seeding, verify the CoinShop in the app shows the server-provided catalog and pricing.
