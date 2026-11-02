import {describe, expect, it, jest} from "@jest/globals";
import {NativeModules} from "react-native";
import {createAndroidCommerce} from "../billing/androidCommerce";
import {ANDROID_COIN_PACKS, ANDROID_PREMIUM_SUBSCRIPTIONS} from "../billing/catalog";
import {createPlayBillingPort, getPlayBilling} from "../billing/playBilling";
import {SHOP_COPY, shopText} from "../i18n/shopCopy";
import {MONTHLY_ID, PACK_ID, createFakeBilling, createFakePurchaseBackend, inapp, owned, subs} from "../test/fakeBilling";

describe("Play catalog", () => {
  it("sells the shared coin packs in shop order with their badges and both Premium plans", () => {
    expect(ANDROID_COIN_PACKS.map((pack) => [pack.coins, pack.badge])).toEqual([
      [250, "starter"],
      [550, null],
      [900, null],
      [1600, "popular"],
      [3400, null],
      [7000, "bestValue"],
    ]);
    expect(ANDROID_PREMIUM_SUBSCRIPTIONS).toEqual([MONTHLY_ID, "com.roobsworld.riddlequest.premium.yearly"]);
  });
});

describe("createPlayBillingPort", () => {
  /** Native module double. */
  const createNative = (overrides: Record<string, unknown> = {}) => ({
    getProducts: jest.fn(async (..._args: unknown[]) => [
      {productId: PACK_ID, type: "inapp", price: "£1.99"},
      {productId: MONTHLY_ID, type: "subs", price: "£9.99", offerToken: "offer", billingPeriod: "P1M"},
      {productId: "broken", type: "other", price: "£1"},
      {productId: 7},
      null,
    ]),
    purchase: jest.fn(async (..._args: unknown[]) => ({status: "purchased", purchases: [{purchaseToken: "t", products: [PACK_ID, 3], state: "purchased"}, {state: "x"}]})),
    getOwnedPurchases: jest.fn(async (..._args: unknown[]) => [{purchaseToken: "p", products: [PACK_ID], state: "pending"}, {purchaseToken: "q", products: [], state: "??"}]),
    consume: jest.fn(async (..._args: unknown[]) => undefined),
    ...overrides,
  });

  it("validates products and purchases the native module returns", async () => {
    const native = createNative();
    const port = createPlayBillingPort(native as never);
    expect(await port.getProducts([PACK_ID], [MONTHLY_ID])).toEqual([
      inapp(PACK_ID),
      {productId: MONTHLY_ID, type: "subs", price: "£9.99", offerToken: "offer", billingPeriod: "P1M"},
    ]);
    expect(await port.purchase(subs(MONTHLY_ID), "uid")).toEqual({status: "purchased", purchases: [owned("t", PACK_ID)]});
    expect(native.purchase).toHaveBeenCalledWith(MONTHLY_ID, "subs", `offer-${MONTHLY_ID}`, "uid");
    expect(await port.getOwnedPurchases("inapp")).toEqual([owned("p", PACK_ID, "pending"), {purchaseToken: "q", products: [], state: "unspecified"}]);
    await port.consume("t");
    expect(native.consume).toHaveBeenCalledWith("t");
  });

  it("maps pending, cancelled and malformed checkouts and opens Play's subscription page", async () => {
    const results: unknown[] = [{status: "pending"}, {status: "cancelled"}, null, {status: "purchased", purchases: "nope"}];
    const openUrl = jest.fn(async (..._args: unknown[]) => true);
    const port = createPlayBillingPort(createNative({purchase: jest.fn(async () => results.shift()), getProducts: jest.fn(async () => "nope")}) as never, openUrl);
    expect(await port.purchase(inapp(PACK_ID), "uid")).toEqual({status: "pending"});
    expect(await port.purchase(inapp(PACK_ID), "uid")).toEqual({status: "cancelled"});
    expect(await port.purchase(inapp(PACK_ID), "uid")).toEqual({status: "cancelled"});
    expect(await port.purchase(inapp(PACK_ID), "uid")).toEqual({status: "purchased", purchases: []});
    expect(await port.getProducts([], [])).toEqual([]);
    await port.manageSubscription(MONTHLY_ID);
    expect(openUrl).toHaveBeenCalledWith(
      `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(MONTHLY_ID)}&package=com.roobsworld.riddlequest`,
    );
  });

  it("binds the registered native module and reports its absence", () => {
    expect(getPlayBilling()).toBeNull();
    (NativeModules as Record<string, unknown>).RiddleQuestPlayBilling = createNative();
    try {
      expect(getPlayBilling()).not.toBeNull();
    } finally {
      delete (NativeModules as Record<string, unknown>).RiddleQuestPlayBilling;
    }
  });
});

describe("createAndroidCommerce", () => {
  it("grants a coin checkout and leaves consumption to the backend", async () => {
    const billing = createFakeBilling({checkouts: [{status: "purchased", purchases: [owned("tok", PACK_ID)]}]});
    const backend = createFakePurchaseBackend({grants: {tok: {}}});
    const outcome = await createAndroidCommerce(billing, backend).checkout(inapp(PACK_ID), "uid");
    expect(outcome).toEqual({kind: "coins", coinsAwarded: 550, newCoins: 850});
    expect(backend.calls).toEqual(["grant:tok"]);
    expect(billing.calls).toEqual([`purchase:${PACK_ID}:uid`]);
  });

  it("consumes locally when the backend could not, and fails a checkout that granted nothing", async () => {
    const billing = createFakeBilling({
      checkouts: [
        {status: "purchased", purchases: [owned("tok", PACK_ID)]},
        {status: "purchased", purchases: [owned("pend", PACK_ID, "pending"), owned("other", "unknown.product")]},
      ],
    });
    const commerce = createAndroidCommerce(billing, createFakePurchaseBackend({grants: {tok: {consumed: false}}}));
    await commerce.checkout(inapp(PACK_ID), "uid");
    expect(billing.calls).toContain("consume:tok");
    await expect(commerce.checkout(inapp(PACK_ID), "uid")).rejects.toThrow("purchase-not-granted");
  });

  it("passes pending and cancelled checkouts through without calling the backend", async () => {
    const backend = createFakePurchaseBackend();
    const commerce = createAndroidCommerce(createFakeBilling({checkouts: [{status: "pending"}, {status: "cancelled"}]}), backend);
    expect(await commerce.checkout(inapp(PACK_ID), "uid")).toEqual({kind: "pending"});
    expect(await commerce.checkout(inapp(PACK_ID), "uid")).toEqual({kind: "cancelled"});
    expect(backend.calls).toEqual([]);
  });

  it("verifies a subscription checkout with every owned, completed subscription token", async () => {
    const billing = createFakeBilling({
      checkouts: [{status: "purchased", purchases: [owned("sub", MONTHLY_ID)]}],
      ownedSubs: [owned("sub", MONTHLY_ID), owned("waiting", MONTHLY_ID, "pending")],
    });
    const backend = createFakePurchaseBackend({sync: {activeSkus: [MONTHLY_ID], premiumCoinsAwarded: 3400, newCoins: 3700}});
    expect(await createAndroidCommerce(billing, backend).checkout(subs(MONTHLY_ID), "uid")).toEqual({
      kind: "premium",
      activeSkus: [MONTHLY_ID],
      premiumCoinsAwarded: 3400,
      newCoins: 3700,
    });
    expect(backend.calls).toEqual(["sync:sub"]);
  });

  it("restores unsettled coin purchases, counting only new grants, and re-verifies subscriptions", async () => {
    const billing = createFakeBilling({ownedInapp: [owned("new", PACK_ID), owned("old", PACK_ID)], ownedSubs: []});
    const backend = createFakePurchaseBackend({grants: {new: {}, old: {alreadyProcessed: true, newCoins: 850}}, sync: {newCoins: 850}});
    expect(await createAndroidCommerce(billing, backend).restore()).toEqual({coinsAwarded: 550, activeSkus: [], newCoins: 850});
    expect(backend.calls).toEqual(["grant:new", "grant:old", "sync:"]);
  });
});

describe("shop copy", () => {
  it("covers every locale with the same keys and fills placeholders", () => {
    /** English keys. */
    const keys = Object.keys(SHOP_COPY.en).sort();
    for (const table of Object.values(SHOP_COPY)) {
      expect(Object.keys(table).sort()).toEqual(keys);
      for (const value of Object.values(table)) expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(shopText("en", "coinsAdded", {coins: 550})).toBe("550 coins added.");
    expect(shopText("de", "coinsAdded", {coins: 550})).toBe("550 Münzen hinzugefügt.");
    expect(shopText("en", "coinsAdded")).toBe("{coins} coins added.");
    for (const locale of Object.keys(SHOP_COPY) as (keyof typeof SHOP_COPY)[]) {
      if (locale !== "en") expect(shopText(locale, "purchasePending")).not.toBe(shopText("en", "purchasePending"));
    }
  });
});
