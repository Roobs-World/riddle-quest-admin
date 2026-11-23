import type {PlatformResult} from "../../../../src/platform/contracts/capabilities";
import type {FacebookInstantPayments, FacebookInstantPurchase} from "./fbinstant";

/** Defines the max purchases value. */
const MAX_PURCHASES = 100;
/** Provides bounded behavior. */
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && new TextEncoder().encode(value).length <= max;
/** Indicates whether is record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Normalized SDK charge that can cross the authoritative fulfillment boundary. */
export type FacebookRecoverableCharge = FacebookInstantPurchase & {
  /** Consumed purchases never need a new grant or completion attempt. */
  isConsumed: false;
  /** Refund history cannot be submitted as a charge. */
  paymentActionType: "charge";
  /** Canonical integer Unix seconds from the SDK response. */
  purchaseTime: number;
};

/** Parses facebook unconsumed purchases. */
export function parseFacebookUnconsumedPurchases(value: unknown): FacebookRecoverableCharge[] {
  if (!Array.isArray(value) || value.length > MAX_PURCHASES) throw new Error("facebook-purchases-invalid");
  /** Refunds are never fulfillment inputs, including a charge repeated beside its refund. */
  const refundedPaymentIds = new Set<string>();
  /** Tokens link refund history to its original charge without authorizing any completion. */
  const refundedTokens = new Set<string>();
  /** Only charge entries cross the existing strict purchase boundary. */
  const charges: unknown[] = [];
  for (const item of value) {
    if (isRecord(item) && item.paymentActionType === "refund") {
      if (!bounded(item.paymentID, 1_024) || !bounded(item.purchaseToken, 8_192)) throw new Error("facebook-purchase-invalid");
      refundedPaymentIds.add(item.paymentID);
      refundedTokens.add(item.purchaseToken);
    } else charges.push(item);
  }
  /** Provides purchases behavior. */
  const purchases = charges.map<FacebookRecoverableCharge>((item) => {
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
  return purchases.filter(purchase => !refundedPaymentIds.has(purchase.paymentID) && !refundedTokens.has(purchase.purchaseToken));
}

/** Describes facebook signed purchase grant. */
export type FacebookPurchaseGrant = {
  /** Confirms a committed server-authoritative grant. */
  granted: true;
  /** Identifies the durable server ledger receipt. */
  providerReceiptId: string;
  /** Authorizes SDK consumption only for a server-classified consumable. */
  consume: boolean;
  /** Current balance after the grant or its idempotent replay. */
  newCoins?: number;
  /** Coins newly granted by this invocation. */
  coinsAwarded?: number;
  /** Current server-owned ad-free entitlement. */
  removeInterstitialAds?: boolean;
};

/** Verifies a signed SDK charge against the authenticated server ledger. */
export type FacebookSignedPurchaseGrant = (input: {
  /** Stores signed request. */ /** Stores signed request. */
  /** Stores signed request. */
  signedRequest: string;
}) => Promise<FacebookPurchaseGrant>;

/** Distinguishes confirmed grants from permanent owner rejection and malformed grant responses. */
export type FacebookPurchaseCompletion =
  | {
    /** A durable grant has completed its permitted SDK consumption. */
    status: "granted";
    /** Preserves the authoritative balance and receipt returned by the server. */
    grant: FacebookPurchaseGrant;
  }
  | {
    /** The server proved that this receipt cannot grant to the current owner session. */
    status: "rejected";
    /** Retains the existing server rejection for a newly attempted checkout. */
    message: string;
  }
  | {
    /** An invalid grant boundary must continue to block checkout and recovery. */
    status: "invalid-grant";
  };

/** Recovery needs only pending-history reads and post-grant consumption from the SDK. */
type RecoveryPayments = Pick<FacebookInstantPayments, "getPurchasesAsync" | "consumePurchaseAsync">;

/** Recovers unconsumed SDK purchases while preserving authoritative grant-before-consume ordering. */
export class FacebookPurchaseRecovery {
  /** Stores payments. */
  private readonly payments: RecoveryPayments;
  /** Stores grant. */
  private readonly grant: FacebookSignedPurchaseGrant;
  /** Stores active recovery. */
  private activeRecovery?: Promise<PlatformResult<void>>;
  /** Bounds permanent rejection knowledge to the lifetime of this authenticated owner session. */
  private readonly rejectedTokens = new Set<string>();

  /** Creates a facebook purchase recovery instance. */
  constructor(payments: RecoveryPayments, grant: FacebookSignedPurchaseGrant) {
    this.payments = payments;
    this.grant = grant;
  }

  /** Checks only session-memory rejections established by the authoritative grant RPC. */
  isQuarantined(purchase: FacebookRecoverableCharge): boolean {
    return this.rejectedTokens.has(purchase.purchaseToken);
  }

  /** Shares grant validation and completion ordering between recovery and explicit checkout. */
  async complete(purchase: FacebookRecoverableCharge): Promise<FacebookPurchaseCompletion> {
    if (this.isQuarantined(purchase)) return {status: "rejected", message: "facebook-purchase-grant-invalid"};
    /** Only this call's permanent RPC rejection can quarantine the receipt. */
    let result: FacebookPurchaseGrant;
    try {
      result = await this.grant({signedRequest: purchase.signedRequest});
    } catch (error) {
      if (!isRecord(error) || error.code !== "functions/failed-precondition") throw error;
      this.rememberRejectedToken(purchase.purchaseToken);
      return {status: "rejected", message: error instanceof Error ? error.message : "facebook-purchase-grant-invalid"};
    }
    if (!isRecord(result) || result.granted !== true || !bounded(result.providerReceiptId, 1_024) ||
      typeof result.consume !== "boolean") return {status: "invalid-grant"};
    if (result.consume) await this.payments.consumePurchaseAsync(purchase.purchaseToken);
    return {status: "granted", grant: result};
  }

  /** Eviction permits another safe server check; it never authorizes a grant or consumption. */
  private rememberRejectedToken(token: string): void {
    if (this.rejectedTokens.has(token)) return;
    if (this.rejectedTokens.size >= MAX_PURCHASES) {
      /** Removes only the oldest memoized rejection when the session bound is reached. */
      const oldest = this.rejectedTokens.values().next();
      if (!oldest.done) this.rejectedTokens.delete(oldest.value);
    }
    this.rejectedTokens.add(token);
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
        /** Valid receipts proceed even when an earlier generation was permanently rejected. */
        const completion = await this.complete(purchase);
        switch (completion.status) {
          case "granted":
          case "rejected":
            break;
          case "invalid-grant":
            return {status: "terminal-failure", message: "facebook-purchase-grant-invalid"};
          default: {
            /** Makes any future fulfillment state require an explicit recovery policy. */
            const unreachable: never = completion;
            return unreachable;
          }
        }
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
