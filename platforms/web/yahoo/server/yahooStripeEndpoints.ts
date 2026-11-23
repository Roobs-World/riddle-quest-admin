import {getFirestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {HttpsError} from "firebase-functions/v2/https";
import type Stripe from "stripe";
import {onCallWithSentry, onRequestWithSentry} from "../../../../firebase-functions/src/shared/sentryHandlers";
import {resolveYahooStripeProduct} from "./yahooStripeCatalog";
import {grantVerifiedYahooStripePurchase, refundVerifiedYahooStripePurchase} from "./yahooStripeLedger";

/** Provides stripe secret key behavior. */
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
/** Provides stripe webhook secret behavior. */
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
/** Provides game url behavior. */
const gameUrl = "https://yahoo.roobsworld.com/";
/** Provides region behavior. */
const region = "us-central1";
/** Stripe's eligible general digital-goods code for electronically supplied virtual items. */
const yahooCoinTaxCode = "txcd_10000000";

/** Stripe's CommonJS export, or the ES-module interop wrapper around it. */
type StripeModule = typeof Stripe | {
  /** Interop default export. */
  default: typeof Stripe;
  /** ES module marker. */
  __esModule: true;
};

/** Provides stripe client behavior. */
// Stripe is loaded on first use so every other function's cold start skips its module graph.
const stripeClient = () => {
  /** CommonJS Stripe export, unwrapped the same way esModuleInterop would. */
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Deferred load keeps player cold starts small.
  const loaded = require("stripe") as StripeModule;
  /** Stripe constructor. */
  const StripeClient = "__esModule" in loaded ? loaded.default : loaded;
  return new StripeClient(stripeSecretKey.value());
};

/** Provides require yahoo uid behavior. */
const requireYahooUid = (
  auth:
    | {
        /** Stores uid. */
        uid: string;
        /** Stores token. */
        token: Record<string, unknown>;
      }
    | undefined,
): string => {
  if (!auth || auth.token.provider !== "yahoo" || !auth.uid.startsWith("yahoo:")) {
    throw new HttpsError("unauthenticated", "Yahoo sign-in is required to purchase.");
  }
  return auth.uid;
};

/** Provides require string behavior. */
const requireString = (value: unknown, name: string, max = 512): string => {
  if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > max) {
    throw new HttpsError("invalid-argument", `Invalid ${name}.`);
  }
  return value;
};

/** Provides payment intent id behavior. */
const paymentIntentId = (session: Stripe.Checkout.Session): string => {
  /** Provides value behavior. */
  const value = session.payment_intent;
  return typeof value === "string" ? value : (value?.id ?? "");
};

/** Provides grant paid session behavior. */
const grantPaidSession = async (session: Stripe.Checkout.Session) => {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new Error("yahoo-stripe-checkout-not-paid");
  }
  /** Provides uid behavior. */
  const uid = requireString(session.client_reference_id, "checkout account");
  /** Provides metadata uid behavior. */
  const metadataUid = requireString(session.metadata?.uid, "checkout metadata account");
  /** Provides product id behavior. */
  const productId = requireString(session.metadata?.productId, "checkout product");
  if (uid !== metadataUid) throw new Error("yahoo-stripe-checkout-account-mismatch");
  return grantVerifiedYahooStripePurchase(getFirestore(), {
    uid,
    checkoutSessionId: session.id,
    paymentIntentId: requireString(paymentIntentId(session), "payment intent"),
    productId,
    purchasedAtMs: session.created * 1_000,
  });
};

/** Creates a Stripe-hosted checkout for a server-catalogued Yahoo coin pack. */
export const createYahooStripeCheckout = onCallWithSentry<
  {
    /** Provides product id behavior. */
    productId?: unknown;
    /** Provides checkout attempt id behavior. */
    checkoutAttemptId?: unknown;
  },
  {
    /** Stores checkout url. */
    checkoutUrl: string;
  }
>("createYahooStripeCheckout", {region, timeoutSeconds: 30, secrets: [stripeSecretKey]}, async (request) => {
  /** Provides uid behavior. */
  const uid = requireYahooUid(request.auth);
  /** Provides product id behavior. */
  const productId = requireString(request.data?.productId, "product ID");
  /** Provides checkout attempt id behavior. */
  const checkoutAttemptId = requireString(request.data?.checkoutAttemptId, "checkout attempt ID", 128);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(checkoutAttemptId)) {
    throw new HttpsError("invalid-argument", "Invalid checkout attempt ID.");
  }
  /** Provides product behavior. */
  const product = resolveYahooStripeProduct(productId);
  /** Provides session behavior. */
  const session = await stripeClient().checkout.sessions.create(
    {
      mode: "payment",
      managed_payments: {enabled: true},
      client_reference_id: uid,
      customer_email: typeof request.auth?.token.email === "string" ? request.auth.token.email : undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.unitAmount,
            product_data: {
            name: product.name,
            description: product.description,
            tax_code: yahooCoinTaxCode,
            metadata: {productId: product.productId, coins: String(product.coins)},
            },
          },
        },
      ],
      metadata: {uid, productId: product.productId},
      payment_intent_data: {metadata: {uid, productId: product.productId}},
      success_url: `${gameUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${gameUrl}?checkout=cancelled`,
    },
    {idempotencyKey: `yahoo:${uid}:${checkoutAttemptId}`},
  );
  if (!session.url) throw new HttpsError("internal", "Stripe did not return a checkout URL.");
  return {checkoutUrl: session.url};
});

/** Confirms a returned Checkout Session and applies its grant idempotently. */
export const confirmYahooStripeCheckout = onCallWithSentry<
  {
    /** Provides session id behavior. */
    sessionId?: unknown;
  },
  {
    /** Stores coins. */
    coins: number;
  }
>("confirmYahooStripeCheckout", {region, timeoutSeconds: 30, secrets: [stripeSecretKey]}, async (request) => {
  /** Provides uid behavior. */
  const uid = requireYahooUid(request.auth);
  /** Provides session id behavior. */
  const sessionId = requireString(request.data?.sessionId, "checkout session ID");
  /** Provides session behavior. */
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== uid) throw new HttpsError("permission-denied", "Checkout account mismatch.");
  /** Provides result behavior. */
  const result = await grantPaidSession(session);
  return {coins: result.coins};
});

/** Verifies Stripe signatures before applying purchases and full refunds. */
export const yahooStripeWebhook = onRequestWithSentry(
  "yahooStripeWebhook",
  {region, timeoutSeconds: 30, secrets: [stripeSecretKey, stripeWebhookSecret]},
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed");
      return;
    }
    /** Provides signature behavior. */
    const signature = request.get("stripe-signature");
    if (!signature) {
      response.status(400).send("Missing Stripe signature");
      return;
    }
    /** Provides event behavior. */
    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
    } catch {
      response.status(400).send("Invalid Stripe signature");
      return;
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      /** Provides session behavior. */
      const session = event.data.object;
      if (session.payment_status === "paid") await grantPaidSession(session);
    } else if (event.type === "charge.refunded") {
      /** Provides charge behavior. */
      const charge = event.data.object;
      if (charge.refunded) {
        /** Provides intent behavior. */
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intent)
          await refundVerifiedYahooStripePurchase(getFirestore(), {
            paymentIntentId: intent,
            refundedAtMs: event.created * 1_000,
          });
      }
    }
    response.status(200).json({received: true});
  },
);
