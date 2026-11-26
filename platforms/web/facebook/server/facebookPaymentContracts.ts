import {createHmac, timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {resolveFacebookProduct} from "./commerce/facebookCatalog.js";

/** Largest provider integer preserved without rounding its decimal representation. */
const MAX_INT64 = 9_223_372_036_854_775_807n;
/** Canonical nonnegative int64 decimal values from provider numbers or strings. */
const decimalInteger = z.union([
  z.string().regex(/^(?:0|[1-9][0-9]{0,18})$/u),
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(String),
]).refine(value => BigInt(value) <= MAX_INT64, "Integer exceeds int64.");
/** Provider identifiers normalized to positive decimal strings. */
const positiveIdentifier = decimalInteger.refine(value => value !== "0", "Identifier must be positive.");
/** Provider Unix seconds normalized to safe positive millisecond timestamps. */
const unixMilliseconds = decimalInteger.transform(value => Number(value) * 1_000)
  .refine(value => Number.isSafeInteger(value) && value > 0, "Invalid timestamp.");
/** Facebook product identifier accepted by the reviewed server catalog. */
const productId = z.string().min(1).max(256).refine(value => {
  try { resolveFacebookProduct(value); return true; } catch { return false; }
}, "Unsupported Facebook product.");
/** Canonical SHA-256 hexadecimal identifier used for persisted payment records. */
const hash = z.string().regex(/^[0-9a-f]{64}$/u);

/** Preserves JSON int64 tokens before JSON.parse can round provider identifiers. */
export function parseFacebookPaymentJson(source: string): unknown {
  if (Buffer.byteLength(source, "utf8") > 256 * 1_024) throw new Error("facebook-payment-body-too-large");
  /** JSON text rebuilt with integer tokens protected as decimal strings. */
  let output = "";
  /** Whether the scanner is inside a JSON string literal. */
  let inString = false;
  /** Whether the current string character follows an escape marker. */
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    /** Current JSON source character examined by the integer-preserving scanner. */
    const character = source[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
      output += character;
    } else if (character === "-" || /[0-9]/u.test(character)) {
      /** Complete numeric token retained before JSON.parse can round an integer. */
      const token = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(source.slice(index))?.[0];
      if (!token) throw new Error("facebook-payment-json-invalid");
      output += /^-?[0-9]+$/u.test(token) ? JSON.stringify(token) : token;
      index += token.length - 1;
    } else output += character;
  }
  return JSON.parse(output);
}

/** Claims required from an authenticated Facebook charge receipt. */
const signedPurchaseSchema = z.object({
  algorithm: z.literal("HMAC-SHA256"),
  issued_at: unixMilliseconds,
  app_id: positiveIdentifier,
  is_consumed: z.literal(false),
  payment_action_type: z.literal("charge"),
  payment_id: positiveIdentifier,
  product_id: productId,
  purchase_price: z.unknown(),
  purchase_token: positiveIdentifier,
  purchase_time: unixMilliseconds,
  developer_payload: z.string().max(1_024).nullish(),
});
/** Validated charge claims with decimal identifiers and millisecond timestamps. */
export type FacebookSignedPurchase = z.infer<typeof signedPurchaseSchema>;

/** Decodes canonical base64url segments without accepting alternate encodings. */
function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("facebook-payment-signature-invalid");
  /** Bytes whose re-encoding must match the supplied signature segment. */
  const decoded = Buffer.from(value, "base64url");
  if (!decoded.length || decoded.toString("base64url") !== value) throw new Error("facebook-payment-signature-invalid");
  return decoded;
}

/** Verifies the encoded payload with the app secret, entirely within Functions. */
export function verifyFacebookSignedPurchase(signedRequest: string, appSecret: string, appId: string,
  nowMs = Date.now()): FacebookSignedPurchase {
  if (!signedRequest || signedRequest.length > 16_384 || appSecret.length < 32 || !appId) {
    throw new Error("facebook-payment-signature-invalid");
  }
  /** Encoded signature and payload segments of the signed receipt. */
  const parts = signedRequest.split(".");
  if (parts.length !== 2) throw new Error("facebook-payment-signature-invalid");
  /** Provider signature decoded from the signed receipt. */
  const signature = decodeBase64Url(parts[0]);
  /** Server-computed HMAC for the encoded receipt payload. */
  const expected = createHmac("sha256", appSecret).update(parts[1]).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new Error("facebook-payment-signature-invalid");
  }
  /** Authenticated receipt claims checked against app identity and current time. */
  const purchase = signedPurchaseSchema.parse(parseFacebookPaymentJson(decodeBase64Url(parts[1]).toString("utf8")));
  if (purchase.app_id !== appId || purchase.purchase_time > nowMs + 60_000 ||
    purchase.issued_at > nowMs + 60_000 || purchase.issued_at < purchase.purchase_time) {
    throw new Error("facebook-payment-claims-invalid");
  }
  return purchase;
}

/** Supported version-two purchase and refund facts from one webhook change. */
const webhookChangeSchema = z.object({
  field: z.literal("in_app_purchase"),
  version: z.literal("V2"),
  payment_action_type: z.enum(["PURCHASE_SUCCESS", "REFUND_SUCCESS"]),
  user_id: positiveIdentifier,
  product_id: productId,
  purchase_token: positiveIdentifier,
  purchase_platform: z.enum(["FB", "GOOGLE"]),
  purchase_price_currency: z.string().regex(/^[A-Z]{3}$/u),
  purchase_price_amount: decimalInteger,
  env: z.enum(["PROD", "DEV", "DEV_EXTERNAL", "TEST"]),
  developer_payload: z.string().max(1_024).nullish(),
});
/** Bounded Facebook application webhook envelope. */
const webhookSchema = z.object({
  object: z.literal("application"),
  entry: z.array(z.object({
    id: positiveIdentifier,
    time: unixMilliseconds,
    changes: z.array(webhookChangeSchema).min(1).max(100),
  })).min(1).max(50),
});
/** Authenticated webhook change annotated with its provider event timestamp. */
export type FacebookPaymentEvent = z.infer<typeof webhookChangeSchema> & {
  /** Provider event time in milliseconds for purchase and refund ordering. */
  eventAtMs: number
};

/** Authenticates the exact raw body before reading an event or owner identifier. */
export function verifyFacebookPaymentWebhook(rawBody: Buffer, signature: string | undefined,
  appSecret: string, appId: string, nowMs = Date.now()): FacebookPaymentEvent[] {
  if (rawBody.length > 256 * 1_024 || !signature || !/^sha256=[0-9a-f]{64}$/u.test(signature) || appSecret.length < 32) {
    throw new Error("facebook-webhook-signature-invalid");
  }
  /** Supplied webhook HMAC decoded after its prefix and length checks. */
  const actual = Buffer.from(signature.slice(7), "hex");
  /** Server-computed HMAC over the exact received webhook body. */
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  if (!timingSafeEqual(actual, expected)) throw new Error("facebook-webhook-signature-invalid");
  /** Authenticated webhook envelope parsed after signature verification. */
  const body = webhookSchema.parse(parseFacebookPaymentJson(rawBody.toString("utf8")));
  return body.entry.flatMap(entry => {
    if (entry.id !== appId || entry.time > nowMs + 60_000) throw new Error("facebook-webhook-app-invalid");
    return entry.changes.map(change => {
      if (change.purchase_price_currency === "USD" &&
        BigInt(change.purchase_price_amount) !== BigInt(resolveFacebookProduct(change.product_id).basePriceUsdCents)) {
        throw new Error("facebook-webhook-price-invalid");
      }
      return {...change, eventAtMs: entry.time};
    });
  });
}

/** The handshake token is a separate app-scoped HMAC, never the app secret itself. */
export function facebookPaymentsVerifyToken(appSecret: string, appId: string): string {
  if (appSecret.length < 32 || !appId) throw new Error("facebook-payments-not-configured");
  return createHmac("sha256", appSecret).update(`riddle-quest-facebook-payments-webhook-v1\0${appId}`).digest("hex");
}

/** Persisted payment ownership, grant, and refund facts keyed by a token hash. */
export const facebookPaymentTokenSchema = z.object({
  version: z.literal(1),
  providerIdentityId: hash.nullable(),
  owner: z.discriminatedUnion("kind", [
    z.object({kind: z.literal("bound"), accountGeneration: z.number().int().min(1).max(1_000_000),
      generationStartedAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), uidHash: hash}).strict(),
    z.object({kind: z.literal("unbound")}).strict(),
    z.object({kind: z.literal("deleted")}).strict(),
  ]),
  productId,
  environment: z.enum(["PROD", "DEV", "DEV_EXTERNAL", "TEST"]),
  purchasePlatform: z.enum(["FB", "GOOGLE"]),
  priceCurrency: z.string().regex(/^[A-Z]{3}$/u),
  priceAmount: decimalInteger,
  purchaseSeen: z.boolean(),
  refundAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  purchaseReceiptId: hash.nullable(),
}).strict().refine(value => value.owner.kind === "bound" ? value.providerIdentityId !== null : value.providerIdentityId === null,
  "Only an active generation may retain an identity link.");
/** Validated persisted state used to authorize grants and reconcile refunds. */
export type FacebookPaymentToken = z.infer<typeof facebookPaymentTokenSchema>;

/** Bounded authoritative purchase result returned to the Facebook client. */
export const facebookPurchaseGrantResponseSchema = z.object({
  granted: z.literal(true), providerReceiptId: hash, consume: z.boolean(),
  newCoins: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  coinsAwarded: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  removeInterstitialAds: z.boolean(),
}).strict();
