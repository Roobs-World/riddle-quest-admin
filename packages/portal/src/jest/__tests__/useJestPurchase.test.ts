import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {Dispatch, SetStateAction} from "react";
import type {ProductSummary} from "../../play/types";
import type {JestPurchaseCoordinator} from "../purchases";
import type {JestSession} from "../types";

/** Provides mock track event behavior. */
const mockTrackEvent = jest.fn();
/** Provides mock track purchase behavior. */
const mockTrackPurchase = jest.fn();

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
  /** Provides subscribe behavior. */
  const subscribe = jest.fn<JestPurchaseCoordinator["subscribe"]>();
  /** Sets products. */
  const setProducts = jest.fn<Dispatch<SetStateAction<ProductSummary[]>>>();
  /** Tracks funnel. */
  const trackFunnel = jest.fn();
  /** Provides purchase product behavior. */
  const purchaseProduct = useJestPurchase({
    products,
    purchases: {purchase, subscribe} as unknown as JestPurchaseCoordinator,
    session: currentSession,
    setProducts,
    ...(subscriptionsEnabled === undefined ? {} : {subscriptionsEnabled}),
    trackFunnel,
  });
  return {purchase, purchaseProduct, setProducts, subscribe, trackFunnel};
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

  it("requires a registered player before beginning a subscription", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, subscribe} behavior. */
    const {purchaseProduct, subscribe} = createHarness({
      products: [subscription],
      currentSession: session(false),
      subscriptionsEnabled: true,
    });

    await expect(purchaseProduct("premium-monthly")).rejects.toThrow("Registration is required to subscribe.");
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
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
      success: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(mockTrackPurchase).not.toHaveBeenCalled();
  });

  it("returns a typed subscription cancellation without activating the product", async () => {
    /** Provides subscription behavior. */
    const subscription = product({
      productId: "premium-monthly",
      productType: "subscription",
      subscriptionStatus: "inactive",
    });
    /** Provides {purchase product, set products, subscribe, track funnel} behavior. */
    const {purchaseProduct, setProducts, subscribe, trackFunnel} = createHarness({
      products: [subscription],
      subscriptionsEnabled: true,
    });
    subscribe.mockResolvedValue({status: "cancelled"});

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: false,
      cancelled: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });
    expect(trackFunnel).toHaveBeenCalledWith("subscription_cancelled", {productId: "premium-monthly"});
    expect(setProducts).not.toHaveBeenCalled();
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
    const {purchaseProduct, subscribe} = createHarness({products: [subscription], subscriptionsEnabled: true});
    subscribe.mockResolvedValue({status: "terminal-failure", message: "Entitlement inactive"});

    await expect(purchaseProduct("premium-monthly")).rejects.toThrow("Entitlement inactive");
    expect(mockTrackPurchase).not.toHaveBeenCalled();
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
    const {purchaseProduct, setProducts, subscribe, trackFunnel} = createHarness({
      products,
      subscriptionsEnabled: true,
    });
    subscribe.mockResolvedValue({
      status: "success",
      value: {activeSku: "premium-monthly", blockedSkus: ["premium-yearly"]},
    });

    await expect(purchaseProduct("premium-monthly")).resolves.toEqual({
      success: true,
      productId: "premium-monthly",
      purchaseType: "subscription",
    });

    /** Provides update behavior. */
    const update = setProducts.mock.calls[0][0] as (current: ProductSummary[]) => ProductSummary[];
    expect(update(products)).toEqual([
      {...supporter, subscriptionStatus: "inactive", trialEligible: false},
      consumable,
    ]);
    expect(subscribe).toHaveBeenCalledWith("premium-monthly", "player-1");
    expect(trackFunnel).toHaveBeenCalledWith("subscription_completed", {productId: "premium-monthly"});
    expect(mockTrackPurchase).toHaveBeenCalledWith({
      productId: "premium-monthly",
      purchaseType: "subscription",
      price: 2.99,
      currency: "GBP",
    });
  });
});
