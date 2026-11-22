import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {ProductSummary} from "@riddle-quest/hosted/hostTypes";
import type {JestPurchaseCoordinator} from "../purchases";
import type {JestSession} from "../types";

/** Provides mock effects behavior. */
const mockEffects: Array<() => void> = [];
/** Provides mock set products behavior. */
const mockSetProducts = jest.fn();
/** Observes provider loading/error state independently of catalog publication. */
const mockSetCatalogState = jest.fn();
/** Retains hook refs across the explicit session rerenders in this harness. */
const mockRefs: Array<{
  /** Retained value owned by this hook slot. */
  current: unknown;
}> = [];
/** Starts each render at the first retained hook ref. */
let mockRefIndex = 0;
/** Models the catalog state published by earlier refreshes. */
let mockProducts: ProductSummary[] = [];

jest.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => mockRefs[mockRefIndex++] ?? (mockRefs[mockRefIndex - 1] = {current}),
  useEffect: (effect: () => void) => mockEffects.push(effect),
  useState: (initial: unknown) => [Array.isArray(initial) ? mockProducts : initial,
    Array.isArray(initial) ? mockSetProducts : mockSetCatalogState],
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
  await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Creates harness. */
const createHarness = (currentSession: JestSession | null, subscriptionsEnabled?: boolean) => {
  mockRefIndex = 0;
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
  mockRefs.length = 0;
  mockProducts = [];
  mockSetProducts.mockImplementation((products: unknown) => { mockProducts = products as ProductSummary[]; });
  mockSetCatalogState.mockImplementation((update: unknown) => {
    if (typeof update === "function") update({loading: false, error: false});
  });
});

describe("useJestProductCatalog", () => {
  it("starts both independent catalogs while consumables remain pending", async () => {
    /** Consumable offer returned only after the delayed product request resolves. */
    const consumable = product("coins-250", "consumable");
    /** Subscription offer available while the independent consumable request is pending. */
    const subscription = product("premium", "subscription");
    /** Catalog request controls and refresh action from the real hook fixture. */
    const {getProducts, getSubscriptions, state} = createHarness(session(true), true);
    /** Releases the delayed consumable catalog after both provider requests have started. */
    let finishProducts: ((value: Awaited<ReturnType<JestPurchaseCoordinator["getProducts"]>>) => void) | undefined;
    getProducts.mockImplementation(() => new Promise((resolve) => {finishProducts = resolve;}));
    getSubscriptions.mockResolvedValue({status: "success", value: [subscription]});

    /** Combined catalog refresh awaiting the delayed consumable response. */
    const refresh = state[2]();
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockSetProducts).not.toHaveBeenCalled();
    if (!finishProducts) throw new Error("Product request did not start");
    finishProducts({status: "success", value: [consumable]});
    await refresh;
    expect(mockSetProducts).toHaveBeenLastCalledWith([subscription, consumable]);
    expect(mockSetCatalogState).toHaveBeenLastCalledWith({loading: false, error: false});
  });

  it("keeps an empty catalog until a Jest session exists", async () => {
    /** Provides {get products, state, with platform activity} behavior. */
    const {getProducts, state, withPlatformActivity} = createHarness(null);

    expect(state[0]).toEqual([]);
    await flushCatalogLoad();
    expect(withPlatformActivity).not.toHaveBeenCalled();
    expect(getProducts).not.toHaveBeenCalled();
    expect(mockSetProducts).not.toHaveBeenCalled();
  });

  it("presents subscriptions before consumables for a registered player", async () => {
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
    expect(getProducts).toHaveBeenCalledWith("en");
    expect(getSubscriptions).toHaveBeenCalledWith("player-1", "en");
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

  it("offers subscriptions to guests alongside consumables", async () => {
    /** Provides consumable behavior. */
    const consumable = product("coins-250", "consumable");
    /** Inactive subscription offer that remains visible to a guest player. */
    const subscription = product("premium-monthly", "subscription");
    /** Provides {get products, get subscriptions} behavior. */
    const {getProducts, getSubscriptions} = createHarness(session(false), true);
    getProducts.mockResolvedValue({status: "success", value: [consumable]});
    getSubscriptions.mockResolvedValue({status: "success", value: [subscription]});

    await flushCatalogLoad();

    expect(getSubscriptions).toHaveBeenCalledWith("player-1", "en");
    expect(mockSetProducts).toHaveBeenCalledWith([subscription, consumable]);
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
  /** Exercises registered catalog refreshes with subscriptions enabled. */
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


it("preserves confirmed consumables on a transient refresh failure and clears the error after recovery", async () => {
  /** A previously confirmed consumable survives a transient SDK refresh failure. */
  const coin = product("coins-250", "consumable");
  /** Captures catalog refreshes for the current guest session. */
  const {getProducts, state} = createHarness(session(false));
  getProducts.mockResolvedValueOnce({status: "success", value: [coin]})
    .mockResolvedValueOnce({status: "retryable-failure", message: "offline"})
    .mockResolvedValueOnce({status: "success", value: []});
  await state[2]();
  await state[2]();
  expect(mockSetProducts).toHaveBeenLastCalledWith([coin]);
  expect(mockSetCatalogState).toHaveBeenLastCalledWith({loading: false, error: true});
  await state[2]();
  expect(mockSetProducts).toHaveBeenLastCalledWith([]);
  expect(mockSetCatalogState).toHaveBeenLastCalledWith({loading: false, error: false});
});

it("preserves consumables when the SDK throws while keeping subscription offers closed", async () => {
  /** A previously confirmed consumable survives a transient SDK refresh failure. */
  const coin = product("coins-250", "consumable");
  /** Exercises registered catalog refreshes with subscriptions enabled. */
  const {getProducts, getSubscriptions, state} = createHarness(session(true), true);
  getProducts.mockResolvedValueOnce({status: "success", value: [coin]}).mockRejectedValueOnce(new Error("offline"));
  getSubscriptions.mockResolvedValue({status: "success", value: [product("premium", "subscription")]});
  await state[2]();
  await state[2]();
  expect(mockSetProducts).toHaveBeenLastCalledWith([coin]);
  expect(mockSetCatalogState).toHaveBeenLastCalledWith({loading: false, error: true});
});

it("clears the prior wallet catalog before refreshing a different platform player", async () => {
  /** First wallet owns its confirmed offer until the session is replaced. */
  const first = createHarness(session(false));
  first.getProducts.mockResolvedValue({status: "success", value: [product("old-wallet", "consumable")]});
  await first.state[2]();
  /** A second wallet must not inherit offers when its first catalog request fails. */
  const secondSession = {...session(false), player: {playerId: "player-2", registered: false}};
  /** Rerenders the same hook instance with the new platform identity. */
  const second = createHarness(secondSession);
  second.getProducts.mockResolvedValue({status: "retryable-failure", message: "offline"});
  mockSetProducts.mockClear();
  await second.state[2]();
  expect(mockSetProducts.mock.calls).toEqual([[[]], [[]]]);
  expect(mockSetCatalogState).toHaveBeenLastCalledWith({loading: false, error: true});
});
