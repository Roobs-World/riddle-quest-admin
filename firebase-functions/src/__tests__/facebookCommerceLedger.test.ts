import {
  facebookCommerceReceiptId,
  grantVerifiedFacebookPurchase,
  refundVerifiedFacebookPurchase,
} from "../facebook/facebookCommerceLedger";
import {FACEBOOK_PRODUCTS} from "../facebook/facebookProductCatalog";

type Stored = Record<string, unknown>;
const uid = `facebook_${"a".repeat(40)}`;
const coinPack = "com.roobsworld.riddlequest.coinpack1";
const durable = "com.roobsworld.riddlequest.remove_interstitial_ads";

const database = (seed: Record<string, Stored>) => {
  const documents = new Map(Object.entries(seed));
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
  });
  const transaction = {
    get: jest.fn(async (reference: {path: string}) => ({
      exists: documents.has(reference.path),
      data: () => documents.get(reference.path),
    })),
    update: jest.fn((reference: {path: string}, value: Stored) => {
      documents.set(reference.path, {...documents.get(reference.path), ...value});
    }),
    set: jest.fn((reference: {path: string}, value: Stored) => {
      documents.set(reference.path, {...documents.get(reference.path), ...value});
    }),
    create: jest.fn((reference: {path: string}, value: Stored) => {
      if (documents.has(reference.path)) throw new Error("already-exists");
      documents.set(reference.path, value);
    }),
  };
  const db = {
    collection: (collection: string) => ({doc: (id: string) => ref(`${collection}/${id}`)}),
    runTransaction: async <T>(operation: (value: typeof transaction) => Promise<T>) => operation(transaction),
  };
  return {db: db as never, documents, transaction};
};

const purchase = (productId = coinPack) => ({
  uid,
  paymentId: `payment-${productId}`,
  productId,
  purchaseToken: "provider-token-never-stored-raw",
  purchasedAtMs: 1_700_000_000_000,
});

it("namespaces opaque purchase and refund receipts and rejects unbounded IDs", () => {
  expect(facebookCommerceReceiptId("purchase", "same")).not.toBe(facebookCommerceReceiptId("refund", "same"));
  expect(facebookCommerceReceiptId("purchase", "same")).toMatch(/^[0-9a-f]{64}$/);
  expect(() => facebookCommerceReceiptId("purchase", "x".repeat(1_025))).toThrow("invalid-purchase-id");
});

it("fails closed before any grant or refund read when commerce is disabled", async () => {
  const previous = process.env.FACEBOOK_DISABLED_FEATURES;
  process.env.FACEBOOK_DISABLED_FEATURES = "commerce";
  try {
    const fixture = database({[`users/${uid}`]: {coins: 300}});
    await expect(grantVerifiedFacebookPurchase(fixture.db, purchase()))
      .rejects.toThrow("facebook-commerce-disabled");
    await expect(refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "disabled-refund",
      paymentId: `payment-${coinPack}`,
      productId: coinPack,
      refundedAtMs: 1_700_000_000_001,
    })).rejects.toThrow("facebook-commerce-disabled");
    expect(fixture.transaction.get).not.toHaveBeenCalled();
    expect(fixture.transaction.create).not.toHaveBeenCalled();
    expect(fixture.transaction.update).not.toHaveBeenCalled();
    expect(fixture.transaction.set).not.toHaveBeenCalled();
    expect(fixture.documents.get(`users/${uid}`)).toEqual({coins: 300});
  } finally {
    if (previous === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
    else process.env.FACEBOOK_DISABLED_FEATURES = previous;
  }
});

it("grants once before consumption and never stores a raw payment ID or token", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).resolves.toEqual({
    alreadyProcessed: false, coins: 550, coinDebt: 0, removeInterstitialAds: false,
  });
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).resolves.toEqual({
    alreadyProcessed: true, coins: 550, coinDebt: 0, removeInterstitialAds: false,
  });
  expect(fixture.documents.get(`users/${uid}`)?.coins).toBe(550);
  expect(JSON.stringify([...fixture.documents])).not.toContain("provider-token-never-stored-raw");
  expect(JSON.stringify([...fixture.documents])).not.toContain(`payment-${coinPack}`);
});

it("applies available coins first on refund and records hidden debt exactly once", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 25}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  fixture.documents.set(`users/${uid}`, {coins: 40});
  const refund = {
    eventId: "refund-1",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: false, coins: 0, coinsRemoved: 40, coinDebt: 210,
  });
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: true, coins: 0, coinsRemoved: 0, coinDebt: 210,
  });
});

it("repays refund debt from future coin grants before exposing a balance", async () => {
  const fixture = database({
    [`users/${uid}`]: {coins: 0},
    [`facebookCommerceAccounts/${uid}`]: {coinDebt: 210, removeInterstitialAds: false},
  });
  await expect(grantVerifiedFacebookPurchase(fixture.db, {...purchase(), paymentId: "next-payment"}))
    .resolves.toMatchObject({coins: 40, coinDebt: 0});
});

it("restores and revokes the durable ad-free entitlement without changing coins", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase(durable)))
    .resolves.toMatchObject({coins: 300, removeInterstitialAds: true});
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    eventId: "durable-refund",
    paymentId: `payment-${durable}`,
    productId: durable,
    refundedAtMs: 1_700_000_000_001,
  })).resolves.toMatchObject({coins: 300, coinDebt: 0, removeInterstitialAds: false});
});

it.each(Object.values(FACEBOOK_PRODUCTS).map((product) => [
  product.productId,
  product.coins,
  product.entitlement === "remove_interstitial_ads",
] as const))(
  "grants and fully refunds the exact server catalog product %s",
  async (productId, grossCoins, grantsAdFree) => {
    const initialCoins = 300;
    const fixture = database({[`users/${uid}`]: {coins: initialCoins}});
    const verifiedPurchase = {
      ...purchase(productId),
      paymentId: `all-products-payment-${productId}`,
      purchaseToken: `all-products-token-${productId}`,
    };
    await expect(grantVerifiedFacebookPurchase(fixture.db, verifiedPurchase)).resolves.toEqual({
      alreadyProcessed: false,
      coins: initialCoins + grossCoins,
      coinDebt: 0,
      removeInterstitialAds: grantsAdFree,
    });
    await expect(grantVerifiedFacebookPurchase(fixture.db, verifiedPurchase)).resolves.toEqual({
      alreadyProcessed: true,
      coins: initialCoins + grossCoins,
      coinDebt: 0,
      removeInterstitialAds: grantsAdFree,
    });
    const verifiedRefund = {
      eventId: `all-products-refund-${productId}`,
      paymentId: verifiedPurchase.paymentId,
      productId,
      refundedAtMs: verifiedPurchase.purchasedAtMs + 1,
    };
    await expect(refundVerifiedFacebookPurchase(fixture.db, verifiedRefund)).resolves.toMatchObject({
      alreadyProcessed: false,
      coins: initialCoins,
      coinsRemoved: grossCoins,
      coinDebt: 0,
      removeInterstitialAds: false,
      accountDeleted: false,
    });
    await expect(refundVerifiedFacebookPurchase(fixture.db, verifiedRefund)).resolves.toMatchObject({
      alreadyProcessed: true,
      coins: initialCoins,
      coinsRemoved: 0,
      coinDebt: 0,
      removeInterstitialAds: false,
      accountDeleted: false,
    });
  },
);

it.each(Object.values(FACEBOOK_PRODUCTS)
  .filter((product) => product.kind === "consumable")
  .map((product) => [product.productId, product.coins] as const))(
  "records and repays exact partial-spend debt for %s",
  async (productId, grossCoins) => {
    const fixture = database({[`users/${uid}`]: {coins: 0}});
    const firstPurchase = {
      ...purchase(productId),
      paymentId: `partial-payment-${productId}`,
      purchaseToken: `partial-token-${productId}`,
    };
    await grantVerifiedFacebookPurchase(fixture.db, firstPurchase);
    const remainingCoins = Math.floor(grossCoins / 3);
    const expectedDebt = grossCoins - remainingCoins;
    fixture.documents.set(`users/${uid}`, {coins: remainingCoins});
    await expect(refundVerifiedFacebookPurchase(fixture.db, {
      eventId: `partial-refund-${productId}`,
      paymentId: firstPurchase.paymentId,
      productId,
      refundedAtMs: firstPurchase.purchasedAtMs + 1,
    })).resolves.toMatchObject({
      coins: 0,
      coinsRemoved: remainingCoins,
      coinDebt: expectedDebt,
    });

    await expect(grantVerifiedFacebookPurchase(fixture.db, {
      ...firstPurchase,
      paymentId: `repayment-payment-${productId}`,
      purchaseToken: `repayment-token-${productId}`,
      purchasedAtMs: firstPurchase.purchasedAtMs + 2,
    })).resolves.toMatchObject({
      coins: remainingCoins,
      coinDebt: 0,
    });
  },
);

it("rejects missing users, invalid UIDs, and receipt/product conflicts", async () => {
  await expect(grantVerifiedFacebookPurchase(database({}).db, purchase())).rejects.toThrow("facebook-user-not-found");
  await expect(grantVerifiedFacebookPurchase(database({}).db, {...purchase(), uid: "jest_bad"}))
    .rejects.toThrow("invalid-facebook-uid");
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  await expect(grantVerifiedFacebookPurchase(fixture.db, {...purchase(), productId: durable}))
    .rejects.toThrow("facebook-purchase-receipt-conflict");
  await expect(grantVerifiedFacebookPurchase(fixture.db, {...purchase(), purchaseToken: "different-token"}))
    .rejects.toThrow("facebook-purchase-receipt-conflict");
});

it("rejects corrupted purchase accounting and cross-purchase refund event replay", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  const purchasePath = `facebookCommerceReceipts/${facebookCommerceReceiptId("purchase", `payment-${coinPack}`)}`;
  const validReceipt = fixture.documents.get(purchasePath)!;
  fixture.documents.set(purchasePath, {...validReceipt, grossCoins: 1});
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    eventId: "refund-corrupt",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  })).rejects.toThrow("facebook-refund-receipt-mismatch");

  fixture.documents.set(purchasePath, validReceipt);
  const refundId = facebookCommerceReceiptId("refund", "refund-conflict");
  fixture.documents.set(`facebookCommerceRefunds/${refundId}`, {
    provider: "facebook",
    uid,
    productId: durable,
    purchaseReceiptId: "some-other-purchase",
  });
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    eventId: "refund-conflict",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  })).rejects.toThrow("facebook-refund-event-conflict");
});

it("fails closed for malformed balances, debt, receipt arithmetic, and overflow", async () => {
  await expect(grantVerifiedFacebookPurchase(
    database({[`users/${uid}`]: {coins: "300"}}).db,
    purchase(),
  )).rejects.toThrow("invalid-facebook-commerce-coins");
  await expect(grantVerifiedFacebookPurchase(
    database({
      [`users/${uid}`]: {coins: 300},
      [`facebookCommerceAccounts/${uid}`]: {coinDebt: -1, removeInterstitialAds: false},
    }).db,
    purchase(),
  )).rejects.toThrow("invalid-facebook-commerce-coin-debt");
  await expect(grantVerifiedFacebookPurchase(
    database({[`users/${uid}`]: {coins: Number.MAX_SAFE_INTEGER}}).db,
    purchase(),
  )).rejects.toThrow("invalid-facebook-commerce-coin-balance");

  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  const receiptPath = `facebookCommerceReceipts/${facebookCommerceReceiptId(
    "purchase", `payment-${coinPack}`,
  )}`;
  const receipt = fixture.documents.get(receiptPath)!;
  fixture.documents.set(receiptPath, {...receipt, coinsGranted: 249});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase()))
    .rejects.toThrow("facebook-purchase-receipt-conflict");
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    eventId: "bad-accounting-refund",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 4,
  })).rejects.toThrow("facebook-refund-receipt-mismatch");

  fixture.documents.set(receiptPath, receipt);
  await expect(grantVerifiedFacebookPurchase(fixture.db, {...purchase(), purchasedAtMs: 1_700_000_000_001}))
    .rejects.toThrow("facebook-purchase-receipt-conflict");
});

it("binds every refund event to one purchase even when the economic refund was already applied", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  const first = {
    eventId: "refund-primary",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await refundVerifiedFacebookPurchase(fixture.db, first);
  const alias = {...first, eventId: "refund-alias", refundedAtMs: 1_700_000_000_002};
  await expect(refundVerifiedFacebookPurchase(fixture.db, alias)).resolves.toMatchObject({
    alreadyProcessed: true,
    coinsRemoved: 0,
  });
  expect(fixture.documents.get(
    `facebookCommerceRefunds/${facebookCommerceReceiptId("refund", alias.eventId)}`,
  )).toMatchObject({
    purchaseReceiptId: facebookCommerceReceiptId("purchase", first.paymentId),
    alreadyApplied: true,
  });

  await grantVerifiedFacebookPurchase(fixture.db, {...purchase(), paymentId: "second-payment"});
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    ...alias,
    paymentId: "second-payment",
  })).rejects.toThrow("facebook-refund-event-conflict");
  await expect(refundVerifiedFacebookPurchase(fixture.db, {...alias, refundedAtMs: alias.refundedAtMs + 1}))
    .rejects.toThrow("facebook-refund-event-conflict");
});

it("fails closed on corrupted primary or alias refund replay accounting", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  const refund = {
    eventId: "refund-accounting",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await refundVerifiedFacebookPurchase(fixture.db, refund);
  const refundPath = `facebookCommerceRefunds/${facebookCommerceReceiptId("refund", refund.eventId)}`;
  const validRefund = fixture.documents.get(refundPath)!;
  fixture.documents.set(refundPath, {...validRefund, coinsRemoved: 249});
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund))
    .rejects.toThrow("facebook-refund-event-conflict");

  fixture.documents.set(refundPath, validRefund);
  const purchasePath = `facebookCommerceReceipts/${facebookCommerceReceiptId("purchase", refund.paymentId)}`;
  const validPurchase = fixture.documents.get(purchasePath)!;
  fixture.documents.set(purchasePath, {...validPurchase, refundedAtMs: 1_699_999_999_999});
  await expect(refundVerifiedFacebookPurchase(fixture.db, {...refund, eventId: "refund-alias-corrupt"}))
    .rejects.toThrow("facebook-refund-receipt-mismatch");
});

it("rejects a refund timestamp before the verified purchase", async () => {
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  await expect(refundVerifiedFacebookPurchase(fixture.db, {
    eventId: "refund-before-purchase",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_699_999_999_999,
  })).rejects.toThrow("facebook-refund-receipt-mismatch");
});

it("fails closed when account deletion has committed before a grant", async () => {
  const fixture = database({
    [`users/${uid}`]: {coins: 300},
    [`jestAccountDeletionTombstones/${uid}`]: {recreationBlocked: true},
  });
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).rejects.toThrow("account-deleted");
  expect(fixture.documents.get(`users/${uid}`)?.coins).toBe(300);
});

it("acknowledges a post-deletion refund with identity-free replay tombstones only", async () => {
  const paymentId = `payment-${coinPack}`;
  const purchaseReceiptId = facebookCommerceReceiptId("purchase", paymentId);
  const fixture = database({
    [`facebookCommerceReceipts/${purchaseReceiptId}`]: {
      provider: "facebook",
      replayProtection: true,
      productId: coinPack,
      paymentIdHash: purchaseReceiptId,
      purchaseTokenHash: "a".repeat(64),
      refundedAtMs: null,
    },
  });
  const refund = {eventId: "deleted-refund", paymentId, productId: coinPack, refundedAtMs: 4};
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: false,
    uid: null,
    coins: 0,
    coinsRemoved: 0,
    coinDebt: 0,
    removeInterstitialAds: false,
    accountDeleted: true,
  });
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: true,
    accountDeleted: true,
  });
  const stored = JSON.stringify([...fixture.documents]);
  expect(stored).not.toContain(uid);
  expect(stored).not.toContain(paymentId);
  expect(fixture.documents.get(`facebookCommerceRefunds/${facebookCommerceReceiptId("refund", "deleted-refund")}`))
    .toEqual({
      provider: "facebook",
      replayProtection: true,
      productId: coinPack,
      purchaseReceiptId,
      refundedAtMs: 4,
    });
});
