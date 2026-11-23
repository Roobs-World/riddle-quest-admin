import {MockJestPlatform} from "../MockJestPlatform";

import {JestPurchaseCoordinator} from "../purchases";
import {JestBackendClient} from "../backend";
import type {JestPlatformPort} from "../types";
import {configureBrowserErrorReporter, resetBrowserErrorReporterForTests} from "../../../../../packages/web-game/src/observability/browserErrorReporter";

/** Simulates browser-owned cross-tab checkout exclusion for coordinator fixtures. */
const checkoutLocks = new Set<string>();
/** Original browser descriptor restored after installing the checkout-lock fixture. */
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

beforeAll(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (
          name: string,
          _options: LockOptions,
          operation: (lock: Pick<Lock, "name" | "mode"> | null) => unknown,
        ) => {
          if (checkoutLocks.has(name)) return operation(null);
          checkoutLocks.add(name);
          try {
            return await operation({name, mode: "exclusive"});
          } finally {
            checkoutLocks.delete(name);
          }
        },
      },
    },
  });
});

afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

/** Returns one signed inactive offer for subscription preflight scenarios. */
const inactiveSubscriptionCatalog = (sku = "premium") => ({
  status: "success" as const,
  value: {
    subscriptions: [{
      sku,
      displayName: "Premium",
      displayDescription: null,
      price: 4.99,
      currency: "USD",
      billingPeriod: "monthly" as const,
      status: "inactive" as const,
    }],
    subscriptionsSigned: "catalog.inactive",
  },
});

it.each(["active", "missing", "verification-failed", "lock-busy"])(
  "keeps the locked subscription preflight fail-closed: %s", async condition => {
    /** Subscription-capable platform with a controlled catalog and checkout spy. */
    const platform = new MockJestPlatform(true);
    /** Baseline signed offer adjusted for each preflight rejection scenario. */
    const available = inactiveSubscriptionCatalog();
    /** Records catalog reads and returns the scenario-specific subscription holding. */
    const getSubscriptions = jest.spyOn(platform, "getSubscriptions").mockResolvedValue({status: "success", value: {
      ...available.value,
      subscriptions: condition === "missing" ? [] : available.value.subscriptions.map(subscription => ({...subscription,
        displayDescription: "", trialEligible: condition !== "active", status: condition === "active" ? "active" : "inactive"})),
    }});
    /** Records checkout attempts that every rejected preflight must prevent. */
    const begin = jest.spyOn(platform, "beginSubscription");
    /** Backend client whose subscription verification is controlled by this scenario. */
    const backend = new JestBackendClient("https://example.invalid");
    /** Returns verified holdings or fails verification before checkout can begin. */
    const sync = jest.spyOn(backend, "syncSubscriptions").mockResolvedValue({verified: true,
      activeSkus: condition === "active" ? ["premium"] : []});
    if (condition === "verification-failed") sync.mockRejectedValue(new Error("Signed holdings unavailable"));
    /** Records catalog changes permitted after a verified holding or missing offer. */
    const onCatalog = jest.fn();
    /** Player-scoped checkout lock occupied by the competing-tab scenario. */
    const lockName = "riddle-quest:jest-subscription:p1";
    if (condition === "lock-busy") checkoutLocks.add(lockName);
    try {
      /** Coordinator outcome after the guarded subscription preflight. */
      const result = await new JestPurchaseCoordinator(platform, backend).subscribe("premium", "p1", {locale: "en-GB", onCatalog});
      expect(result.status).toBe(condition === "verification-failed" ? "retryable-failure" : "cancelled");
      expect(begin).not.toHaveBeenCalled();
      expect(getSubscriptions).toHaveBeenCalledTimes(condition === "lock-busy" ? 0 : 1);
      expect(sync).toHaveBeenCalledTimes(condition === "lock-busy" ? 0 : 1);
      expect(onCatalog).toHaveBeenCalledTimes(condition === "active" || condition === "missing" ? 1 : 0);
      if (condition === "active") expect(onCatalog).toHaveBeenCalledWith([expect.objectContaining({subscriptionStatus: "active"})]);
      if (condition === "missing") expect(onCatalog).toHaveBeenCalledWith([]);
    } finally {checkoutLocks.delete(lockName);}
  },
);

it("durably grants before completing a purchase", async () => {
  /** Provides order behavior. */
  const order: string[] = [];
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.completePurchase = async () => {
    order.push("complete");
    return {status: "success", value: undefined};
  };
  /** Provides backend behavior. */
  const backend = {
    grantPurchase: async () => {
      order.push("grant");
      return {granted: true, purchaseToken: "t", coinsAwarded: 250, newCoins: 550};
    },
  };
  /** Provides coordinator behavior. */
  const coordinator = new JestPurchaseCoordinator(platform, backend as never);
  expect(await coordinator.purchase("coins", "p1")).toEqual({
    status: "success",
    value: {coinsAwarded: 250, newCoins: 550},
  });
  expect(order).toEqual(["grant", "complete"]);
});

it("does not complete when the backend grant fails", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.completePurchase = jest.fn(platform.completePurchase);
  /** Provides coordinator behavior. */
  const coordinator = new JestPurchaseCoordinator(platform, {
    grantPurchase: async () => {
      throw new Error("offline");
    },
  } as never);
  expect(await coordinator.purchase("coins", "p1")).toEqual({status: "retryable-failure", message: "offline"});
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("paginates and completes every recovered purchase", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides page behavior. */
  let page = 0;
  platform.getIncompletePurchases = async () => {
    page += 1;
    return {
      status: "success",
      value: {
        purchases: [{purchaseToken: `t${page}`, productSku: "coins"}],
        purchasesSigned: `signed-${page}`,
        hasMore: page === 1,
      },
    };
  };
  platform.completePurchase = jest.fn(async () => ({status: "success", value: undefined}));
  /** Provides backend behavior. */
  const backend = {
    grantPurchase: jest.fn(async () => ({
      granted: true,
      purchaseToken: "t",
      coinsAwarded: 250,
      newCoins: 550,
    })),
  };
  /** Provides result behavior. */
  const result = await new JestPurchaseCoordinator(platform, backend as never).reconcile("p1");
  expect(result).toEqual({status: "success", value: 2});
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(1, "signed-1", "p1", "t1");
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(2, "signed-2", "p1", "t2");
  expect(platform.completePurchase).toHaveBeenCalledTimes(2);
});

it("consumes a startup recovery page before requesting the next page", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success" as const,
    value: {
      purchases: [{purchaseToken: "t2", productSku: "coins"}],
      purchasesSigned: "signed-2",
      hasMore: false,
    },
  }));
  platform.completePurchase = jest.fn(async () => ({status: "success" as const, value: undefined}));
  /** Provides backend behavior. */
  const backend = {
    grantPurchase: jest.fn(async () => ({
      granted: true,
      purchaseToken: "t",
      coinsAwarded: 250,
      newCoins: 550,
    })),
  };

  await expect(
    new JestPurchaseCoordinator(platform, backend as never).reconcile("p1", {
      purchases: [{purchaseToken: "t1", productSku: "coins"}],
      purchasesSigned: "signed-1",
      hasMore: true,
    }),
  ).resolves.toEqual({status: "success", value: 2});

  expect(platform.getIncompletePurchases).toHaveBeenCalledTimes(1);
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(1, "signed-1", "p1", "t1");
  expect(backend.grantPurchase).toHaveBeenNthCalledWith(2, "signed-2", "p1", "t2");
});

it("maps the Jest catalog with SDK currency and trusted coin values", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides coordinator behavior. */
  const coordinator = new JestPurchaseCoordinator(platform, {
    grantPurchase: async () => ({granted: true, purchaseToken: "t", coinsAwarded: 250, newCoins: 550}),
  } as never);
  /** Provides result behavior. */
  const result = await coordinator.getProducts("en-US");
  expect(result.status).toBe("success");
  if (result.status !== "success") return;
  expect(result.value).toHaveLength(6);
  expect(result.value[0]).toEqual(
    expect.objectContaining({
      productId: "com.roobsworld.riddlequest.coinpack1",
      coins: 250,
      displayPrice: "$0.99",
    }),
  );
  expect(result.value[5]).toEqual(
    expect.objectContaining({
      productId: "com.roobsworld.riddlequest.coinpack6",
      coins: 7000,
      displayPrice: "$19.99",
    }),
  );
});

it.each(["en-US@posix", "C", "not a locale", ""])(
  "still lists products and subscriptions when the browser reports the locale %j",
  async (locale) => {
    /** Injected Jest platform with subscriptions. */
    const platform = new MockJestPlatform(true);
    /** Purchase coordinator with a verified subscription backend. */
    const coordinator = new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => ({verified: true, activeSkus: [], blockedSkus: []}),
    } as never);
    for (const result of [await coordinator.getProducts(locale), await coordinator.getSubscriptions("p1", locale)]) {
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("Catalog unavailable");
      expect(result.value.length).toBeGreaterThan(0);
      for (const product of result.value) {
        expect(product.displayPrice).toBe(new Intl.NumberFormat(undefined, {style: "currency", currency: "USD"}).format(product.price!));
      }
    }
  },
);

it.each(["en-US", "en-GB", "de", "ja", "ar"])(
  "keeps the SDK checkout currency for products and subscriptions in %s",
  async (locale) => {
    /** Injected Jest platform for this scenario. */
    const platform = new MockJestPlatform(true);
    /** Purchase coordinator with a verified subscription backend. */
    const coordinator = new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => ({verified: true, activeSkus: [], blockedSkus: []}),
    } as never);
    /** Catalog entries returned by the provider. */
    const products = await coordinator.getProducts(locale);
    /** Subscription catalog rendered for this locale. */
    const subscriptions = await coordinator.getSubscriptions("p1", locale);
    for (const result of [products, subscriptions]) {
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("Catalog unavailable");
      expect(result.value.length).toBeGreaterThan(0);
      for (const product of result.value) {
        expect(product.currency).toBe("USD");
        expect(product.displayPrice).toBe(
          new Intl.NumberFormat(locale, {style: "currency", currency: "USD"}).format(product.price!),
        );
        expect(product.displayPrice).not.toMatch(/Gold|credits/i);
      }
    }
  },
);

it("does not sell a subscription the SDK says is held, even when verification disagrees", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => ({
    status: "success",
    value: {
      subscriptions: [
        {
          sku: "premium",
          displayName: "Premium",
          displayDescription: "Member access",
          price: 4.99,
          currency: "USD",
          billingPeriod: "monthly",
          status: "active",
          trialEligible: true,
        },
      ],
      subscriptionsSigned: "catalog.signed",
    },
  });
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: jest.fn(async () => ({verified: true, activeSkus: [], blockedSkus: []})),
  };
  /** Provides result behavior. */
  const result = await new JestPurchaseCoordinator(platform, backend as never).getSubscriptions("p1", "en-US");
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("catalog.signed", "p1");
  expect(result).toEqual({
    status: "success",
    value: [
      expect.objectContaining({
        productId: "premium",
        productType: "subscription",
        subscriptionStatus: "active",
        displayPrice: "$4.99",
        billingPeriod: "monthly",
      }),
    ],
  });
});

it("never re-offers an active subscription or an equivalent blocked cadence", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => ({
    status: "success",
    value: {
      subscriptions: [
        {
          sku: "premium-monthly",
          displayName: "Premium monthly",
          displayDescription: null,
          price: 4.99,
          currency: "USD",
          billingPeriod: "monthly",
          status: "active",
          trialEligible: false,
        },
        {
          sku: "premium-yearly",
          displayName: "Premium yearly",
          displayDescription: null,
          price: 49.99,
          currency: "USD",
          billingPeriod: "yearly",
          status: "inactive",
          trialEligible: true,
        },
        {
          sku: "supporter-monthly",
          displayName: "Supporter monthly",
          displayDescription: null,
          price: 1.99,
          currency: "USD",
          billingPeriod: "monthly",
          status: "inactive",
          trialEligible: false,
        },
      ],
      subscriptionsSigned: "catalog.signed",
    },
  });
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: jest.fn(async () => ({
      verified: true,
      activeSkus: ["premium-monthly"],
      blockedSkus: ["premium-yearly"],
    })),
  };

  /** Provides result behavior. */
  const result = await new JestPurchaseCoordinator(platform, backend as never).getSubscriptions("p1", "en-US");

  expect(result).toEqual({
    status: "success",
    value: [
      expect.objectContaining({
        productId: "premium-monthly",
        subscriptionStatus: "active",
      }),
    ],
  });
});

it("verifies a subscription before applying the active entitlement and never completes it as an IAP", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.completePurchase = jest.fn(platform.completePurchase);
  platform.getSubscriptions = async () => inactiveSubscriptionCatalog();
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
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: jest.fn(async (signed: string) => ({
      verified: true,
      activeSkus: signed === "catalog.inactive" ? [] : ["premium"],
      blockedSkus: ["premium-yearly"],
    })),
  };
  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe("premium", "p1")).toEqual({
    status: "success",
    value: {activeSku: "premium", blockedSkus: ["premium-yearly"], premiumCoinsAwarded: 0},
  });
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("subscription.signed", "p1");
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("reports the Premium coins granted when a new subscription is verified", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => inactiveSubscriptionCatalog();
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
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: jest.fn(async (signed: string) => ({
      verified: true,
      activeSkus: signed === "catalog.inactive" ? [] : ["premium"],
      blockedSkus: [],
      premiumCoinsAwarded: 3400,
      newCoins: 3700,
    })),
  };
  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe("premium", "p1")).toEqual({
    status: "success",
    value: {activeSku: "premium", blockedSkus: [], premiumCoinsAwarded: 3400, newCoins: 3700},
  });
});

it("rejects an unverified active subscription", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: async () => ({verified: true, activeSkus: []}),
  };
  expect(
    await new JestPurchaseCoordinator(platform, backend as never).subscribe(
      "com.roobsworld.riddlequest.premium.monthly",
      "p1",
    ),
  ).toEqual({
    status: "terminal-failure",
    message: "Subscription entitlement was not active",
  });
});

it("refreshes and verifies an existing subscription after an already-subscribed response", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.beginSubscription = async () => ({status: "unavailable", message: "already_subscribed"});
  platform.getSubscriptions = jest.fn(async () => ({
    status: "success",
    value: {
      subscriptions: [],
      subscriptionsSigned: "subscriptions.refreshed",
    },
  })).mockResolvedValueOnce(inactiveSubscriptionCatalog());
  /** Provides backend behavior. */
  const backend = {
    syncSubscriptions: jest.fn(async (signed: string) => ({verified: true, activeSkus: signed === "catalog.inactive" ? [] : ["premium"], blockedSkus: []})),
  };

  expect(await new JestPurchaseCoordinator(platform, backend as never).subscribe("premium", "p1")).toEqual({
    status: "success",
    value: {activeSku: "premium", blockedSkus: [], premiumCoinsAwarded: 0, recoveredExistingSubscription: true},
  });
  expect(platform.getSubscriptions).toHaveBeenCalledTimes(2);
  expect(backend.syncSubscriptions).toHaveBeenCalledWith("subscriptions.refreshed", "p1");
});

it("passes through product failures and rejects untrusted catalog fields", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  /** Provides coordinator behavior. */
  const coordinator = new JestPurchaseCoordinator(platform, {} as never);
  platform.getProducts = async () => ({status: "unavailable", message: "catalog_offline"});
  await expect(coordinator.getProducts()).resolves.toEqual({status: "unavailable", message: "catalog_offline"});

  platform.getProducts = async () => ({
    status: "success",
    value: [
      {sku: "unknown", name: "Unknown", price: 1, currency: "USD"},
      {sku: "com.roobsworld.riddlequest.coinpack1", name: "", description: "", price: Number.NaN, currency: "USD"},
      {sku: "com.roobsworld.riddlequest.coinpack2", name: "", description: "", price: 1.99, currency: "usd"},
      {sku: "com.roobsworld.riddlequest.coinpack3", name: "", description: "", price: 2.99, currency: "USD"},
    ],
  });

  await expect(coordinator.getProducts("en-US")).resolves.toEqual({
    status: "success",
    value: [
      expect.objectContaining({
        productId: "com.roobsworld.riddlequest.coinpack3",
        name: "Mid Pack",
        description: "A solid boost for a longer session.",
        displayPrice: "$2.99",
      }),
    ],
  });
});

it("rejects unsigned, unverifiable, and malformed subscription catalogs", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => ({status: "retryable-failure", message: "offline"});
  /** Provides coordinator behavior. */
  const coordinator = new JestPurchaseCoordinator(platform, {} as never);
  await expect(coordinator.getSubscriptions("p1")).resolves.toEqual({
    status: "retryable-failure",
    message: "offline",
  });

  platform.getSubscriptions = async () => ({
    status: "success",
    value: {subscriptions: [], subscriptionsSigned: undefined as never},
  });
  await expect(coordinator.getSubscriptions("p1")).resolves.toEqual({
    status: "retryable-failure",
    message: "Jest returned unsigned subscription data",
  });

  platform.getSubscriptions = async () => ({
    status: "success",
    value: {subscriptions: [], subscriptionsSigned: "signed"},
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw "verification unavailable";
      },
    } as never).getSubscriptions("p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "verification unavailable",
  });

  platform.getSubscriptions = async () => ({
    status: "success",
    value: {
      subscriptions: [
        {
          sku: "bad-price",
          displayName: "Bad price",
          displayDescription: null,
          price: Number.POSITIVE_INFINITY,
          currency: "USD",
          billingPeriod: "monthly",
          status: "inactive",
        },
        {
          sku: "bad-currency",
          displayName: "Bad currency",
          displayDescription: null,
          price: 4.99,
          currency: "usd",
          billingPeriod: "monthly",
          status: "inactive",
        },
        {
          sku: "bad-period",
          displayName: "Bad period",
          displayDescription: null,
          price: 4.99,
          currency: "USD",
          billingPeriod: "daily" as never,
          status: "inactive",
        },
      ],
      subscriptionsSigned: "signed",
    },
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => ({verified: true, activeSkus: []}),
    } as never).getSubscriptions("p1"),
  ).resolves.toEqual({status: "success", value: []});
});

it("preserves subscription failures across purchase and recovery paths", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => inactiveSubscriptionCatalog();
  platform.beginSubscription = async () => ({status: "cancelled"});
  await expect(new JestPurchaseCoordinator(platform, {syncSubscriptions: async () => ({verified: true, activeSkus: []})} as never).subscribe("premium", "p1")).resolves.toEqual({
    status: "cancelled",
  });

  platform.beginSubscription = async () => ({status: "unavailable", message: "already_subscribed"});
  platform.getSubscriptions = async () => ({status: "retryable-failure", message: "refresh_failed"});
  await expect(new JestPurchaseCoordinator(platform, {} as never).subscribe("premium", "p1")).resolves.toEqual({
    status: "retryable-failure",
    message: "refresh_failed",
  });

  platform.getSubscriptions = async () => inactiveSubscriptionCatalog();
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => ({verified: true, activeSkus: []}),
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "unavailable",
    message: "already_subscribed",
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw "sync failed";
      },
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "sync failed",
  });

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
      subscriptionSigned: "started",
    },
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw new Error("backend offline");
      },
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "backend offline",
  });
});

it("preserves checkout cancellation and confirmed grants after completion failure", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.beginPurchase = async () => ({status: "cancelled"});
  await expect(new JestPurchaseCoordinator(platform, {} as never).purchase("coins", "p1")).resolves.toEqual({
    status: "cancelled",
  });

  platform.beginPurchase = async () => ({
    status: "success",
    value: {purchase: {purchaseToken: "token", productSku: "coins"}, purchaseSigned: "signed"},
  });
  platform.completePurchase = async () => ({status: "terminal-failure", message: "completion rejected"});
  /** Provides grant purchase behavior. */
  const grantPurchase = async () => ({
    granted: true,
    purchaseToken: "token",
    coinsAwarded: 250,
    newCoins: 500,
    newlyUnlockedAchievementIds: ["first_purchase"],
  });
  await expect(
    new JestPurchaseCoordinator(platform, {grantPurchase} as never).purchase("coins", "p1"),
  ).resolves.toEqual({
    status: "success",
    value: {coinsAwarded: 250, newCoins: 500, newlyUnlockedAchievementIds: ["first_purchase"]},
  });

  platform.completePurchase = async () => ({status: "success", value: undefined});
  await expect(
    new JestPurchaseCoordinator(platform, {grantPurchase} as never).purchase("coins", "p1"),
  ).resolves.toEqual({
    status: "success",
    value: {
      coinsAwarded: 250,
      newCoins: 500,
      newlyUnlockedAchievementIds: ["first_purchase"],
    },
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      grantPurchase: async () => {
        throw "grant failed";
      },
    } as never).purchase("coins", "p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "grant failed",
  });
});

it("stops reconciliation on platform failures and enforces its page limit", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = async () => ({status: "retryable-failure", message: "offline"});
  await expect(new JestPurchaseCoordinator(platform, {} as never).reconcile("p1")).resolves.toEqual({
    status: "retryable-failure",
    message: "offline",
  });

  platform.getIncompletePurchases = async () => ({
    status: "success",
    value: {
      purchases: [{purchaseToken: "token", productSku: "coins"}],
      purchasesSigned: "signed",
      hasMore: false,
    },
  });
  platform.completePurchase = async () => ({status: "terminal-failure", message: "completion rejected"});
  await expect(
    new JestPurchaseCoordinator(platform, {
      grantPurchase: async () => ({granted: true, purchaseToken: "token", coinsAwarded: 250, newCoins: 500}),
    } as never).reconcile("p1"),
  ).resolves.toEqual({
    status: "terminal-failure",
    message: "completion rejected",
  });

  platform.getIncompletePurchases = jest.fn(async () => ({
    status: "success",
    value: {purchases: [], purchasesSigned: "signed", hasMore: true},
  }));
  /** Captures the diagnostic emitted when the provider never finishes pagination. */
  const reported: unknown[] = [];
  configureBrowserErrorReporter((error, context) => {reported.push({error, context});});
  try {
    await expect(new JestPurchaseCoordinator(platform, {} as never).reconcile("p1")).resolves.toEqual({
      status: "terminal-failure",
      message: "Incomplete purchase pagination exceeded safety limit",
    });
    expect(platform.getIncompletePurchases).toHaveBeenCalledTimes(100);
    expect(reported).toEqual([{error: new Error("Incomplete purchase pagination exceeded safety limit"),
      context: {component: "jest_purchases", operation: "reconcile_pagination"}}]);
  } finally {resetBrowserErrorReporterForTests();}
});

it.each(["returned", "thrown", "cancelled"])("presents a durable grant and reconciles its pending confirmation once: %s", async mode => {
  /** Calls distinguish receipt recovery from opening another paid checkout. */
  const calls: string[] = [];
  /** Provider retains the exact purchase until a later confirmation succeeds. */
  const pending = new Set<string>();
  /** Authority ledger grants each provider token only once across coordinator lifetimes. */
  const awarded = new Set<string>();
  /** Wallet represents server state independently of provider confirmation. */
  let balance = 300;
  /** First page cannot confirm the receipt; a later page can recover it. */
  let confirmationFails = true;
  /** Captures the failure that remains observable after returning the confirmed grant. */
  const reported: Array<{
    /** Retained provider reason explains why confirmation remains incomplete. */
    message: string;
    /** Reporting operation distinguishes confirmation from authoritative grant failure. */
    operation: unknown;
  }> = [];
  /** Provider behavior follows its durable incomplete-purchase queue. */
  const platform: JestPlatformPort = new MockJestPlatform();
  platform.beginPurchase = async productSku => {
    calls.push("begin");
    pending.add("recoverable-token");
    return {status: "success", value: {purchase: {purchaseToken: "recoverable-token", productSku}, purchaseSigned: "checkout.signed"}};
  };
  platform.completePurchase = async token => {
    calls.push("complete");
    if (confirmationFails) {
      if (mode === "thrown") throw new Error("SDK completion disconnected");
      return mode === "cancelled" ? {status: "cancelled"} : {status: "retryable-failure", message: "SDK completion rejected"};
    }
    pending.delete(token);
    return {status: "success", value: undefined};
  };
  platform.getIncompletePurchases = async () => {
    calls.push("read-incomplete");
    return {status: "success", value: {purchases: [...pending].map(purchaseToken => ({purchaseToken, productSku: "coins"})),
      purchasesSigned: "recovery.signed", hasMore: false}};
  };
  /** Real coordinator uses an idempotent backend fixture rather than a local economy mutation. */
  const backend = new JestBackendClient("https://example.invalid");
  jest.spyOn(backend, "grantPurchase").mockImplementation(async (_signed, _playerId, purchaseToken) => {
    calls.push("grant");
    if (!awarded.has(purchaseToken)) {awarded.add(purchaseToken); balance += 250;}
    return {granted: true, purchaseToken, coinsAwarded: 250, newCoins: balance, newlyUnlockedAchievementIds: ["first_purchase"]};
  });
  configureBrowserErrorReporter((error, context) => {reported.push({message: error instanceof Error ? error.message : String(error), operation: context?.operation});});
  try {
    await expect(new JestPurchaseCoordinator(platform, backend).purchase("coins", "p1")).resolves.toEqual({status: "success",
      value: {coinsAwarded: 250, newCoins: 550, newlyUnlockedAchievementIds: ["first_purchase"]}});
    expect(balance).toBe(550);
    expect([...pending]).toEqual(["recoverable-token"]);
    expect(calls).toEqual(["begin", "grant", "complete"]);
    expect(reported).toEqual([{message: mode === "thrown" ? "SDK completion disconnected" : mode === "cancelled" ? "cancelled" : "SDK completion rejected",
      operation: "complete_purchase"}]);

    confirmationFails = false;
    await expect(new JestPurchaseCoordinator(platform, backend).reconcile("p1")).resolves.toEqual({status: "success", value: 1});
    expect(balance).toBe(550);
    expect([...awarded]).toEqual(["recoverable-token"]);
    expect([...pending]).toEqual([]);
    expect(calls).toEqual(["begin", "grant", "complete", "read-incomplete", "grant", "complete"]);
  } finally {resetBrowserErrorReporterForTests();}
});

it("keeps an incomplete purchase recoverable when its backend grant throws", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = async () => ({
    status: "success",
    value: {
      purchases: [{purchaseToken: "recoverable-token", productSku: "coins"}],
      purchasesSigned: "signed-recovery-page",
      hasMore: false,
    },
  });
  platform.completePurchase = jest.fn(async () => ({status: "success", value: undefined}));

  await expect(
    new JestPurchaseCoordinator(platform, {
      grantPurchase: async () => {
        throw new Error("backend temporarily unavailable");
      },
    } as never).reconcile("p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "backend temporarily unavailable",
  });
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("normalizes non-Error reconciliation failures", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform();
  platform.getIncompletePurchases = async () => ({
    status: "success",
    value: {
      purchases: [{purchaseToken: "recoverable-token", productSku: "coins"}],
      purchasesSigned: "signed-recovery-page",
      hasMore: false,
    },
  });
  platform.completePurchase = jest.fn(async () => ({status: "success", value: undefined}));

  await expect(
    new JestPurchaseCoordinator(platform, {
      grantPurchase: async () => {
        throw "backend temporarily unavailable";
      },
    } as never).reconcile("p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "backend temporarily unavailable",
  });
  expect(platform.completePurchase).not.toHaveBeenCalled();
});

it("normalizes verifier errors and omitted blocked subscription lists", async () => {
  /** Provides platform behavior. */
  const platform = new MockJestPlatform(true);
  platform.getSubscriptions = async () => ({
    status: "success",
    value: {subscriptions: [], subscriptionsSigned: "catalog"},
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw new Error("catalog verification failed");
      },
    } as never).getSubscriptions("p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "catalog verification failed",
  });

  platform.getSubscriptions = jest.fn(async () => ({
    status: "success" as const,
    value: {subscriptions: [], subscriptionsSigned: "catalog.active"},
  })).mockResolvedValueOnce(inactiveSubscriptionCatalog());
  platform.beginSubscription = async () => ({status: "unavailable", message: "already_subscribed"});
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async (signed: string) => ({verified: true, activeSkus: signed === "catalog.inactive" ? [] : ["premium"]}),
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "success",
    value: {activeSku: "premium", blockedSkus: [], premiumCoinsAwarded: 0, recoveredExistingSubscription: true},
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw new Error("refresh verification failed");
      },
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "refresh verification failed",
  });

  platform.getSubscriptions = async () => inactiveSubscriptionCatalog();
  platform.beginSubscription = new MockJestPlatform(true).beginSubscription;
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async (signed: string) => ({verified: true, activeSkus: signed === "catalog.inactive" ? [] : ["premium"]}),
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "success",
    value: {activeSku: "premium", blockedSkus: [], premiumCoinsAwarded: 0},
  });
  await expect(
    new JestPurchaseCoordinator(platform, {
      syncSubscriptions: async () => {
        throw "subscription verification failed";
      },
    } as never).subscribe("premium", "p1"),
  ).resolves.toEqual({
    status: "retryable-failure",
    message: "subscription verification failed",
  });
});

it.each([new Error("browser checkout lock unavailable"), "browser checkout lock unavailable"])(
  "normalizes checkout lock failures and releases its pending guard: %p", async error => {
    /** Browser lock rejection controlled by this failure scenario. */
    const lock = jest.spyOn(navigator.locks, "request").mockRejectedValueOnce(error);
    try {
      /** Real purchase coordinator retaining its local pending guard. */
      const coordinator = new JestPurchaseCoordinator(new MockJestPlatform(true), new JestBackendClient("https://example.invalid"));
      await expect(coordinator.subscribe("premium", "p1")).resolves.toEqual({
        status: "retryable-failure", message: "browser checkout lock unavailable",
      });
      lock.mockRejectedValueOnce(new Error("second checkout reaches the browser lock"));
      await expect(coordinator.subscribe("premium", "p1")).resolves.toEqual({
        status: "retryable-failure", message: "second checkout reaches the browser lock",
      });
      expect(lock).toHaveBeenCalledTimes(2);
    } finally {
      lock.mockRestore();
    }
  },
);

it("opens only one provider preflight for simultaneous subscription requests", async () => {
  /** Controlled provider port used by the checkout scenario. */
  const platform: JestPlatformPort = new MockJestPlatform(true);
  /** Provider preflight spy counting actual catalog requests. */
  const catalog = jest.spyOn(platform, "getSubscriptions").mockResolvedValue({status: "cancelled"});
  /** Real purchase coordinator retaining its local pending guard. */
  const coordinator = new JestPurchaseCoordinator(platform, new JestBackendClient("https://example.invalid"));
  /** First subscription request retained while a second request competes. */
  const first = coordinator.subscribe("premium", "p1");
  await expect(coordinator.subscribe("premium", "p1")).resolves.toEqual({status: "cancelled"});
  await expect(first).resolves.toEqual({status: "cancelled"});
  expect(catalog).toHaveBeenCalledTimes(1);
  await expect(coordinator.subscribe("premium", "p1")).resolves.toEqual({status: "cancelled"});
  expect(catalog).toHaveBeenCalledTimes(2);
});

it("preserves the provider sandbox marker alongside an authoritative consumable grant", async () => {
  /** Controlled provider port used by the checkout scenario. */
  const platform: JestPlatformPort = new MockJestPlatform(true);
  platform.beginPurchase = async productSku => ({status: "success", value: {
    purchase: {purchaseToken: "sandbox-receipt", productSku, sandbox: true}, purchaseSigned: "sandbox.signed",
  }});
  /** Provider confirmation spy for the sandbox receipt. */
  const complete = jest.spyOn(platform, "completePurchase").mockResolvedValue({status: "success", value: undefined});
  /** Backend client whose grant boundary is controlled locally. */
  const backend = new JestBackendClient("https://example.invalid");
  /** Authoritative grant fixture for the signed sandbox receipt. */
  const grant = jest.spyOn(backend, "grantPurchase").mockResolvedValue({
    granted: true, purchaseToken: "sandbox-receipt", coinsAwarded: 250, newCoins: 550,
  });
  await expect(new JestPurchaseCoordinator(platform, backend).purchase("coins", "p1")).resolves.toEqual({
    status: "success", value: {coinsAwarded: 250, newCoins: 550, newlyUnlockedAchievementIds: undefined, sandbox: true},
  });
  expect(grant).toHaveBeenCalledWith("sandbox.signed", "p1", "sandbox-receipt");
  expect(complete).toHaveBeenCalledWith("sandbox-receipt");
});
