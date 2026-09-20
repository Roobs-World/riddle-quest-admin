# Yahoo Stripe commerce operations

The Yahoo web release uses Stripe-hosted Checkout with Managed Payments for the six shared consumable coin packs. Stripe acts as merchant of record for these transactions. Yahoo authentication remains the account boundary. The browser never grants coins and never receives a Stripe secret.

## Runtime flow

1. `createYahooStripeCheckout` requires a Firebase user carrying the server-issued `provider: yahoo` claim and resolves the requested SKU from the server-owned catalog.
2. Stripe hosts payment collection and returns the player to `https://yahoo.roobsworld.com/`.
3. `yahooStripeWebhook` verifies Stripe's signature over the raw request body. `confirmYahooStripeCheckout` independently verifies the returned session for immediate account refresh.
4. Both paths use the same Firestore transaction. Checkout Session and Payment Intent identifiers are hashed, duplicate delivery cannot grant twice, and deleted accounts fail closed.
5. A full Stripe refund removes available purchased coins. Coins already spent become account debt, which later Yahoo Stripe grants repay before increasing the spendable balance.

## Activation

Store the Stripe restricted server key and webhook signing secret as Firebase Functions secrets:

```bash
pnpm --dir firebase-functions exec firebase functions:secrets:set STRIPE_SECRET_KEY --project riddle-quest-ec2b2
pnpm --dir firebase-functions exec firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project riddle-quest-ec2b2
```

Deploy the commerce boundary:

```bash
pnpm --dir firebase-functions build
pnpm --dir firebase-functions exec firebase deploy \
  --only functions:createYahooStripeCheckout,functions:confirmYahooStripeCheckout,functions:yahooStripeWebhook \
  --project riddle-quest-ec2b2
```

Register this Stripe webhook endpoint:

```text
https://us-central1-riddle-quest-ec2b2.cloudfunctions.net/yahooStripeWebhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

Use a Stripe sandbox first. Complete one checkout for every coin pack, replay the same webhook, and confirm that the second delivery does not change the balance. Then issue a full refund after spending part of the pack and confirm that the account records debt without allowing a negative coin balance.

Partial refunds deliberately do not reverse virtual currency. Do not enable partial refunds operationally until a proportional coin policy is defined and tested.
