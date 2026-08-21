import {parseRecoverableRedditOrder} from "./redditPaymentOrder.ts";

type OrderPage = {orders: unknown[]; pageInfo?: {hasNextPage?: boolean; endCursor?: string}};
type Grant = (order: {orderId: string; productId: string; environment: "sandbox" | "production";
  purchasedAtMs: number}) => Promise<void>;

/** Manually filters account-tagged history because pinned SDK buyer filters are experimental. */
export async function recoverRedditCommerceOrders(input: {
  recoveryKey: string;
  environment: "sandbox" | "production";
  getPage(cursor?: string): Promise<OrderPage>;
  grant: Grant;
}): Promise<number> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.recoveryKey)) throw new Error("invalid-reddit-recovery-key");
  let cursor: string | undefined;
  let recovered = 0;
  for (let page = 0; page < 5; page += 1) {
    const response = await input.getPage(cursor);
    if (!Array.isArray(response.orders) || response.orders.length > 100) throw new Error("invalid-reddit-order-page");
    for (const value of response.orders) {
      let order;
      try { order = parseRecoverableRedditOrder(value); } catch { continue; }
      if (order.recoveryKey !== input.recoveryKey || order.environment !== input.environment) continue;
      await input.grant({orderId: order.orderId, productId: order.productId,
        environment: order.environment, purchasedAtMs: order.occurredAtMs});
      recovered += 1;
    }
    if (!response.pageInfo?.hasNextPage || !response.pageInfo.endCursor) break;
    if (response.pageInfo.endCursor === cursor) throw new Error("reddit-order-cursor-replay");
    cursor = response.pageInfo.endCursor;
  }
  return recovered;
}
