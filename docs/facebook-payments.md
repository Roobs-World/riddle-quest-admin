# Activate Facebook payments

Facebook checkout uses `FBInstant.payments`. The backend requires both a signed purchase receipt and an authenticated V2 payment webhook before granting anything.

As of 23 November 2026, the implementation is present but checkout remains disabled. The current Meta app has no approved Gaming Profile or Instant Games Zero Permission Access permission. Neither a saved callback nor a successful verification handshake proves that payment events will arrive. No hosted purchase or refund acceptance is claimed for this change. The build wrapper ran 11 boundary tests before its embedded test step was noticed. No gameplay or server test suites or browser harnesses were run.

## Obtain the required permission

1. Open the Riddle Quest app in the Meta App Dashboard.
2. Request approval for **Gaming Profile** or **Instant Games Zero Permission Access**.
3. Keep `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED=0` until one permission is approved and actual V2 event delivery is accepted.

Meta checks the permission when delivering events, including events for development apps. The current [IAP webhook guide](https://developers.facebook.com/documentation/games/monetize/iap-webhooks) describes this requirement and the dashboard subscription procedure. Graph API subscription is unsupported for these payment events.

## Deploy the receipt and callback endpoints

1. Deploy the current Functions unit, including `grantFacebookPurchase`, `facebookPaymentWebhook`, `getFacebookClientConfiguration`, and the shared account deletion handlers, with the normal Functions deployment workflow.
2. Keep the existing `FACEBOOK_APP_SECRET` and `FACEBOOK_UID_SECRET` in Secret Manager.
3. Keep the initial nonsecret configuration as follows.

```dotenv
FACEBOOK_PAYMENTS_WEBHOOK_ENABLED=0
FACEBOOK_PAYMENT_ENVIRONMENTS=PROD
```

For an explicitly accepted sandbox rollout, add the required `DEV`, `DEV_EXTERNAL`, or `TEST` environment to `FACEBOOK_PAYMENT_ENVIRONMENTS`. A signed event from another environment receives `200` and grants nothing. Malformed configuration fails deployment validation.

The callback accepts authenticated refunds even when `commerce` is in `FACEBOOK_DISABLED_FEATURES` or checkout readiness is zero. An emergency checkout switch must not prevent refund reconciliation.

## Configure the V2 callback

1. Open **Use Cases**, then **Webhook**, for the app in the Meta App Dashboard.
2. Set the callback URL to `https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/facebookPaymentWebhook`.
3. Derive the verify token privately with `facebookPaymentsVerifyToken(appSecret, appId)` from `firebase-functions/src/facebook/facebookPaymentContracts.ts`.
4. Enter that derived value in the dashboard's **Verify Token** field.
5. Complete the dashboard's callback verification and subscribe to the V2 `in_app_purchase` field.
6. Confirm that actual signed purchase and refund callbacks arrive after permission approval.

The verify token is the lowercase hexadecimal HMAC-SHA256 of `riddle-quest-facebook-payments-webhook-v1`, a null byte, and the configured app ID, keyed by the existing app secret. Generate the value in a trusted secret-aware environment. Do not put the app secret or the derived verify token in source control, browser configuration, chat, or application logs.

The handshake accepts a `GET` request whose `hub.mode` is `subscribe` and whose `hub.verify_token` matches that derived value. The response echoes the bounded `hub.challenge` as plain text. Payment `POST` requests require `application/json` and an `X-Hub-Signature-256` HMAC over the original raw bytes. The handshake token does not authenticate payment events.

## Accept the complete purchase flow

1. Keep public checkout disabled while completing the approved role-account acceptance procedure.
2. Confirm that the native catalog contains the six coin products and the ad-free durable product from `packages/core/src/pricing/facebookCatalog.ts`.
3. Confirm that the signed SDK receipt and signed webhook identify the same purchase token and product.
4. Confirm that the webhook's `user_id` equals the player's game-scoped `FBInstant.player.getID()` value.
5. Confirm that the grant succeeds once and returns the authoritative balance.
6. Interrupt consumption after the grant, then confirm that startup or resume recovery does not grant the purchase twice.
7. Confirm that a refund removes the unspent grant, records debt for spent coins, and revokes only the refunded durable entitlement.
8. Confirm that a refund delivered before purchase confirmation prevents a later grant.
9. Confirm that account deletion removes token owner links and prevents old receipts from granting into a recreated account.
10. Record the accepted app, backend revision, artifact hash, payment environment, and sanitized outcomes.
11. Set `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED=1` only after these prerequisites are accepted, then deploy the configuration and restart the game.

Do not record provider identifiers, purchase tokens, signatures, or app secrets in acceptance evidence. A build or type check does not establish hosted payment acceptance.

## Follow the server-owned grant contract

The current [Payments v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments) lists no signed player ID. `developer_payload` is deprecated and stops being populated after 30 October 2026. The implementation uses neither field to establish ownership.

`grantFacebookPurchase` accepts only `{signedRequest}`. It verifies HMAC-SHA256 over the encoded receipt payload, the app ID, an unconsumed `charge`, timestamps, and the server product allowlist. The verified webhook supplies the token's player owner. JSON integer tokens are preserved before parsing so int64 identifiers cannot round through a JavaScript number.

The callable requires Firebase App Check and a Facebook session whose account generation matches the captured webhook owner and current provider identity. Missing purchase confirmation returns a retryable error. No grant or SDK consumption occurs while confirmation is pending.

The successful response contains `granted`, `providerReceiptId`, `consume`, `newCoins`, `coinsAwarded`, and `removeInterstitialAds`. The receipt ID is a provider-scoped hash. Replays return `coinsAwarded: 0` and the current balance. Consumables are consumed only after the authoritative grant commits. The durable ad-free product remains unconsumed.

`facebookPaymentTokens` serializes token ownership, receipt linkage, and refund state with the grant transaction. The ledger also keys grants by the hashed payment ID. Refunds retain their first accepted event timestamp and use a token-derived idempotency key. A refund update conflicts with an in-flight grant, so a refunded token cannot slip through a stale read.

Account deletion replaces a token's owner with a permanent `deleted` marker and erases its provider identity link. Later callbacks cannot rebind that token. Known old generations are rejected directly. Previously unseen delayed receipts must also pass the recreated generation's conservative timestamp cutoff. Checkout readiness remains false during the ambiguous deletion second.
