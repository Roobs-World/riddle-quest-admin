import type {Jest} from "@jest-com/types";

/** Identity fields used by the game; injected SDK doubles may omit presentation fields. */
type PlayerProjection = Pick<ReturnType<Jest["getPlayer"]>, "playerId" | "registered">;

/** SDK operations used by this adapter, derived from the provider contract. */
export type JestSdkBoundary = Partial<Pick<Jest,
  "init" | "login" | "showRegistrationOverlay" | "getEntryPayload" | "captureEvent" |
  "markFirstMilestone" | "setLoadingProgress" | "markGameLoaded"
>> & {
  /** Current player identity projection. */
  getPlayer?: () => PlayerProjection;
  /** Signed identity envelope with the same limited display projection. */
  getPlayerSigned?: () => Promise<Pick<Awaited<ReturnType<Jest["getPlayerSigned"]>>, "playerSigned"> & {
    /** Display identity accompanying the signed identity envelope. */
    player: PlayerProjection;
  }>;
  /** App-owned synchronous storage and write acknowledgments. */
  data?: Pick<Jest["data"], "getAll" | "set" | "delete" | "flush">;
  /** Notification scheduling operations. */
  notifications?: Pick<Jest["notifications"], "scheduleNotification" | "unscheduleNotification">;
  /** Profile and sharing-image operations. */
  social?: Pick<Jest["social"], "getProfile" | "setScreenshotProvider">;
  /** Signed conversion reads and referral sharing. */
  referrals?: Pick<Jest["referrals"], "shareReferralLink" | "listReferrals">;
  /** Checkout, recovery, and subscription operations. */
  payments?: Pick<Jest["payments"],
    "getProducts" | "beginPurchase" | "getIncompletePurchases" | "completePurchase" |
    "getSubscriptions" | "beginSubscription" | "cancelSubscription"
  >;
};

/** Rejects missing injected operations while preserving the SDK method receiver. */
export const invokeSdkOperation = <Args extends unknown[], Result>(
  owner: unknown,
  operation: ((...args: Args) => Result) | undefined,
  ...args: Args
): Result => {
  if (!operation) throw new Error("Jest SDK operation is unavailable.");
  return operation.apply(owner, args);
};
