import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {ProductSummary} from "../../play/types";
import type {JestPurchaseCoordinator} from "../purchases";
import type {JestSession} from "../types";

/** Provides mock effects behavior. */
const mockEffects: Array<() => void> = [];
/** Provides mock set products behavior. */
const mockSetProducts = jest.fn();

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useRef: () => ({current: 0}),
  useEffect: (effect: () => void) => mockEffects.push(effect),
  useState: () => [[], mockSetProducts],
}));

import {useJestProductCatalog} from "../useJestProductCatalog";

/** Provides product behavior. */
const product = (productId: string, productType: "consumable" | "subscription"): ProductSummary => ({
  productId,
  productType,
  name: productId,
  description: productId,
  coins: productType === "consumable" ? 250 : 0,
  displayPrice: "£0.99",
});

/** Provides session behavior. */
const session = (registered: boolean): JestSession => ({
  player: {playerId: "player-1", registered},
  profile: null,
  entryIntent: {},
  preferences: {},
  playerData: null,
  firebaseAuthenticated: true,
});

/** Provides flush catalog load behavior. */
const flushCatalogLoad = async () => {
  expect(mockEffects).toHaveLength(1);
  mockEffects[0]();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

/** Creates harness. */
const createHarness = (currentSession: JestSession | null, subscriptionsEnabled?: boolean) => {
  /** Gets products. */
  const getProducts = jest.fn<JestPurchaseCoordinator["getProducts"]>();
  /** Gets subscriptions. */
  const getSubscriptions = jest.fn<JestPurchaseCoordinator["getSubscriptions"]>();
  /** Tracks funnel. */
  const trackFunnel = jest.fn();
  /** Runs platform activity. */
  const withPlatformActivity = jest.fn(async (operation: () => Promise<unknown>) => operation());
  /** Provides state behavior. */
  const state = useJestProductCatalog({
    purchases: {getProducts, getSubscriptions} as unknown as JestPurchaseCoordinator,
    session: currentSession,
    ...(subscriptionsEnabled === undefined ? {} : {subscriptionsEnabled}),
    trackFunnel,
    withPlatformActivity: withPlatformActivity as never,
  });
  return {getProducts, getSubscriptions, state, trackFunnel, withPlatformActivity};
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEffects.length = 0;
});

describe("useJestProductCatalog", () => {
  it("keeps an empty catalog until a Jest session exists", async () => {
    /** Provides {get products, state, with platform activity} behavior. */
    const {getProducts, state, withPlatformActivity} = createHarness(null);

    expect(state[0]).toEqual([]);
    await flushCatalogLoad();
    expect(withPlatformActivity).not.toHaveBeenCalled();
    expect(getProducts).not.toHaveBeenCalled();
    expect(mockSetProducts).not.toHaveBeenCalled();
  });

  it("loads subscriptions before consumables for a registered player", async () => {
    /** Provides consumable behavior. */
    const consumable = product("coins-250", "consumable");
    /** Provides subscription behavior. */
    const subscription = product("premium-monthly", "subscription");
    /** Provides {get products, get subscriptions, track funnel, with platform activity} behavior. */
    const {getProducts, getSubscriptions, trackFunnel, withPlatformActivity} = createHarness(session(true), true);
    getProducts.mockResolvedValue({status: "success", value: [consumable]});
    getSubscriptions.mockResolvedValue({status: "success", value: [subscription]});

    await flushCatalogLoad();

    expect(withPlatformActivity).toHaveBeenCalledTimes(1);
    expect(getProducts).toHaveBeenCalledWith(expect.any(String));
    expect(getSubscriptions).toHaveBeenCalledWith("player-1", expect.any(String));
    expect(mockSetProducts).toHaveBeenCalledWith([subscription, consumable]);
    expect(trackFunnel).not.toHaveBeenCalled();
  });

  it("keeps subscription offers fail-closed for a production registered player", async () => {
    /** Provides consumable behavior. */
    const consumable = product("coins-250", "consumable");
    /** Provides {get products, get subscriptions} behavior. */
    const {getProducts, getSubscriptions} = createHarness(session(true));
    getProducts.mockResolvedValue({status: "success", value: [consumable]});

    await flushCatalogLoad();

    expect(getSubscriptions).not.toHaveBeenCalled();
    expect(mockSetProducts).toHaveBeenCalledWith([consumable]);
  });

  it("does not request subscription data for a guest", async () => {
    /** Provides consumable behavior. */
    const consumable = product("coins-250", "consumable");
    /** Provides {get products, get subscriptions} behavior. */
    const {getProducts, getSubscriptions} = createHarness(session(false));
    getProducts.mockResolvedValue({status: "success", value: [consumable]});

    await flushCatalogLoad();

    expect(getSubscriptions).not.toHaveBeenCalled();
    expect(mockSetProducts).toHaveBeenCalledWith([consumable]);
  });

  it("reports product and subscription failures independently", async () => {
    /** Provides {get products, get subscriptions, track funnel} behavior. */
    const {getProducts, getSubscriptions, trackFunnel} = createHarness(session(true), true);
    getProducts.mockResolvedValue({status: "retryable-failure", message: "offline"});
    getSubscriptions.mockResolvedValue({status: "cancelled"});

    await flushCatalogLoad();

    expect(mockSetProducts).toHaveBeenCalledWith([]);
    expect(trackFunnel).toHaveBeenNthCalledWith(1, "products_load_failed", {
      status: "retryable-failure",
    });
    expect(trackFunnel).toHaveBeenNthCalledWith(2, "subscriptions_load_failed", {
      status: "cancelled",
    });
  });
});

it("refreshes a Config-panel activation without restarting the player session", async () => {
  /** Keeps the same session while changing provider state. */
  const {getProducts, getSubscriptions, state} = createHarness(session(true), true);
  /** Starts with an inactive subscription offer. */
  const offer = {...product("premium", "subscription"), subscriptionStatus: "inactive" as const};
  getProducts.mockResolvedValue({status: "success", value: []});
  getSubscriptions.mockResolvedValue({status: "success", value: [offer]});
  await flushCatalogLoad();
  getSubscriptions.mockResolvedValue({status: "success", value: [{...offer, subscriptionStatus: "active"}]});
  await state[2]();
  expect(mockSetProducts).toHaveBeenLastCalledWith([{...offer, subscriptionStatus: "active"}]);
});

it("closes offers when refreshing throws", async () => {
  /** Simulates an SDK rejection before catalog normalization. */
  const {getProducts, state, trackFunnel} = createHarness(session(true), true);
  getProducts.mockRejectedValue(new Error("offline"));
  await state[2]();
  expect(mockSetProducts).toHaveBeenLastCalledWith([]);
  expect(trackFunnel).toHaveBeenCalledWith("subscriptions_load_failed", {status: "retryable-failure"});
});

it.each([false, true])("ignores departed-session responses (failure: %s)", async (fails) => {
  /** Keeps the provider call pending until the session effect is cleaned up. */
  let settle!: (value: never) => void;
  /** Controls a late catalog response from the departed wallet. */
  const {getProducts} = createHarness(session(true), false);
  getProducts.mockImplementation(() => new Promise((resolve, reject) => { settle = fails ? reject : resolve; }));
  /** Simulates unmounting or replacing the current wallet. */
  const cleanup = mockEffects[0]() as unknown as () => void;
  cleanup();
  settle((fails ? new Error("offline") : {status: "success", value: []}) as never);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockSetProducts).not.toHaveBeenCalled();
});
