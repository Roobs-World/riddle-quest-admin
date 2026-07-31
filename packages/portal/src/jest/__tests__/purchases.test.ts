import {MockJestPlatform} from "../MockJestPlatform";
import {JestPurchaseCoordinator} from "../purchases";

it("durably grants before completing a purchase", async () => {
  const order: string[] = [];
  const platform = new MockJestPlatform();
  platform.completePurchase = async () => { order.push("complete"); return {status: "success", value: undefined}; };
  const backend = {grantPurchase: async () => {
    order.push("grant");
    return {granted: true, purchaseToken: "t", coinsAwarded: 250, newCoins: 550};
  }};
  const coordinator = new JestPurchaseCoordinator(platform, backend as never);
  expect(await coordinator.purchase("coins", "p1")).toEqual({
    status: "success",
    value: {coinsAwarded: 250, newCoins: 550},
  });
  expect(order).toEqual(["grant", "complete"]);
});

it("does not complete when the backend grant fails", async () => {
  const platform = new MockJestPlatform();
  platform.completePurchase = jest.fn(platform.completePurchase);
  const coordinator = new JestPurchaseCoordinator(platform, {grantPurchase: async () => { throw new Error("offline"); }} as never);
  expect(await coordinator.purchase("coins", "p1")).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("paginates and completes every recovered purchase", async () => {
  const platform = new MockJestPlatform();
  let page = 0;
  platform.getIncompletePurchases = async () => {
    page += 1;
    return {status: "success", value: {purchases: [{purchaseToken: `t${page}`, productSku: "coins"}], purchasesSigned: `signed-${page}`, hasMore: page === 1}};
  };
  platform.completePurchase = jest.fn(async () => ({status: "success", value: undefined}));
  const backend = {grantPurchase: jest.fn(async () => ({
    granted: true,
    purchaseToken: "t",
    coinsAwarded: 250,
    newCoins: 550,
  }))};
  const result = await new JestPurchaseCoordinator(platform, backend as never).reconcile("p1");
  expect(result).toEqual({status: "success", value: 2});
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(1, "signed-1", "p1", "t1");
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(2, "signed-2", "p1", "t2");
  expect(platform.completePurchase).toHaveBeenCalledTimes(2);
});

it("maps the Jest catalog with SDK currency and trusted coin values", async () => {
  const platform = new MockJestPlatform();
  const coordinator = new JestPurchaseCoordinator(platform, {
    grantPurchase: async () => ({granted: true, purchaseToken: "t", coinsAwarded: 250, newCoins: 550}),
  } as never);
  const result = await coordinator.getProducts("en-US");
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value).toHaveLength(6);
  expect(result.value[0]).toEqual(expect.objectContaining({
    productId: "com.roobsworld.riddlequest.coinpack1",
    coins: 250,
    displayPrice: "$0.99",
  }));
  expect(result.value[5]).toEqual(expect.objectContaining({
    productId: "com.roobsworld.riddlequest.coinpack6",
    coins: 7000,
    displayPrice: "$19.99",
  }));
});

it("uses only backend-verified subscription status in the shop catalog", async () => {
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => ({
    status: "success",
    value: {
      subscriptions: [{
        sku: "premium",
        displayName: "Premium",
        displayDescription: "Member access",
        price: 4.99,
        currency: "USD",
        billingPeriod: "monthly",
        status: "active",
        trialEligible: true,
      }],
      subscriptionsSigned: "catalog.signed",
    },
  });
  const backend = {
    syncSubscriptions: jest.fn(async () => ({verified: true, activeSkus: []})),
  };
  const result = await new JestPurchaseCoordinator(platform, backend as never)
    .getSubscriptions("p1", "en-US");
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("catalog.signed", "p1");
  expect(result).toEqual({
    status: "success",
    value: [expect.objectContaining({
      productId: "premium",
      productType: "subscription",
      subscriptionStatus: "inactive",
      displayPrice: "$4.99",
      billingPeriod: "monthly",
    })],
  });
});

it("verifies a subscription before applying the active entitlement and never completes it as an IAP", async () => {
  const platform = new MockJestPlatform(true);
  platform.completePurchase = jest.fn(platform.completePurchase);
  platform.beginSubscription = async () => ({
    status: "success",
    value: {
      subscription: {
        sku: "premium",
        displayName: "Premium",
        displayDescription: null,
        price: 4.99,
        currency: "USD",
        billingPeriod: "monthly",
        status: "active",
      },
      subscriptionSigned: "subscription.signed",
    },
  });
  const backend = {
    syncSubscriptions: jest.fn(async () => ({verified: true, activeSkus: ["premium"]})),
  };
  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe("premium", "p1"))
    .toEqual({status: "success", value: {activeSku: "premium"}});
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("subscription.signed", "p1");
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("rejects an unverified active subscription", async () => {
  const platform = new MockJestPlatform(true);
  const backend = {
    syncSubscriptions: async () => ({verified: true, activeSkus: []}),
  };
  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe(
    "com.roobsworld.riddlequest.premium.monthly",
    "p1",
  )).toEqual({
    status: "terminal-failure",
    message: "Subscription entitlement was not active",
  });
});

it("refreshes and verifies an existing subscription after an already-subscribed response", async () => {
  const platform = new MockJestPlatform(true);
  platform.beginSubscription = async () => ({status: "unavailable", message: "already_subscribed"});
  platform.getSubscriptions = jest.fn(async () => ({
    status: "success",
    value: {
      subscriptions: [],
      subscriptionsSigned: "subscriptions.refreshed",
    },
  }));
  const backend = {
    syncSubscriptions: jest.fn(async () => ({verified: true, activeSkus: ["premium"]})),
  };

  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe("premium", "p1"))
    .toEqual({status: "success", value: {activeSku: "premium"}});
  expect(platform.getSubscriptions).toHaveBeenCalledTimes(1);
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("subscriptions.refreshed", "p1");
});
