import {createHmac} from "node:crypto";
import {
  facebookPaymentTokenSchema,
  facebookPaymentsVerifyToken,
  facebookPurchaseGrantResponseSchema,
  parseFacebookPaymentJson,
  verifyFacebookPaymentWebhook,
  verifyFacebookSignedPurchase,
} from "../facebookPaymentContracts";

/** Public test key, unrelated to any deployed Facebook application secret. */
const appSecret = "0123456789abcdef0123456789abcdef";
/** Synthetic application identity authenticated by the test signatures. */
const appId = "123456789";
/** Trusted verifier clock after the fixture purchase and issue times. */
const nowMs = 1_700_000_100_000;
/** Reviewed consumable used to exercise real server catalog validation. */
const coinProduct = "com.roobsworld.riddlequest.coinpack1";

/** Builds raw receipt claims before the real signature and schema boundaries. */
const receiptClaims = (overrides: Record<string, unknown> = {}) => ({
  algorithm: "HMAC-SHA256",
  issued_at: 1_700_000_050,
  app_id: 123456789,
  is_consumed: false,
  payment_action_type: "charge",
  payment_id: "9223372036854775807",
  product_id: coinProduct,
  purchase_price: {amount: "0.99", currency: "USD"},
  purchase_token: "9223372036854775806",
  purchase_time: 1_700_000_000,
  developer_payload: null,
  ...overrides,
});

/** Signs the encoded payload, matching the documented receipt wire format. */
const signEncodedReceipt = (encodedPayload: string): string =>
  `${createHmac("sha256", appSecret).update(encodedPayload).digest("base64url")}.${encodedPayload}`;

/** Uses real HMAC bytes for both valid and deliberately malformed JSON fixtures. */
const signReceipt = (source = JSON.stringify(receiptClaims())): string =>
  signEncodedReceipt(Buffer.from(source, "utf8").toString("base64url"));

/** Builds a V2 provider change before authenticating its enclosing bytes. */
const webhookChange = (overrides: Record<string, unknown> = {}) => ({
  field: "in_app_purchase",
  version: "V2",
  payment_action_type: "PURCHASE_SUCCESS",
  user_id: "987654321",
  product_id: coinProduct,
  purchase_token: "9223372036854775806",
  purchase_platform: "FB",
  purchase_price_currency: "USD",
  purchase_price_amount: 99,
  env: "PROD",
  developer_payload: null,
  ...overrides,
});

/** Supplies the authenticated application and event time around provider changes. */
const webhookEnvelope = (entryOverrides: Record<string, unknown> = {}) => ({
  object: "application",
  entry: [{id: 123456789, time: 1_700_000_060, changes: [webhookChange()], ...entryOverrides}],
});

/** Authenticates the exact supplied bytes rather than a reserialized object. */
const signWebhook = (source = JSON.stringify(webhookEnvelope())) => {
  /** Exact request body delivered to the webhook verifier. */
  const rawBody = Buffer.from(source, "utf8");
  return {rawBody, signature: `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`};
};

/** Valid persisted ownership state used to test the public storage schema. */
const boundToken = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  providerIdentityId: "a".repeat(64),
  owner: {kind: "bound", accountGeneration: 1, generationStartedAtMs: 1_700_000_000_000, uidHash: "b".repeat(64)},
  productId: coinProduct,
  environment: "PROD",
  purchasePlatform: "FB",
  priceCurrency: "USD",
  priceAmount: 99,
  purchaseSeen: true,
  refundAtMs: null,
  purchaseReceiptId: null,
  ...overrides,
});

describe("Facebook payment JSON", () => {
  it("preserves int64 identifiers without rewriting quoted digits, decimals or exponents", () => {
    expect(parseFacebookPaymentJson(String.raw`{"id":9223372036854775807,"decimal":0.99,"exponent":1e2,"negative":-7,"quoted":"number 123 and \"456\"","nested":[1,true,null]}`)).toEqual({
      id: "9223372036854775807",
      decimal: 0.99,
      exponent: 100,
      negative: "-7",
      quoted: 'number 123 and "456"',
      nested: ["1", true, null],
    });
  });

  it.each(['{"id":-}', '{"id":01}', '{"id":1,}', '{"id":1e}'])("rejects malformed JSON %s", (source) => {
    expect(() => parseFacebookPaymentJson(source)).toThrow();
  });

  it("enforces the body bound in UTF-8 bytes", () => {
    expect(() => parseFacebookPaymentJson(JSON.stringify({text: "é".repeat(131_072)}))).toThrow("facebook-payment-body-too-large");
  });
});

describe("Facebook signed purchase receipts", () => {
  it("authenticates the app receipt and normalizes identifiers and Unix seconds", () => {
    expect(verifyFacebookSignedPurchase(signReceipt(), appSecret, appId, nowMs)).toEqual({
      algorithm: "HMAC-SHA256",
      issued_at: 1_700_000_050_000,
      app_id: "123456789",
      is_consumed: false,
      payment_action_type: "charge",
      payment_id: "9223372036854775807",
      product_id: coinProduct,
      purchase_price: {amount: "0.99", currency: "USD"},
      purchase_token: "9223372036854775806",
      purchase_time: 1_700_000_000_000,
      developer_payload: null,
    });
  });

  it("retains unquoted int64 receipt identifiers exactly", () => {
    /** Raw JSON numbers exceed JavaScript's safe integer range without becoming numbers here. */
    const source = JSON.stringify(receiptClaims())
      .replace('"9223372036854775807"', "9223372036854775807")
      .replace('"9223372036854775806"', "9223372036854775806");
    expect(verifyFacebookSignedPurchase(signReceipt(source), appSecret, appId, nowMs)).toMatchObject({
      payment_id: "9223372036854775807",
      purchase_token: "9223372036854775806",
    });
  });

  it.each([undefined, null, "legacy metadata"])("accepts the deprecated developer payload %p", (developer_payload) => {
    expect(verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({developer_payload}))), appSecret, appId, nowMs).developer_payload)
      .toBe(developer_payload);
  });

  it("rejects tampered payload bytes, another secret and another app", () => {
    expect(() => verifyFacebookSignedPurchase(`${signReceipt()}a`, appSecret, appId, nowMs)).toThrow("facebook-payment-signature-invalid");
    expect(() => verifyFacebookSignedPurchase(signReceipt(), "f".repeat(32), appId, nowMs)).toThrow("facebook-payment-signature-invalid");
    expect(() => verifyFacebookSignedPurchase(signReceipt(), appSecret, "987654321", nowMs)).toThrow("facebook-payment-claims-invalid");
  });

  it("rejects noncanonical base64url even when the decoded signature bytes are unchanged", () => {
    /** Canonical wire segments produced by a genuine HMAC. */
    const [signature, encodedPayload] = signReceipt().split(".");
    /** Flips an unused padding bit in the final base64 sextet. */
    const noncanonical = signature.slice(0, -1) + String.fromCharCode(signature.charCodeAt(signature.length - 1) + 1);
    expect(() => verifyFacebookSignedPurchase(`${noncanonical}.${encodedPayload}`, appSecret, appId, nowMs)).toThrow("facebook-payment-signature-invalid");
    expect(() => verifyFacebookSignedPurchase(signEncodedReceipt(`${encodedPayload}=`), appSecret, appId, nowMs)).toThrow("facebook-payment-signature-invalid");
  });

  it.each(["", "a.b.c", "!.e30"])("rejects malformed receipt framing %s", (signedRequest) => {
    expect(() => verifyFacebookSignedPurchase(signedRequest, appSecret, appId, nowMs)).toThrow("facebook-payment-signature-invalid");
  });

  it("rejects an authentic but oversized receipt", () => {
    expect(() => verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({padding: "x".repeat(13_000)}))), appSecret, appId, nowMs))
      .toThrow("facebook-payment-signature-invalid");
  });

  it.each([
    {label: "consumed", changes: {is_consumed: true}},
    {label: "not a charge", changes: {payment_action_type: "refund"}},
    {label: "another algorithm", changes: {algorithm: "HMAC-SHA1"}},
    {label: "zero app", changes: {app_id: "0"}},
    {label: "nondecimal payment", changes: {payment_id: "payment-1"}},
    {label: "zero payment", changes: {payment_id: 0}},
    {label: "int64 overflow", changes: {payment_id: "9223372036854775808"}},
    {label: "zero token", changes: {purchase_token: "0"}},
    {label: "unknown product", changes: {product_id: "com.roobsworld.riddlequest.unknown"}},
    {label: "fractional timestamp", changes: {purchase_time: 1.5}},
    {label: "unsafe timestamp", changes: {purchase_time: "9223372036854775807"}},
    {label: "oversized legacy payload", changes: {developer_payload: "x".repeat(1_025)}},
  ])("rejects an authenticated $label receipt", ({changes}) => {
    expect(() => verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims(changes))), appSecret, appId, nowMs)).toThrow();
  });

  it("allows bounded provider clock skew but rejects later or reversed receipt times", () => {
    expect(verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({issued_at: 1_700_000_160, purchase_time: 1_700_000_160}))), appSecret, appId, nowMs))
      .toMatchObject({issued_at: 1_700_000_160_000, purchase_time: 1_700_000_160_000});
    expect(() => verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({issued_at: 1_700_000_161}))), appSecret, appId, nowMs))
      .toThrow("facebook-payment-claims-invalid");
    expect(() => verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({purchase_time: 1_700_000_161, issued_at: 1_700_000_161}))), appSecret, appId, nowMs))
      .toThrow("facebook-payment-claims-invalid");
    expect(() => verifyFacebookSignedPurchase(signReceipt(JSON.stringify(receiptClaims({issued_at: 1_699_999_999}))), appSecret, appId, nowMs))
      .toThrow("facebook-payment-claims-invalid");
  });
});

describe("Facebook V2 payment webhooks", () => {
  it("authenticates the exact raw body and exposes a normalized purchase event", () => {
    /** Genuine signature for the provider envelope. */
    const {rawBody, signature} = signWebhook();
    expect(verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toEqual([{
      field: "in_app_purchase",
      version: "V2",
      payment_action_type: "PURCHASE_SUCCESS",
      user_id: "987654321",
      product_id: coinProduct,
      purchase_token: "9223372036854775806",
      purchase_platform: "FB",
      purchase_price_currency: "USD",
      purchase_price_amount: "99",
      env: "PROD",
      developer_payload: null,
      eventAtMs: 1_700_000_060_000,
    }]);
  });

  it("requires a new signature when JSON whitespace changes", () => {
    /** Same logical envelope delivered with distinct raw bytes. */
    const source = JSON.stringify(webhookEnvelope(), null, 2);
    /** Compact body signature must not authenticate its reformatted representation. */
    const compact = signWebhook();
    expect(() => verifyFacebookPaymentWebhook(Buffer.from(source), compact.signature, appSecret, appId, nowMs)).toThrow("facebook-webhook-signature-invalid");
    /** Signature over the actual pretty-printed body is valid. */
    const pretty = signWebhook(source);
    expect(verifyFacebookPaymentWebhook(pretty.rawBody, pretty.signature, appSecret, appId, nowMs)).toMatchObject([{eventAtMs: 1_700_000_060_000}]);
  });

  it("rejects another secret, a tampered body and malformed signature headers", () => {
    /** Valid signature and bytes reused only to exercise authentication failures. */
    const {rawBody, signature} = signWebhook();
    expect(() => verifyFacebookPaymentWebhook(rawBody, signature, "f".repeat(32), appId, nowMs)).toThrow("facebook-webhook-signature-invalid");
    expect(() => verifyFacebookPaymentWebhook(Buffer.concat([rawBody, Buffer.from(" ")]), signature, appSecret, appId, nowMs)).toThrow("facebook-webhook-signature-invalid");
    for (const header of [undefined, "", signature.toUpperCase(), signature.slice(7)]) {
      expect(() => verifyFacebookPaymentWebhook(rawBody, header, appSecret, appId, nowMs)).toThrow("facebook-webhook-signature-invalid");
    }
  });

  it.each(["PURCHASE_SUCCESS", "REFUND_SUCCESS"])("accepts the authenticated V2 action %s", (payment_action_type) => {
    /** Signed action uses the same exact app and product boundary. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange({payment_action_type})]})));
    expect(verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toMatchObject([{payment_action_type}]);
  });

  it.each(["PROD", "DEV", "DEV_EXTERNAL", "TEST"])("retains recognized environment %s for the handler's separate rollout filter", (env) => {
    /** Cryptographic verification retains the environment for policy enforcement. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange({env})]})));
    expect(verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toMatchObject([{env}]);
  });

  it.each([
    {label: "another field", changes: {field: "payments"}},
    {label: "another version", changes: {version: "V1"}},
    {label: "another action", changes: {payment_action_type: "CHARGE"}},
    {label: "zero owner", changes: {user_id: "0"}},
    {label: "negative token", changes: {purchase_token: "-1"}},
    {label: "unknown product", changes: {product_id: "com.roobsworld.riddlequest.unknown"}},
    {label: "another platform", changes: {purchase_platform: "WEB"}},
    {label: "lowercase currency", changes: {purchase_price_currency: "usd"}},
    {label: "missing environment", changes: {env: undefined}},
    {label: "unknown environment", changes: {env: "STAGING"}},
    {label: "negative price", changes: {purchase_price_amount: "-1"}},
    {label: "int64 price overflow", changes: {purchase_price_amount: "9223372036854775808"}},
  ])("rejects an authenticated V2 change with $label", ({changes}) => {
    /** Valid authentication does not relax the provider event schema. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange(changes)]})));
    expect(() => verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toThrow();
  });

  it("accepts a signed localized currency amount without treating it as USD cents", () => {
    /** Authenticated local pricing remains distinct from the USD catalog comparison. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange({purchase_price_currency: "GBP", purchase_price_amount: 79})]})));
    expect(verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toMatchObject([{purchase_price_currency: "GBP", purchase_price_amount: "79"}]);
  });

  it.each([
    {label: "wrong field", changes: {field: "payments"}},
    {label: "legacy version", changes: {version: "V1"}},
    {label: "unsupported action", changes: {payment_action_type: "PURCHASE_PENDING"}},
    {label: "missing owner", changes: {user_id: undefined}},
    {label: "zero owner", changes: {user_id: "0"}},
    {label: "nondecimal token", changes: {purchase_token: "token-1"}},
    {label: "unsupported product", changes: {product_id: "com.roobsworld.riddlequest.unknown"}},
    {label: "lowercase currency", changes: {purchase_price_currency: "usd"}},
    {label: "fractional minor units", changes: {purchase_price_amount: 0.99}},
    {label: "unknown environment", changes: {env: "STAGING"}},
    {label: "unknown host platform", changes: {purchase_platform: "OTHER"}},
  ])("rejects an authenticated $label webhook", ({changes}) => {
    /** Valid authentication cannot bypass the event's data contract. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange(changes)]})));
    expect(() => verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toThrow();
  });

  it("rejects an authenticated USD price that differs from the server product", () => {
    /** Provider-authenticated event still must match the reviewed USD price. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope({changes: [webhookChange({purchase_price_amount: 98})]})));
    expect(() => verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toThrow("facebook-webhook-price-invalid");
  });

  it.each([{id: "987654321"}, {time: 1_700_000_161}])("rejects a wrong app or future event time: %p", (entry) => {
    /** Correct signature does not authorize another app or an unbounded future event. */
    const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope(entry)));
    expect(() => verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toThrow("facebook-webhook-app-invalid");
  });

  it("rejects authentic but empty or oversized event batches", () => {
    for (const entry of [{changes: []}, {changes: Array.from({length: 101}, () => webhookChange())}]) {
      /** HMAC-valid batch must still satisfy the provider change bounds. */
      const {rawBody, signature} = signWebhook(JSON.stringify(webhookEnvelope(entry)));
      expect(() => verifyFacebookPaymentWebhook(rawBody, signature, appSecret, appId, nowMs)).toThrow();
    }
    /** Fifty-one valid entries exceed the bounded envelope. */
    const oversized = signWebhook(JSON.stringify({object: "application", entry: Array.from({length: 51}, () => ({id: appId, time: 1_700_000_060, changes: [webhookChange()]}))}));
    expect(() => verifyFacebookPaymentWebhook(oversized.rawBody, oversized.signature, appSecret, appId, nowMs)).toThrow();
  });
});

describe("Facebook payment storage and response contracts", () => {
  it("keeps the handshake token app-scoped with a fixed protocol vector", () => {
    expect(facebookPaymentsVerifyToken(appSecret, appId)).toBe("636355c13657bcb61ecbce9483dc0a6b50e089f90f8eedd74f3c227bda7a603b");
    expect(facebookPaymentsVerifyToken(appSecret, "987654321")).not.toBe(facebookPaymentsVerifyToken(appSecret, appId));
    expect(() => facebookPaymentsVerifyToken("short", appId)).toThrow("facebook-payments-not-configured");
    expect(() => facebookPaymentsVerifyToken(appSecret, "")).toThrow("facebook-payments-not-configured");
  });

  it("normalizes the persisted price while retaining a bound generation and opaque identity", () => {
    expect(facebookPaymentTokenSchema.parse(boundToken())).toEqual({
      version: 1,
      providerIdentityId: "a".repeat(64),
      owner: {kind: "bound", accountGeneration: 1, generationStartedAtMs: 1_700_000_000_000, uidHash: "b".repeat(64)},
      productId: coinProduct,
      environment: "PROD",
      purchasePlatform: "FB",
      priceCurrency: "USD",
      priceAmount: "99",
      purchaseSeen: true,
      refundAtMs: null,
      purchaseReceiptId: null,
    });
  });

  it.each(["unbound", "deleted"])("permits %s state only after erasing the provider identity link", (kind) => {
    expect(facebookPaymentTokenSchema.parse(boundToken({owner: {kind}, providerIdentityId: null}))).toMatchObject({owner: {kind}, providerIdentityId: null});
    expect(() => facebookPaymentTokenSchema.parse(boundToken({owner: {kind}}))).toThrow();
  });

  it.each([
    {providerIdentityId: null},
    {owner: {kind: "bound", accountGeneration: 0, generationStartedAtMs: 1_700_000_000_000, uidHash: "b".repeat(64)}},
    {owner: {kind: "deleted", uidHash: "b".repeat(64)}, providerIdentityId: null},
    {environment: "STAGING"},
    {priceCurrency: "usd"},
    {priceAmount: Number.MAX_SAFE_INTEGER + 1},
    {refundAtMs: -1},
    {purchaseReceiptId: "raw-payment-id"},
    {purchaseToken: "raw-provider-token"},
  ])("rejects malformed persisted ownership or unreviewed data %p", (changes) => {
    expect(() => facebookPaymentTokenSchema.parse(boundToken(changes))).toThrow();
  });

  it("accepts only the bounded authoritative grant projection", () => {
    expect(facebookPurchaseGrantResponseSchema.parse({granted: true, providerReceiptId: "c".repeat(64), consume: true,
      newCoins: 550, coinsAwarded: 250, removeInterstitialAds: false})).toEqual({
      granted: true, providerReceiptId: "c".repeat(64), consume: true,
      newCoins: 550, coinsAwarded: 250, removeInterstitialAds: false,
    });
    expect(facebookPurchaseGrantResponseSchema.parse({granted: true, providerReceiptId: "d".repeat(64), consume: false,
      newCoins: 300, coinsAwarded: 0, removeInterstitialAds: true})).toMatchObject({consume: false, coinsAwarded: 0, removeInterstitialAds: true});
    for (const changes of [{granted: false}, {providerReceiptId: "raw-id"}, {newCoins: -1}, {coinsAwarded: 0.5}, {purchaseToken: "must-not-leak"}]) {
      expect(() => facebookPurchaseGrantResponseSchema.parse({granted: true, providerReceiptId: "c".repeat(64), consume: true,
        newCoins: 550, coinsAwarded: 250, removeInterstitialAds: false, ...changes})).toThrow();
    }
  });
});
