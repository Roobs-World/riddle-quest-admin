import {REDDIT_GOLD_PRODUCTS} from "@qwordly/core/pricing/redditCatalog";

type HookKind = "fulfill" | "refund";
export type VerifiedRedditPaymentHook = {
  userId: string; postId: string; orderId: string; productId: string;
  environment: "sandbox" | "production"; occurredAtMs: number;
};
export type RecoverableRedditOrder = Omit<VerifiedRedditPaymentHook, "userId" | "postId"> & {recoveryKey: string};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Strictly projects the documented Devvit payment hook into the Firebase trust payload. */
export function parseRedditPaymentHook(value: unknown, kind: HookKind): VerifiedRedditPaymentHook {
  if (!record(value) || typeof value.id !== "string" || !/^[A-Za-z0-9._:-]{1,256}$/.test(value.id) ||
    typeof value.userId !== "string" || !/^t2_[A-Za-z0-9]{1,32}$/.test(value.userId) ||
    typeof value.postId !== "string" || !/^t3_[A-Za-z0-9]{1,32}$/.test(value.postId) ||
    !Array.isArray(value.products) || value.products.length !== 1 || !record(value.products[0])) {
    throw new Error("invalid-reddit-payment-hook");
  }
  const status = value.status;
  if ((kind === "fulfill" && status !== "PAID" && status !== 3) ||
    (kind === "refund" && status !== "REVERTED" && status !== 6)) throw new Error("invalid-reddit-payment-status");
  const environment = value.environment === "sandbox" || value.environment === "SANDBOX" || value.environment === 1
    ? "sandbox" : value.environment === "production" || value.environment === "PRODUCTION" || value.environment === 2
      ? "production" : undefined;
  if (!environment) throw new Error("invalid-reddit-payment-environment");
  const product = value.products[0];
  const configured = REDDIT_GOLD_PRODUCTS.find(({productId}) => productId === product.sku);
  const price = record(product.price) ? product.price.amount : product.price;
  const accounting = product.accountingType;
  if (!configured || price !== configured.goldCost ||
    (accounting !== "CONSUMABLE" && accounting !== "ACCOUNTING_TYPE_CONSUMABLE" && accounting !== 3)) {
    throw new Error("invalid-reddit-payment-product");
  }
  const timestamp = kind === "fulfill" ? value.createdAt : value.updatedAt;
  const occurredAtMs = typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
  if (!Number.isSafeInteger(occurredAtMs) || occurredAtMs <= 0) throw new Error("invalid-reddit-payment-time");
  return {userId: value.userId, postId: value.postId, orderId: value.id,
    productId: configured.productId, environment, occurredAtMs};
}

/** Projects a current-user order query result for replay through the idempotent Firebase ledger. */
export function parseRecoverableRedditOrder(value: unknown): RecoverableRedditOrder {
  if (!record(value) || (value.status !== "PAID" && value.status !== 3 &&
    value.status !== "DELIVERED" && value.status !== 4) || !record(value.metadata) ||
    typeof value.metadata["riddle-account"] !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.metadata["riddle-account"] as string)) {
    throw new Error("invalid-reddit-recoverable-order");
  }
  const createdAt = value.createdAt instanceof Date ? value.createdAt.toISOString() : value.createdAt;
  const parsed = parseRedditPaymentHook({...value, status: "PAID", createdAt,
    userId: "t2_recovery", postId: "t3_recovery"}, "fulfill");
  return {orderId: parsed.orderId, productId: parsed.productId, environment: parsed.environment,
    occurredAtMs: parsed.occurredAtMs, recoveryKey: value.metadata["riddle-account"] as string};
}
