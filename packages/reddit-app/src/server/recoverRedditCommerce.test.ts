import assert from "node:assert/strict";
import test from "node:test";
import {recoverRedditCommerceOrders} from "./recoverRedditCommerce.ts";

const key = "R".repeat(43);
const order = (id: string, recoveryKey = key, environment: unknown = "SANDBOX") => ({
  id, status: "DELIVERED", environment, createdAt: "2026-08-20T12:00:00.000Z",
  products: [{sku: "riddle_quest_coins_250", price: 50, accountingType: "CONSUMABLE"}],
  metadata: {"riddle-account": recoveryKey},
});

test("recovers only matching account and environment orders across bounded pages", async () => {
  const granted: string[] = [];
  const cursors: Array<string | undefined> = [];
  const recovered = await recoverRedditCommerceOrders({recoveryKey: key, environment: "sandbox",
    getPage: async (cursor) => {
      cursors.push(cursor);
      return cursor ? {orders: [order("order-2")]} : {orders: [order("order-1"),
        order("foreign", "F".repeat(43)), order("production", key, "PRODUCTION"), {forged: true}],
      pageInfo: {hasNextPage: true, endCursor: "next"}};
    },
    grant: async (value) => { granted.push(value.orderId); },
  });
  assert.equal(recovered, 2);
  assert.deepEqual(granted, ["order-1", "order-2"]);
  assert.deepEqual(cursors, [undefined, "next"]);
});

test("fails closed on oversized pages, cursor replay and grant failure", async () => {
  await assert.rejects(recoverRedditCommerceOrders({recoveryKey: key, environment: "sandbox",
    getPage: async () => ({orders: Array(101).fill(order("x"))}), grant: async () => undefined}));
  await assert.rejects(recoverRedditCommerceOrders({recoveryKey: key, environment: "sandbox",
    getPage: async () => ({orders: [], pageInfo: {hasNextPage: true, endCursor: "same"}}),
    grant: async () => undefined}));
  await assert.rejects(recoverRedditCommerceOrders({recoveryKey: key, environment: "sandbox",
    getPage: async () => ({orders: [order("x")]}), grant: async () => { throw new Error("failed"); }}));
});
