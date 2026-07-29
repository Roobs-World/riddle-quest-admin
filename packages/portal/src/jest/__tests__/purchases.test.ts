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
