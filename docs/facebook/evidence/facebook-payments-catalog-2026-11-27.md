# Facebook payment catalog and readiness — 27 November 2026

The owner selected the current `facebook` branch for this work. The signed-in Meta Game Payments dashboard for Riddle Quest, app `1748953042991569`, was inspected alongside the existing client and server payment integration.

## Catalog correction

All six coin packs already existed with the expected product IDs, prices and consumable type. The durable ad-removal item was missing. It was created with the exact ID used by the shared Facebook catalog and authoritative server allowlist:

- Product ID: `com.roobsworld.riddlequest.remove_interstitial_ads`
- Title: Remove Interstitial Ads
- Description: One-time purchase to remove interstitial ads. Optional rewarded videos remain available.
- Type: Non-consumable
- Base price: $4.99 USD

After saving, the dashboard displayed **7 Number of products** and **Loaded products: 7 of 7**, including the new non-consumable row.

All IDs below use the prefix `com.roobsworld.riddlequest.`.

| Product suffix | Type | Grant | Base USD price |
| --- | --- | --- | --- |
| `coinpack1` | Consumable | 250 coins | $0.99 |
| `coinpack2` | Consumable | 550 coins | $1.99 |
| `coinpack3` | Consumable | 900 coins | $2.99 |
| `coinpack4` | Consumable | 1,600 coins | $4.99 |
| `coinpack5` | Consumable | 3,400 coins | $9.99 |
| `coinpack6` | Consumable | 7,000 coins | $19.99 |
| `remove_interstitial_ads` | Non-consumable | Permanent interstitial-ad removal | $4.99 |

The existing path is `ShopModalPage` → `FacebookCommerceSession` → `FBInstant.payments.purchaseAsync` → signed `grantFacebookPurchase` → consumption after the authoritative grant. The server correlates the receipt with an authenticated V2 webhook before granting. Durables remain unconsumed. Catalog registration required no change to that implementation.

## Remaining readiness requirements

- The Game Payments dashboard displayed **Set up payout** and stated that a valid payment account is required. Payout setup was not performed.
- IAP approval remains outstanding. Registering all products does not prove approval or public checkout availability.
- Meta's read API reported `gaming_profile` and **Instant Games Zero Permission Access** without approval, with rejected grant states. Zero Permission Access appears in the current submission draft; a draft is not approval.
- The generic webhook-subscription API returned no subscriptions. This does not establish the complete V2 payment callback state or prove actual event delivery. The payment-specific dashboard setup and signed event acceptance remain required.
- Local deployment configuration contained `FACEBOOK_DISABLED_FEATURES="commerce,rewarded_ads"` and no `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED=1`. Deployed configuration was not verified or changed.
- In-App Test Payment Mode was already enabled for the signed-in account and was left unchanged. It is not production payment acceptance.

Follow the [payment activation runbook](../facebook-payments.md) for the permission, payout, callback, deployment and acceptance sequence.

## Subscription constraint

The detailed [Instant Games IAP guide](https://developers.facebook.com/documentation/games/monetize/in-app-purchases), read on 27 November, explicitly states that subscriptions are unsupported. Its current Digital Fulfillment Catalog supports only consumable and durable products. The [Payments v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments) provides catalog, one-time checkout, purchase-history, consumption and readiness operations. The [V2 webhook reference](https://developers.facebook.com/documentation/games/monetize/iap-webhooks) documents purchase and refund events, without a recurring subscription lifecycle contract.

Generic Graph `Games IAPProduct` subscription fields and high-level monetization wording do not establish support for Instant Games. No recurring product or simulated subscription was added. A manually renewed pass or permanent Premium unlock requires an explicit product decision; neither was selected for this change.

## Verification scope

`pnpm build:facebook` completed successfully. Target boundaries, commerce activation, all 16 locale keys, licenses, TypeScript compilation, Vite and the Facebook artifact audit passed. The artifact contained 418 files, 4.43 MB in total and 0.66 MB of initial resources. The audit found no Jest SDK, native-module or secret leakage. Vite reported configuration-compatibility and ineffective dynamic-import warnings.

This record also covers source inspection, official API documentation, Meta read APIs and the observed dashboard save result. No tests, browser test harnesses, purchase, refund, payout setup, backend deployment, game upload, review submission or checkout-readiness activation was performed for this catalog correction. The successful build does not establish hosted purchase or refund acceptance.

## Deployed backend follow-up

The continuation on 27 November verified the deployed Functions inventory and narrowly selected nonsecret configuration in `riddle-quest-ec2b2`. All three endpoints are ACTIVE, Gen 2, Node.js 22 in `us-central1`:

| Function | Revision | Last update (UTC) | Disabled features |
| --- | --- | --- | --- |
| `facebookPaymentWebhook` | `facebookpaymentwebhook-00002-som` | 26 Nov 2026 04:03:05 | `commerce,rewarded_ads` |
| `grantFacebookPurchase` | `grantfacebookpurchase-00003-vuq` | 26 Nov 2026 04:04:05 | `commerce,rewarded_ads` |
| `getFacebookClientConfiguration` | `getfacebookclientconfiguration-00039-ger` | 27 Nov 2026 06:51:21 | `commerce` |

All three omit `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED` and `FACEBOOK_PAYMENT_ENVIRONMENTS`, so webhook readiness defaults to false and the accepted environment defaults to `PROD`. Commerce is consistently disabled. The rewarded-ad switch differs between the newer configuration callable and the older payment endpoints; this inspection did not change those unrelated settings.

`pnpm preflight:facebook-backend` passed secret boundaries, deployment configuration, 25 Facebook export checks, directory layout, types, lint, production module-cycle checks and the deployable Functions build. The deployment artifact audit covered 282 modules and 566 upload files. No tests ran and no deployment was performed.

The remaining work is Meta payout and approval setup, V2 callback configuration and signed-event acceptance, followed by explicit checkout activation with consistent deployed configuration. The browser connection was unavailable during this continuation, so no further dashboard change or payout action occurred. The Premium alternative remains unselected.
