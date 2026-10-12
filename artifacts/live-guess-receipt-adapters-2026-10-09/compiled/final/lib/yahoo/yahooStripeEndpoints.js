"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yahooStripeWebhook = exports.confirmYahooStripeCheckout = exports.createYahooStripeCheckout = void 0;
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const sentryHandlers_1 = require("../shared/sentryHandlers");
const yahooStripeCatalog_1 = require("./yahooStripeCatalog");
const yahooStripeLedger_1 = require("./yahooStripeLedger");
/** Provides stripe secret key behavior. */
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
/** Provides stripe webhook secret behavior. */
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
/** Provides game url behavior. */
const gameUrl = "https://yahoo.roobsworld.com/";
/** Provides region behavior. */
const region = "us-central1";
/** Stripe's eligible general digital-goods code for electronically supplied virtual items. */
const yahooCoinTaxCode = "txcd_10000000";
/** Provides stripe client behavior. */
// Stripe is loaded on first use so every other function's cold start skips its module graph.
const stripeClient = () => {
    /** CommonJS Stripe export, unwrapped the same way esModuleInterop would. */
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Deferred load keeps player cold starts small.
    const loaded = require("stripe");
    /** Stripe constructor. */
    const StripeClient = "__esModule" in loaded ? loaded.default : loaded;
    return new StripeClient(stripeSecretKey.value());
};
/** Provides require yahoo uid behavior. */
const requireYahooUid = (auth) => {
    if (!auth || auth.token.provider !== "yahoo" || !auth.uid.startsWith("yahoo:")) {
        throw new https_1.HttpsError("unauthenticated", "Yahoo sign-in is required to purchase.");
    }
    return auth.uid;
};
/** Provides require string behavior. */
const requireString = (value, name, max = 512) => {
    if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > max) {
        throw new https_1.HttpsError("invalid-argument", `Invalid ${name}.`);
    }
    return value;
};
/** Provides payment intent id behavior. */
const paymentIntentId = (session) => {
    /** Provides value behavior. */
    const value = session.payment_intent;
    return typeof value === "string" ? value : (value?.id ?? "");
};
/** Provides grant paid session behavior. */
const grantPaidSession = async (session) => {
    if (session.mode !== "payment" || session.payment_status !== "paid") {
        throw new Error("yahoo-stripe-checkout-not-paid");
    }
    /** Provides uid behavior. */
    const uid = requireString(session.client_reference_id, "checkout account");
    /** Provides metadata uid behavior. */
    const metadataUid = requireString(session.metadata?.uid, "checkout metadata account");
    /** Provides product id behavior. */
    const productId = requireString(session.metadata?.productId, "checkout product");
    if (uid !== metadataUid)
        throw new Error("yahoo-stripe-checkout-account-mismatch");
    return (0, yahooStripeLedger_1.grantVerifiedYahooStripePurchase)((0, firestore_1.getFirestore)(), {
        uid,
        checkoutSessionId: session.id,
        paymentIntentId: requireString(paymentIntentId(session), "payment intent"),
        productId,
        purchasedAtMs: session.created * 1_000,
    });
};
/** Creates a Stripe-hosted checkout for a server-catalogued Yahoo coin pack. */
exports.createYahooStripeCheckout = (0, sentryHandlers_1.onCallWithSentry)("createYahooStripeCheckout", { region, timeoutSeconds: 30, secrets: [stripeSecretKey] }, async (request) => {
    /** Provides uid behavior. */
    const uid = requireYahooUid(request.auth);
    /** Provides product id behavior. */
    const productId = requireString(request.data?.productId, "product ID");
    /** Provides checkout attempt id behavior. */
    const checkoutAttemptId = requireString(request.data?.checkoutAttemptId, "checkout attempt ID", 128);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(checkoutAttemptId)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid checkout attempt ID.");
    }
    /** Provides product behavior. */
    const product = (0, yahooStripeCatalog_1.resolveYahooStripeProduct)(productId);
    /** Provides session behavior. */
    const session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        managed_payments: { enabled: true },
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
                        metadata: { productId: product.productId, coins: String(product.coins) },
                    },
                },
            },
        ],
        metadata: { uid, productId: product.productId },
        payment_intent_data: { metadata: { uid, productId: product.productId } },
        success_url: `${gameUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${gameUrl}?checkout=cancelled`,
    }, { idempotencyKey: `yahoo:${uid}:${checkoutAttemptId}` });
    if (!session.url)
        throw new https_1.HttpsError("internal", "Stripe did not return a checkout URL.");
    return { checkoutUrl: session.url };
});
/** Confirms a returned Checkout Session and applies its grant idempotently. */
exports.confirmYahooStripeCheckout = (0, sentryHandlers_1.onCallWithSentry)("confirmYahooStripeCheckout", { region, timeoutSeconds: 30, secrets: [stripeSecretKey] }, async (request) => {
    /** Provides uid behavior. */
    const uid = requireYahooUid(request.auth);
    /** Provides session id behavior. */
    const sessionId = requireString(request.data?.sessionId, "checkout session ID");
    /** Provides session behavior. */
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== uid)
        throw new https_1.HttpsError("permission-denied", "Checkout account mismatch.");
    /** Provides result behavior. */
    const result = await grantPaidSession(session);
    return { coins: result.coins };
});
/** Verifies Stripe signatures before applying purchases and full refunds. */
exports.yahooStripeWebhook = (0, sentryHandlers_1.onRequestWithSentry)("yahooStripeWebhook", { region, timeoutSeconds: 30, secrets: [stripeSecretKey, stripeWebhookSecret] }, async (request, response) => {
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
    let event;
    try {
        event = stripeClient().webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
    }
    catch {
        response.status(400).send("Invalid Stripe signature");
        return;
    }
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        /** Provides session behavior. */
        const session = event.data.object;
        if (session.payment_status === "paid")
            await grantPaidSession(session);
    }
    else if (event.type === "charge.refunded") {
        /** Provides charge behavior. */
        const charge = event.data.object;
        if (charge.refunded) {
            /** Provides intent behavior. */
            const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
            if (intent)
                await (0, yahooStripeLedger_1.refundVerifiedYahooStripePurchase)((0, firestore_1.getFirestore)(), {
                    paymentIntentId: intent,
                    refundedAtMs: event.created * 1_000,
                });
        }
    }
    response.status(200).json({ received: true });
});
//# sourceMappingURL=yahooStripeEndpoints.js.map