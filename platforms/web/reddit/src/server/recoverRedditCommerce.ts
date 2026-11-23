import {parseRecoverableRedditOrder} from "./redditPaymentOrder.ts";

/** Describes order page. */
type OrderPage = {
  /** Stores orders. */
  orders: unknown[]; /** Stores page info. */
  /** Stores page info. */
  pageInfo?: {
    /** Stores has next page. */
    hasNextPage?: boolean; /** Stores end cursor. */
    /** Stores end cursor. */
    endCursor?: string;
  };
};
/** Describes grant. */
type Grant = (order: {
  /** Stores order id. */
  orderId: string; /** Stores product id. */
  /** Stores product id. */
  productId: string; /** Stores environment. */
  /** Stores environment. */
  environment: "sandbox" | "production";
  /** Stores purchased at ms. */
  purchasedAtMs: number;
}) => Promise<void>;

/** Manually filters account-tagged history because pinned SDK buyer filters are experimental. */
export async function recoverRedditCommerceOrders(input: {
  /** Stores recovery key. */
  recoveryKey: string;
  /** Stores environment. */
  environment: "sandbox" | "production";
  /** Gets page. */
  getPage(cursor?: string): Promise<OrderPage>;
  /** Stores grant. */
  grant: Grant;
}): Promise<number> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.recoveryKey)) throw new Error("invalid-reddit-recovery-key");
  /** Provides cursor behavior. */
  let cursor: string | undefined;
  /** Provides recovered behavior. */
  let recovered = 0;
  for (let page = 0; page < 5; page += 1) {
    /** Provides response behavior. */
    const response = await input.getPage(cursor);
    if (!Array.isArray(response.orders) || response.orders.length > 100) throw new Error("invalid-reddit-order-page");
    for (const value of response.orders) {
      /** Provides order behavior. */
      let order;
      try {
        order = parseRecoverableRedditOrder(value);
      } catch {
        continue;
      }
      if (order.recoveryKey !== input.recoveryKey || order.environment !== input.environment) continue;
      await input.grant({
        orderId: order.orderId,
        productId: order.productId,
        environment: order.environment,
        purchasedAtMs: order.occurredAtMs,
      });
      recovered += 1;
    }
    if (!response.pageInfo?.hasNextPage || !response.pageInfo.endCursor) break;
    if (response.pageInfo.endCursor === cursor) throw new Error("reddit-order-cursor-replay");
    cursor = response.pageInfo.endCursor;
  }
  return recovered;
}
