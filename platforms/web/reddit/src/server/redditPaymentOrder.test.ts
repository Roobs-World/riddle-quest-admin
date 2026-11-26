import test from "node:test";
import assert from "node:assert/strict";
import {parseRecoverableRedditOrder, parseRedditPaymentHook} from "./redditPaymentOrder.ts";

/** Provides order behavior. */
const order = {
  id: "order-1",
  userId: "t2_buyer",
  postId: "t3_post",
  status: "PAID",
  environment: "SANDBOX",
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:01:00.000Z",
  products: [{sku: "riddle_quest_coins_250", price: 50, accountingType: "CONSUMABLE"}],
  metadata: {},
};

test("projects exact paid and reverted Reddit orders", () => {
  assert.deepEqual(parseRedditPaymentHook(order, "fulfill"), {
    userId: "t2_buyer",
    postId: "t3_post",
    orderId: "order-1",
    productId: "riddle_quest_coins_250",
    environment: "sandbox",
    occurredAtMs: Date.parse("2026-08-20T12:00:00.000Z"),
  });
  assert.equal(parseRedditPaymentHook({...order, status: 6, environment: 2}, "refund").environment, "production");
});

test("rejects forged identity, lifecycle, environment, price, SKU, accounting and bundles", () => {
  for (const forged of [
    {...order, userId: "reddit_fake"},
    {...order, postId: "post"},
    {...order, status: "DELIVERED"},
    {...order, environment: "unknown"},
    {...order, products: [{...order.products[0], price: 5}]},
    {...order, products: [{...order.products[0], sku: "foreign_sku"}]},
    {...order, products: [{...order.products[0], accountingType: "DURABLE"}]},
    {...order, products: [order.products[0], order.products[0]]},
  ])
    assert.throws(() => parseRedditPaymentHook(forged, "fulfill"));
});

test("projects only paid or delivered orders carrying one exact opaque account tag", () => {
  /** Provides recovery key behavior. */
  const recoveryKey = "R".repeat(43);
  assert.deepEqual(
    parseRecoverableRedditOrder({
      ...order,
      status: "DELIVERED",
      createdAt: new Date(order.createdAt),
      metadata: {"riddle-account": recoveryKey},
    }),
    {
      orderId: "order-1",
      productId: "riddle_quest_coins_250",
      environment: "sandbox",
      occurredAtMs: Date.parse(order.createdAt),
      recoveryKey,
    },
  );
  for (const forged of [
    {...order, status: "NEW", metadata: {"riddle-account": recoveryKey}},
    {...order, metadata: {}},
    {...order, metadata: {"riddle-account": "short"}},
    {...order, products: [{...order.products[0], sku: "unknown"}], metadata: {"riddle-account": recoveryKey}},
  ])
    assert.throws(() => parseRecoverableRedditOrder(forged));
});
