import {afterAll, beforeAll, beforeEach, describe, expect, it, jest} from "@jest/globals";

import type {Dispatch, SetStateAction} from "react";
import type {ProductSummary} from "@riddle-quest/hosted/hostTypes";
import {JestPurchaseCoordinator} from "../purchases";
import {MockJestPlatform} from "../MockJestPlatform";
import {JestBackendClient} from "../backend";
import type {JestSession} from "../types";

/** Provides mock track event behavior. */
const mockTrackEvent = jest.fn();
/** Provides mock track purchase behavior. */
const mockTrackPurchase = jest.fn();
/** Original browser descriptor restored after installing language and lock fixtures. */
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

beforeAll(() => {
  Object.defineProperty(globalThis, "navigator", {configurable: true, value: {
    language: "en-GB",
    locks: {request: async (name: string, _options: LockOptions,
      operation: (lock: Pick<Lock, "name" | "mode">) => unknown) => operation({name, mode: "exclusive"})},
  }});
});

afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
}));

jest.mock("../../analytics/events", () => ({
  trackEvent: mockTrackEvent,
  trackPurchase: mockTrackPurchase,
}));

import {useJestPurchase} from "../useJestPurchase";

/** Provides product behavior. */
const product = (overrides: Partial<ProductSummary> = {}): ProductSummary => ({
  productId: "coins-250",
  productType: "consumable",
  name: "Coin pouch",
  description: "Adds coins",
  coins: 250,
  displayPrice: "£0.99",
  price: 0.99,
  currency: "GBP",
  ...overrides,
});

/** Provides session behavior. */
const session = (registered = true): JestSession => ({
  player: {playerId: "player-1", registered},
  profile: null,
  entryIntent: {},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
});

/** Creates harness. */
const createHarness = ({
  products = [product()],
  currentSession = session(),
  subscriptionsEnabled,
}: {
  /** Stores products. */
  products?: ProductSummary[];
  /** Stores current session. */
  currentSession?: JestSession | null;
  /** Stores subscriptions enabled. */
  subscriptionsEnabled?: boolean;
} = {}) => {
  /** Provides purchase behavior. */
  const purchase = jest.fn<JestPurchaseCoordinator["purchase"]>();
  /** Settles checkout after the coordinator has published its verified catalog. */
  const checkout = jest.fn<() => ReturnType<JestPurchaseCoordinator["subscribe"]>>();
  /** Models the coordinator callback contract; authority guards use the real coordinator below. */
  const subscribe = jest.fn<JestPurchaseCoordinator["subscribe"]>().mockImplementation(async (_sku, _playerId, options) => {
    options?.onCatalog?.(products.filter((entry) => entry.productType === "subscription"));
    return checkout();
  });
  /** Detects redundant hook-owned preflight requests. */
  const getSubscriptions = jest.fn<JestPurchaseCoordinator["getSubscriptions"]>();
  /** Sets products. */
  const setProducts = jest.fn<Dispatch<SetStateAction<ProductSummary[]>>>();
  /** Tracks funnel. */
  const trackFunnel = jest.fn();
  /** Provides purchase product behavior. */
  const purchaseProduct = useJestPurchase({
    products,
    purchases: {purchase, subscribe, getSubscriptions} as unknown as JestPurchaseCoordinator,
    session: currentSession,
    setProducts,
    ...(subscriptionsEnabled === undefined ? {} : {subscriptionsEnabled}),
    trackFunnel,
  });
  return {purchase, purchaseProduct, setProducts, subscribe, checkout, trackFunnel, getSubscriptions};
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useJestPurchase", () => {
  it("rejects checkout before the Jest session is ready", async () => {
    /** Provides {purchase, purchase product} behavior. */
    const {purchase, purchaseProduct} = createHarness({currentSession: null});

    await expect(purchaseProduct("coins-250")).rejects.toThrow("Jest session is not ready.");
    expect(purchase).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("completes a consumable purchase and reports its authoritative grant", async () => {
    /** Provides {purchase, purchase product, track funnel} behavior. */
    const {purchase, purchaseProduct, trackFunnel} = createHarness();
    purchase.mockResolvedValue({
      status: "success",
      value: {
        granted: true,
        purchaseToken: "purchase-1",
        coinsAwarded: 250,
        newCoins: 550,
        newlyUnlockedAchievementIds: ["first_purchase"],
      },
    });

    await expect(purchaseProduct("coins-250")).resolves.toEqual({
      success: true,
      productId: "coins-250",
      purchaseType: "consumable",
      coinsAwarded: 250,
      newCoins: 550,
      newlyUnlockedAchievementIds: ["first_purchase"],
    });
    expect(purchase).toHaveBeenCalledWith("coins-250", "player-1");
    expect(mockTrackEvent).toHaveBeenCalledWith("begin_checkout", {
      value: 0.99,
      currency: "GBP",
      items: [{item_id: "coins-250", item_category: "consumable", price: 0.99, quantity: 1}],
    });
    expect(trackFunnel).toHaveBeenCalledWith("purchase_completed", {productId: "coins-250"});
    expect(mockTrackPurchase).toHaveBeenCalledWith({
      productId: "coins-250",
      purchaseType: "consumable",
      price: 0.99,
      currency: "GBP",
    });
  });

  it("uses safe analytics defaults when a product is absent from the current catalog", async () => {
    /** Provides {purchase, purchase product} behavior. */
    const {purchase, purchaseProduct} = createHarness({products: []});
    purchase.mockResolvedValue({
      status: "success",
      value: {granted: true, purchaseToken: "purchase-1", coinsAwarded: 250, newCoins: 550},
    });

    await purchaseProduct("late-product");

    expect(mockTrackEvent).toHaveBeenCalledWith("begin_checkout", {
      value: undefined,
      currency: undefined,
      items: [{item_id: "late-product", item_category: "consumable", price: 0, quantity: 1}],
    });
  });

  it("returns a typed consumable cancellation without purchase telemetry", async () => {
    /** Provides {purchase, purchase product, track funnel} behavior. */
    const {purchase, purchaseProduct, trackFunnel} = createHarness();
    purchase.mockResolvedValue({status: "cancelled"});

    await expect(purchaseProduct("coins-250")).resolves.toEqual({
      success: false,
      cancelled: true,
      productId: "coins-250",
      purchaseType: "consumable",
    });
    expect(trackFunnel).toHaveBeenCalledWith("purchase_cancelled", {productId: "coins-250"});
    expect(trackFunnel).not.toHaveBeenCalledWith("purchase_completed", expect.anything());
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("keeps consumable checkout failures on the error path", async () => {
    /** Provides {purchase, purchase product, track funnel} behavior. */
    const {purchase, purchaseProduct, trackFunnel} = createHarness();
    purchase.mockResolvedValue({status: "retryable-failure", message: "Checkout timed out"});

    await expect(purchaseProduct("coins-250")).rejects.toThrow("Checkout timed out");
    expect(trackFunnel).not.toHaveBeenCalledWith("purchase_completed", expect.anything());
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("lets the platform handle guest subscription registration without an error", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, subscribe, checkout} = createHarness({
      products: [subscription],
      currentSession: session(false),
      subscriptionsEnabled: true,
    });
    checkout.mockResolvedValue({status: "unavailable", message: "guest_not_allowed"});

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: false,
      cancelled: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
    expect(subscribe).toHaveBeenCalledWith("premium-monthly", "player-1", {locale: navigator.language, onCatalog: expect.any(Function)});
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("rejects a production subscription before analytics or platform checkout", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, subscribe} = createHarness({products: [subscription]});

    await expect(purchaseProduct("premium-monthly")).rejects.toThrow("Subscriptions are not available.");
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("returns immediately for an already-active subscription", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "active",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, subscribe} = createHarness({products: [subscription], subscriptionsEnabled: true});

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: false,
      cancelled: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockTrackPurchase).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("returns a typed subscription cancellation without activating the product", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, set products, subscribe, track funnel} behavior. */
    const {purchaseProduct, setProducts, checkout, trackFunnel} = createHarness({
      products: [subscription],
      subscriptionsEnabled: true,
    });
    checkout.mockResolvedValue({status: "cancelled"});

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: false,
      cancelled: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
    expect(trackFunnel).toHaveBeenCalledWith("subscription_cancelled", {productId: "premium-monthly"});
    expect(setProducts).toHaveBeenCalledTimes(1);
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("keeps subscription checkout failures on the error path", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, checkout} = createHarness({products: [subscription], subscriptionsEnabled: true});
    checkout.mockResolvedValue({status: "terminal-failure", message: "Entitlement inactive"});

    await expect(purchaseProduct("premium-monthly")).rejects.toThrow("Entitlement inactive");
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("reports Premium coins granted with a new subscription", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, checkout} = createHarness({products: [subscription], subscriptionsEnabled: true});
    checkout.mockResolvedValueOnce({
      status: "success",
      value: {activeSku: "premium-monthly", blockedSkus: [], premiumCoinsAwarded: 3400, newCoins: 3700},
    });
    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
      coinsAwarded: 3400,
      newCoins: 3700,
    });

    // A grant without a reported balance leaves the displayed balance to the next profile load.
    checkout.mockResolvedValueOnce({
      status: "success",
      value: {activeSku: "premium-monthly", blockedSkus: [], premiumCoinsAwarded: 3400},
    });
    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
  });

  it("activates a verified subscription and removes conflicting billing cadences", async () => {
    /** Provides monthly behavior. */
    const monthly = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
      trialEligible: true,
      price: 2.99,
    });
    /** Provides yearly behavior. */
    const yearly = product({
      productId: "premium-yearly",
      productType: "subscription",
      subscriptionStatus: "inactive",
      trialEligible: true,
    });
    /** Provides supporter behavior. */
    const supporter = product({
      productId: "supporter-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
      trialEligible: true,
    });
    /** Provides consumable behavior. */
    const consumable = product();
    /** Provides products behavior. */
    const products = [monthly, yearly, supporter, consumable];
    /** Provides {purchase product, set products, subscribe, track funnel} behavior. */
    const {purchaseProduct, setProducts, subscribe, checkout, trackFunnel} = createHarness({
      products,
      subscriptionsEnabled: true,
    });
    checkout.mockResolvedValue({
      status: "success",
      value: {activeSku: "premium-monthly", blockedSkus: ["premium-yearly"], premiumCoinsAwarded: 0},
    });

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });

    /** Provides update behavior. */
    const update = setProducts.mock.calls.at(-1)![0] as (current: ProductSummary[]) => ProductSummary[];
    expect(update(products)).toEqual([
      {...monthly, subscriptionStatus: "active", trialEligible: false},
      consumable,
    ]);
    expect(subscribe).toHaveBeenCalledWith("premium-monthly", "player-1", {locale: navigator.language, onCatalog: expect.any(Function)});
    expect(trackFunnel).toHaveBeenCalledWith("subscription_completed", {productId: "premium-monthly"});
    expect(mockTrackPurchase).toHaveBeenCalledWith({
      productId: "premium-monthly",
      purchaseType: "subscription",
      price: 2.99,
      currency: "GBP",
    });
  });
});

it("publishes the locked coordinator's active holdings without checkout analytics", async () => {
  /** Creates an offer that becomes stale before checkout. */
  const subscription = product({productId: "premium", productType: "subscription", subscriptionStatus: "inactive"});
  /** Exposes checkout and the provider state refresh. */
  const {purchaseProduct, subscribe, getSubscriptions} = createHarness({products: [subscription], subscriptionsEnabled: true});
  subscribe.mockImplementation(async (_sku, _player, options) => {
    options?.onCatalog?.([{...subscription, subscriptionStatus: "active"}]);
    return {status: "cancelled"};
  });
  await expect(purchaseProduct("premium")).resolves.toEqual({success: false, cancelled: true,
    productId: "premium", purchaseType: "subscription"});
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(getSubscriptions).not.toHaveBeenCalled();
  expect(mockTrackEvent).not.toHaveBeenCalled();
  expect(mockTrackPurchase).not.toHaveBeenCalled();
});

it("fails closed when checkout preflight cannot read subscriptions", async () => {
  /** Starts with a previously available plan. */
  const subscription = product({productId: "premium", productType: "subscription"});
  /** Controls the provider failure at the purchase boundary. */
  const {purchaseProduct, subscribe, getSubscriptions} = createHarness({products: [subscription], subscriptionsEnabled: true});
  subscribe.mockResolvedValue({status: "retryable-failure", message: "offline"});
  await expect(purchaseProduct("premium")).rejects.toThrow("Failed to load shop products");
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(getSubscriptions).not.toHaveBeenCalled();
  expect(mockTrackEvent).not.toHaveBeenCalled();
});

it("removes a now-blocked cadence while preserving coin packs", async () => {
  /** Represents a cadence that was offered before another plan became active. */
  const subscription = product({productId: "premium", productType: "subscription"});
  /** Existing consumables are independent of subscription availability. */
  const coinPack = product();
  /** Exposes the state update used to remove the stale cadence. */
  const {purchaseProduct, subscribe, getSubscriptions, setProducts} = createHarness({products: [subscription, coinPack], subscriptionsEnabled: true});
  subscribe.mockImplementation(async (_sku, _player, options) => {
    options?.onCatalog?.([]);
    return {status: "cancelled"};
  });
  await expect(purchaseProduct("premium")).resolves.toEqual({success: false, cancelled: true,
    productId: "premium", purchaseType: "subscription"});
  /** Applies the actual catalog updater to the prior visible state. */
  const update = setProducts.mock.calls[0][0] as (current: ProductSummary[]) => ProductSummary[];
  expect(update([subscription, coinPack])).toEqual([coinPack]);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(getSubscriptions).not.toHaveBeenCalled();
  expect(mockTrackEvent).not.toHaveBeenCalled();
});

it("opens checkout after exactly one SDK catalog read and one verified preflight", async () => {
  /** Inactive premium offer used to initiate the guarded subscription purchase. */
  const subscription = product({productId: "premium", productType: "subscription", subscriptionStatus: "inactive"});
  /** Subscription-capable provider fixture with observable catalog and checkout calls. */
  const platform = new MockJestPlatform(true);
  /** Single signed SDK catalog response required before checkout. */
  const catalog = jest.spyOn(platform, "getSubscriptions").mockResolvedValue({status: "success", value: {
    subscriptions: [{sku: "premium", displayName: "Premium", displayDescription: "", price: 4.99,
      currency: "GBP", billingPeriod: "monthly", status: "inactive", trialEligible: true}],
    subscriptionsSigned: "catalog.signed",
  }});
  /** Releases authoritative holdings verification after the pending-state assertions. */
  let finishPreflight: (() => void) | undefined;
  /** Pending backend verification that must prevent checkout from opening. */
  const verification = new Promise<void>((resolve) => {finishPreflight = resolve;});
  /** Signals that the coordinator has reached authoritative holdings verification. */
  let markPreflightStarted: (() => void) | undefined;
  /** Synchronization point for assertions made before verification completes. */
  const preflightStarted = new Promise<void>((resolve) => {markPreflightStarted = resolve;});
  /** Backend client with controlled signed catalog and purchased-holding verification. */
  const backend = new JestBackendClient("https://example.invalid");
  /** Pauses catalog verification and grants the premium holding only after checkout. */
  const sync = jest.spyOn(backend, "syncSubscriptions").mockImplementation(async signed => {
    if (signed === "catalog.signed") {markPreflightStarted?.(); await verification;}
    return {verified: true, activeSkus: signed === "catalog.signed" ? [] : ["premium"]};
  });
  /** Records the provider checkout that must follow successful preflight. */
  const begin = jest.spyOn(platform, "beginSubscription");
  /** Captures verified catalog updates applied by the purchase hook. */
  const setProducts = jest.fn<Dispatch<SetStateAction<ProductSummary[]>>>();
  /** Real purchase hook wired to the coordinator and controlled provider. */
  const purchaseProduct = useJestPurchase({products: [subscription], purchases: new JestPurchaseCoordinator(platform, backend),
    session: session(), setProducts, subscriptionsEnabled: true, trackFunnel: jest.fn()});

  /** Pending purchase spanning locked preflight and provider checkout. */
  const purchase = purchaseProduct("premium");
  await preflightStarted;
  expect(catalog).toHaveBeenCalledTimes(1);
  expect(sync).toHaveBeenCalledTimes(1);
  expect(begin).not.toHaveBeenCalled();
  expect(mockTrackEvent).not.toHaveBeenCalled();
  expect(setProducts).not.toHaveBeenCalled();
  if (!finishPreflight) throw new Error("Preflight was not initialized");
  finishPreflight();

  await expect(purchase).resolves.toMatchObject({success: true, purchaseType: "subscription"});
  expect(catalog).toHaveBeenCalledTimes(1);
  expect(begin).toHaveBeenCalledTimes(1);
  expect(sync.mock.calls).toEqual([["catalog.signed", "player-1"], ["mock.subscription.signed", "player-1"]]);
  expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  /** Catalog update carrying the verified provider price after purchase. */
  const update = setProducts.mock.calls[0]?.[0];
  expect(typeof update === "function" ? update([])[0]?.displayPrice : undefined).toBe("£4.99");
});

it.each([
  {flags: {recoveredExistingSubscription: true}, expectedSuccess: false},
  {flags: {sandbox: true}, expectedSuccess: true},
])("does not report restored or sandbox subscriptions as new revenue: %j", async ({flags, expectedSuccess}) => {
  /** Inactive offer used to distinguish restored or sandbox subscriptions from revenue. */
  const subscription = product({productId: "premium", productType: "subscription", subscriptionStatus: "inactive"});
  /** Purchase action and coordinator checkout response controlled by the revenue scenario. */
  const {purchaseProduct, checkout} = createHarness({products: [subscription], subscriptionsEnabled: true});
  checkout.mockResolvedValue({status: "success", value: {activeSku: "premium", blockedSkus: [], premiumCoinsAwarded: 0, ...flags}});
  /** Hook outcome after applying the restored or sandbox subscription flags. */
  const result = await purchaseProduct("premium");
  expect(result.success).toBe(expectedSuccess);
  expect(mockTrackPurchase).not.toHaveBeenCalled();
});

it("does not report checkout or change offers when the coordinator cannot acquire its lock", async () => {
  /** Inactive offer selected while another actor owns the checkout lock. */
  const subscription = product({productId: "premium", productType: "subscription", subscriptionStatus: "inactive"});
  /** Purchase action, coordinator response, and catalog observer for lock contention. */
  const {purchaseProduct, subscribe, setProducts} = createHarness({products: [subscription], subscriptionsEnabled: true});
  subscribe.mockResolvedValue({status: "cancelled"});
  await expect(purchaseProduct("premium")).resolves.toMatchObject({success: false, cancelled: true});
  expect(mockTrackEvent).not.toHaveBeenCalled();
  expect(setProducts).not.toHaveBeenCalled();
});

it("applies a sandbox consumable grant without reporting real revenue", async () => {
  /** Purchase hook and observers for the sandbox revenue boundary. */
  const {purchase, purchaseProduct, trackFunnel} = createHarness();
  purchase.mockResolvedValue({status: "success", value: {coinsAwarded: 250, newCoins: 550, sandbox: true}});
  await expect(purchaseProduct("coins-250")).resolves.toMatchObject({
    success: true, productId: "coins-250", purchaseType: "consumable", coinsAwarded: 250, newCoins: 550,
  });
  expect(trackFunnel).toHaveBeenCalledWith("purchase_completed", {productId: "coins-250"});
  expect(mockTrackPurchase).not.toHaveBeenCalled();
});
