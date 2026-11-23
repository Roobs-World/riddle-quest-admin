import type {PlatformResult} from "../platform/types";
import type {FacebookInstantPayments, FacebookInstantPurchase} from "./fbinstant";

/** Defines the max purchases value. */
const MAX_PURCHASES = 100;
/** Provides bounded behavior. */
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).length <= max;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses facebook unconsumed purchases. */
export function parseFacebookUnconsumedPurchases(value: unknown): FacebookInstantPurchase[] {
  if (!Array.isArray(value) || value.length > MAX_PURCHASES) throw new Error("facebook-purchases-invalid");
  /** Provides purchases behavior. */
  const purchases = value.map((item) => {
    if (!isRecord(item)) throw new Error("facebook-purchase-invalid");
    /** Provides keys behavior. */
    const keys = Object.keys(item);
    /** Provides required behavior. */
    const required = [
      "isConsumed",
      "paymentActionType",
      "paymentID",
      "productID",
      "purchasePlatform",
      "purchasePrice",
      "purchaseTime",
      "purchaseToken",
      "signedRequest",
    ];
    /** Meta v8 returns Unix seconds as a number; legacy responses may use decimal strings. */
    const purchaseTime = typeof item.purchaseTime === "number"
      ? item.purchaseTime
      : typeof item.purchaseTime === "string" && /^\d{1,16}$/u.test(item.purchaseTime)
        ? Number(item.purchaseTime)
        : Number.NaN;
    if (
      !required.every((key) => keys.includes(key)) ||
      keys.some((key) => ![...required, "developerPayload"].includes(key)) ||
      item.isConsumed !== false ||
      item.paymentActionType !== "charge" ||
      !bounded(item.paymentID, 1_024) ||
      !bounded(item.productID, 256) ||
      !bounded(item.purchasePlatform, 32) ||
      !Number.isSafeInteger(purchaseTime) ||
      purchaseTime <= 0 ||
      !bounded(item.purchaseToken, 8_192) ||
      !bounded(item.signedRequest, 8_192) ||
      (item.developerPayload != null && !bounded(item.developerPayload, 1_024))
    ) {
      throw new Error("facebook-purchase-invalid");
    }
    return {
      isConsumed: false,
      paymentActionType: item.paymentActionType,
      paymentID: item.paymentID,
      productID: item.productID,
      purchasePlatform: item.purchasePlatform,
      purchasePrice: item.purchasePrice,
      purchaseTime,
      purchaseToken: item.purchaseToken,
      signedRequest: item.signedRequest,
      ...(typeof item.developerPayload === "string" ? {developerPayload: item.developerPayload} : {}),
    };
  });
  for (const key of ["paymentID", "purchaseToken"] as const) {
    if (new Set(purchases.map((purchase) => purchase[key])).size !== purchases.length) {
      throw new Error("facebook-purchases-duplicate");
    }
  }
  return purchases;
}

/** Describes facebook signed purchase grant. */
export type FacebookPurchaseGrant = {
  granted: true;
  providerReceiptId: string;
  consume: boolean;
  newCoins?: number;
  coinsAwarded?: number;
  removeInterstitialAds?: boolean;
};

export type FacebookSignedPurchaseGrant = (input: {
  /** Stores signed request. */ /** Stores signed request. */
  /** Stores signed request. */
  signedRequest: string;
}) => Promise<FacebookPurchaseGrant>;

/** Recovers unconsumed SDK purchases while preserving authoritative grant-before-consume ordering. */
export class FacebookPurchaseRecovery {
  /** Stores payments. */
  private readonly payments: FacebookInstantPayments;
  /** Stores grant. */
  private readonly grant: FacebookSignedPurchaseGrant;
  /** Stores active recovery. */
  private activeRecovery?: Promise<PlatformResult<void>>;

  /** Creates a facebook purchase recovery instance. */
  constructor(payments: FacebookInstantPayments, grant: FacebookSignedPurchaseGrant) {
    this.payments = payments;
    this.grant = grant;
  }

  /** Provides recover behavior. */
  async recover(): Promise<PlatformResult<void>> {
    if (this.activeRecovery) return this.activeRecovery;
    /** Provides recovery behavior. */
    const recovery = this.runRecovery();
    this.activeRecovery = recovery;
    try {
      return await recovery;
    } finally {
      if (this.activeRecovery === recovery) this.activeRecovery = undefined;
    }
  }

  /** Provides run recovery behavior. */
  private async runRecovery(): Promise<PlatformResult<void>> {
    try {
      /** Provides purchases behavior. */
      const purchases = parseFacebookUnconsumedPurchases(await this.payments.getPurchasesAsync());
      for (const purchase of purchases) {
        /** Provides result behavior. */
        const result = await this.grant({signedRequest: purchase.signedRequest});
        if (
          result.granted !== true ||
          !bounded(result.providerReceiptId, 1_024) ||
          typeof result.consume !== "boolean"
        ) {
          return {status: "terminal-failure", message: "facebook-purchase-grant-invalid"};
        }
        if (result.consume) await this.payments.consumePurchaseAsync(purchase.purchaseToken);
      }
      return {status: "success", value: undefined};
    } catch (error) {
      return {
        status: "retryable-failure",
        message: error instanceof Error ? error.message : "facebook-purchase-recovery-failed",
      };
    }
  }
}
