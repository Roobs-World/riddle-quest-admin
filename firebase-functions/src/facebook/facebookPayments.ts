import {createHash, timingSafeEqual} from "node:crypto";
import {getFirestore, Timestamp, type Firestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";
import {z} from "zod";
import {resolveFacebookProduct} from "@riddle-quest/core/pricing/facebookCatalog";
import {browserCallableSecurityOptions} from "../shared/callableSecurity";
import {onCallWithSentry, onRequestWithSentry} from "../shared/sentryHandlers";
import {validateCallableRequest, validateCallableResponse} from "../validation/callableValidation";
import {captureException} from "../shared/sentry";
import {isFacebookFeatureEnabled} from "./facebookFeatureFlags";
import {facebookFirebaseUid, isFacebookFirebaseUid} from "./facebookSecurity";
import {
  facebookPaymentTokenSchema, facebookPaymentsVerifyToken, facebookPurchaseGrantResponseSchema,
  verifyFacebookPaymentWebhook, verifyFacebookSignedPurchase,
  type FacebookPaymentEvent, type FacebookPaymentToken,
} from "./facebookPaymentContracts";
import {
  facebookCommerceReceiptId, facebookCommerceTokenId, grantVerifiedFacebookPurchase,
  refundVerifiedFacebookPurchaseReceipt,
} from "./facebookCommerceLedger";

const facebookAppSecret = defineSecret("FACEBOOK_APP_SECRET");
const facebookUidSecret = defineSecret("FACEBOOK_UID_SECRET");
const paymentSecrets = [facebookAppSecret, facebookUidSecret];
const requestSchema = z.object({signedRequest: z.string().min(1).max(16_384)}).strict();
const identitySchema = z.object({
  provider: z.literal("facebook"), appId: z.string().min(1), providerPlayerId: z.string().min(1),
  uid: z.string().regex(/^facebook_[0-9a-f]{40}$/u),
  accountGeneration: z.number().int().min(1).max(1_000_000), status: z.literal("active"),
  createdAt: z.instanceof(Timestamp), lastDeletedAt: z.instanceof(Timestamp).optional(),
});

/** Requires an explicitly accepted callback subscription before exposing paid checkout. */
export function isFacebookPaymentsWebhookEnabled(value = process.env.FACEBOOK_PAYMENTS_WEBHOOK_ENABLED): boolean {
  return value === "1";
}

function acceptedEnvironments(value = process.env.FACEBOOK_PAYMENT_ENVIRONMENTS): ReadonlySet<string> {
  const values = value === undefined ? ["PROD"] : value.split(",").map(item => item.trim());
  if (!values.length || values.some(item => !["PROD", "DEV", "DEV_EXTERNAL", "TEST"].includes(item))) {
    throw new Error("facebook-payment-environments-invalid");
  }
  return new Set(values);
}

function identityId(appId: string, playerId: string): string {
  return createHash("sha256").update(`${appId}\0${playerId}`).digest("hex");
}

/** Older-generation receipts are rejected conservatively in the deletion second. */
function generationStartedAtMs(identity: z.infer<typeof identitySchema>): number {
  if (identity.accountGeneration === 1) return Math.floor(identity.createdAt.toMillis() / 1_000) * 1_000;
  if (!identity.lastDeletedAt) throw new Error("facebook-payment-generation-invalid");
  return Math.ceil(identity.lastDeletedAt.toMillis() / 1_000) * 1_000;
}

function captureOwner(provider: unknown, appId: string, playerId: string, uidSecret: string): FacebookPaymentToken["owner"] {
  if (provider === undefined) return {kind: "unbound"};
  const identity = identitySchema.safeParse(provider);
  if (!identity.success) {
    if (typeof provider === "object" && provider !== null && "status" in provider &&
      (provider.status === "deleting" || provider.status === "exhausted" || "uid" in provider && provider.uid === null)) {
      return {kind: "unbound"};
    }
    throw new Error("facebook-payment-identity-invalid");
  }
  if (identity.data.appId !== appId || identity.data.providerPlayerId !== playerId ||
    identity.data.uid !== facebookFirebaseUid(playerId, uidSecret, identity.data.accountGeneration)) {
    throw new Error("facebook-payment-identity-invalid");
  }
  return {kind: "bound", accountGeneration: identity.data.accountGeneration,
    generationStartedAtMs: generationStartedAtMs(identity.data),
    uidHash: createHash("sha256").update(identity.data.uid).digest("hex")};
}

/** Persists authenticated owner facts without granting on an unauthenticated browser's behalf. */
export async function recordFacebookPaymentEvent(db: Firestore, event: FacebookPaymentEvent,
  {appId, uidSecret}: {appId: string; uidSecret: string}): Promise<void> {
  if (!acceptedEnvironments().has(event.env)) return;
  const tokenId = facebookCommerceTokenId(event.purchase_token);
  const tokenRef = db.collection("facebookPaymentTokens").doc(tokenId);
  const providerIdentityId = identityId(appId, event.user_id);
  const providerRef = db.collection("providerIdentities").doc(providerIdentityId);
  const refund = await db.runTransaction(async transaction => {
    const [tokenSnapshot, providerSnapshot] = await Promise.all([transaction.get(tokenRef), transaction.get(providerRef)]);
    const previous = tokenSnapshot.exists ? facebookPaymentTokenSchema.parse(tokenSnapshot.data()) : undefined;
    if (previous && (previous.providerIdentityId !== null && previous.providerIdentityId !== providerIdentityId || previous.productId !== event.product_id ||
      previous.environment !== event.env || previous.purchasePlatform !== event.purchase_platform ||
      previous.priceCurrency !== event.purchase_price_currency || previous.priceAmount !== event.purchase_price_amount)) {
      throw new Error("facebook-payment-event-conflict");
    }
    const owner = previous?.owner ?? (event.payment_action_type === "PURCHASE_SUCCESS"
      ? captureOwner(providerSnapshot.data(), appId, event.user_id, uidSecret) : {kind: "unbound"});
    const token: FacebookPaymentToken = previous ?? {
      version: 1, providerIdentityId: owner.kind === "bound" ? providerIdentityId : null,
      owner,
      productId: event.product_id, environment: event.env, purchasePlatform: event.purchase_platform,
      priceCurrency: event.purchase_price_currency, priceAmount: event.purchase_price_amount,
      purchaseSeen: false, refundAtMs: null, purchaseReceiptId: null,
    };
    const next = facebookPaymentTokenSchema.parse({...token,
      purchaseSeen: token.purchaseSeen || event.payment_action_type === "PURCHASE_SUCCESS",
      refundAtMs: token.refundAtMs ?? (event.payment_action_type === "REFUND_SUCCESS" ? event.eventAtMs : null),
    });
    transaction.set(tokenRef, next);
    return next.refundAtMs !== null && next.purchaseReceiptId !== null
      ? {purchaseReceiptId: next.purchaseReceiptId, refundedAtMs: next.refundAtMs} : null;
  });
  if (refund) await refundVerifiedFacebookPurchaseReceipt(db, {...refund, productId: event.product_id,
    eventId: `token-refund:${tokenId}`});
}

/** Grants only when signed receipt and signed webhook independently agree on the current owner. */
export const grantFacebookPurchase = onCallWithSentry(
  "grantFacebookPurchase", {...browserCallableSecurityOptions, secrets: paymentSecrets},
  async (request: CallableRequest<unknown>) => {
    if (!request.auth || request.auth.token.provider !== "facebook" || !isFacebookFirebaseUid(request.auth.uid)) {
      throw new HttpsError("unauthenticated", "Facebook authentication is required.");
    }
    if (!isFacebookFeatureEnabled("commerce") || !isFacebookPaymentsWebhookEnabled()) {
      throw new HttpsError("unavailable", "Facebook payments are unavailable.");
    }
    const accountGeneration = z.number().int().min(1).max(1_000_000).safeParse(request.auth.token.accountGeneration);
    if (!accountGeneration.success) throw new HttpsError("unauthenticated", "A current Facebook session is required.");
    const {signedRequest} = validateCallableRequest(requestSchema, request.data, "grantFacebookPurchase");
    const appId = process.env.FACEBOOK_APP_ID ?? "";
    let purchase;
    try {purchase = verifyFacebookSignedPurchase(signedRequest, facebookAppSecret.value(), appId);}
    catch {throw new HttpsError("invalid-argument", "The Facebook purchase receipt is invalid.");}
    const db = getFirestore();
    const tokenRef = db.collection("facebookPaymentTokens").doc(facebookCommerceTokenId(purchase.purchase_token));
    const tokenSnapshot = await tokenRef.get();
    if (!tokenSnapshot.exists) throw new HttpsError("unavailable", "Waiting for Facebook purchase confirmation.");
    const token = facebookPaymentTokenSchema.parse(tokenSnapshot.data());
    if (!token.purchaseSeen && token.refundAtMs === null) {
      throw new HttpsError("unavailable", "Waiting for Facebook purchase confirmation.");
    }
    if (!acceptedEnvironments().has(token.environment) || token.owner.kind !== "bound" || token.providerIdentityId === null ||
      token.owner.accountGeneration !== accountGeneration.data || token.productId !== purchase.product_id ||
      token.refundAtMs !== null || purchase.purchase_time < token.owner.generationStartedAtMs) {
      throw new HttpsError("failed-precondition", "The Facebook purchase cannot be granted to this account.");
    }
    const providerRef = db.collection("providerIdentities").doc(token.providerIdentityId);
    const provider = identitySchema.parse((await providerRef.get()).data());
    if (provider.uid !== request.auth.uid || provider.accountGeneration !== accountGeneration.data ||
      provider.appId !== appId || identityId(appId, provider.providerPlayerId) !== providerRef.id ||
      provider.uid !== facebookFirebaseUid(provider.providerPlayerId, facebookUidSecret.value(), accountGeneration.data)) {
      throw new HttpsError("permission-denied", "The Facebook purchase belongs to another account.");
    }
    const result = await grantVerifiedFacebookPurchase(db, {uid: request.auth.uid,
      paymentId: purchase.payment_id, productId: purchase.product_id, purchaseToken: purchase.purchase_token,
      purchasedAtMs: purchase.purchase_time}, {tokenRef, providerRef, accountGeneration: accountGeneration.data});
    return validateCallableResponse(facebookPurchaseGrantResponseSchema, {
      granted: true, providerReceiptId: facebookCommerceReceiptId("purchase", purchase.payment_id),
      consume: resolveFacebookProduct(purchase.product_id).kind === "consumable",
      newCoins: result.coins, coinsAwarded: result.coinsAwarded, removeInterstitialAds: result.removeInterstitialAds,
    }, "grantFacebookPurchase");
  },
);

/** V2 callbacks remain active for refunds even when new purchases are switched off. */
export const facebookPaymentWebhook = onRequestWithSentry(
  "facebookPaymentWebhook", {minInstances: 0, invoker: "public", secrets: paymentSecrets},
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    const appId = process.env.FACEBOOK_APP_ID ?? "";
    if (request.method === "GET") {
      const mode = request.query["hub.mode"];
      const challenge = request.query["hub.challenge"];
      const token = request.query["hub.verify_token"];
      const expected = facebookPaymentsVerifyToken(facebookAppSecret.value(), appId);
      if (mode !== "subscribe" || typeof challenge !== "string" || !/^[A-Za-z0-9_-]{1,256}$/u.test(challenge) ||
        typeof token !== "string" || !/^[0-9a-f]{64}$/u.test(token) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
        response.status(403).send("verification-failed"); return;
      }
      response.type("text/plain").status(200).send(challenge); return;
    }
    if (request.method !== "POST") {response.status(405).send("method-not-allowed"); return;}
    if (!request.is("application/json")) {response.status(415).send("unsupported-media-type"); return;}
    let events;
    try {events = verifyFacebookPaymentWebhook(request.rawBody, request.get("X-Hub-Signature-256"),
      facebookAppSecret.value(), appId);}
    catch {response.status(401).send("invalid-webhook"); return;}
    try {
      for (const event of events) await recordFacebookPaymentEvent(getFirestore(), event,
        {appId, uidSecret: facebookUidSecret.value()});
      response.status(200).send("ok");
    } catch (error) {
      captureException(error, {firebaseFunction: "facebookPaymentWebhook"});
      response.status(503).send("retry-later");
    }
  },
);
