import {
  facebookCommerceReceiptId,
  grantVerifiedFacebookPurchase,
  refundVerifiedFacebookPurchase,
} from "../facebook/facebookCommerceLedger";
import {FACEBOOK_PRODUCTS} from "@riddle-quest/core/pricing/facebookCatalog";

/** Describes stored. */
type Stored = Record<string, unknown>;
/** Provides uid behavior. */
const uid = `facebook_${"a".repeat(40)}`;
/** Provides coin pack behavior. */
const coinPack = "com.roobsworld.riddlequest.coinpack1";
/** Provides durable behavior. */
const durable = "com.roobsworld.riddlequest.remove_interstitial_ads";

/** Provides database behavior. */
const database = (seed: Record<string, Stored>) => {
  /** Provides documents behavior. */
  const documents = new Map(Object.entries(seed));
  /** Provides ref behavior. */
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
  });
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async (reference: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => ({
        exists: documents.has(reference.path),
        data: () => documents.get(reference.path),
      }),
    ),
    update: jest.fn(
      (
        reference: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        documents.set(reference.path, {...documents.get(reference.path), ...value});
      },
    ),
    set: jest.fn(
      (
        reference: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        documents.set(reference.path, {...documents.get(reference.path), ...value});
      },
    ),
    create: jest.fn(
      (
        reference: {
          /** Stores path. */
          path: string;
        },
        value: Stored,
      ) => {
        if (documents.has(reference.path)) throw new Error("already-exists");
        documents.set(reference.path, value);
      },
    ),
  };
  /** Provides db behavior. */
  const db = {
    collection: (collection: string) => ({doc: (id: string) => ref(`${collection}/${id}`)}),
    runTransaction: async <T>(operation: (value: typeof transaction) => Promise<T>) => operation(transaction),
  };
  return {db: db as never, documents, transaction};
};

/** Provides purchase behavior. */
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
  /** Provides previous behavior. */
  const previous = process.env.FACEBOOK_DISABLED_FEATURES;
  process.env.FACEBOOK_DISABLED_FEATURES = "commerce";
  try {
    /** Provides fixture behavior. */
    const fixture = database({[`users/${uid}`]: {coins: 300}});
    await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).rejects.toThrow("facebook-commerce-disabled");
    await expect(
      refundVerifiedFacebookPurchase(fixture.db, {
        eventId: "disabled-refund",
        paymentId: `payment-${coinPack}`,
        productId: coinPack,
        refundedAtMs: 1_700_000_000_001,
      }),
    ).rejects.toThrow("facebook-commerce-disabled");
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
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).resolves.toEqual({
    alreadyProcessed: false,
    coins: 550,
    coinDebt: 0,
    removeInterstitialAds: false,
  });
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).resolves.toEqual({
    alreadyProcessed: true,
    coins: 550,
    coinDebt: 0,
    removeInterstitialAds: false,
  });
  expect(fixture.documents.get(`users/${uid}`)?.coins).toBe(550);
  expect(JSON.stringify([...fixture.documents])).not.toContain("provider-token-never-stored-raw");
  expect(JSON.stringify([...fixture.documents])).not.toContain(`payment-${coinPack}`);
});

it("applies available coins first on refund and records hidden debt exactly once", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 25}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  fixture.documents.set(`users/${uid}`, {coins: 40});
  /** Provides refund behavior. */
  const refund = {
    eventId: "refund-1",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: false,
    coins: 0,
    coinsRemoved: 40,
    coinDebt: 210,
  });
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: true,
    coins: 0,
    coinsRemoved: 0,
    coinDebt: 210,
  });
});

it("repays refund debt from future coin grants before exposing a balance", async () => {
  /** Provides fixture behavior. */
  const fixture = database({
    [`users/${uid}`]: {coins: 0},
    [`facebookCommerceAccounts/${uid}`]: {coinDebt: 210, removeInterstitialAds: false},
  });
  await expect(
    grantVerifiedFacebookPurchase(fixture.db, {...purchase(), paymentId: "next-payment"}),
  ).resolves.toMatchObject({coins: 40, coinDebt: 0});
});

it("restores and revokes the durable ad-free entitlement without changing coins", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase(durable))).resolves.toMatchObject({
    coins: 300,
    removeInterstitialAds: true,
  });
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "durable-refund",
      paymentId: `payment-${durable}`,
      productId: durable,
      refundedAtMs: 1_700_000_000_001,
    }),
  ).resolves.toMatchObject({coins: 300, coinDebt: 0, removeInterstitialAds: false});
});

it.each(
  Object.values(FACEBOOK_PRODUCTS).map(
    (product) => [product.productId, product.coins, product.entitlement === "remove_interstitial_ads"] as const,
  ),
)("grants and fully refunds the exact server catalog product %s", async (productId, grossCoins, grantsAdFree) => {
  /** Provides initial coins behavior. */
  const initialCoins = 300;
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: initialCoins}});
  /** Provides verified purchase behavior. */
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
  /** Provides verified refund behavior. */
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
});

it.each(
  Object.values(FACEBOOK_PRODUCTS)
    .filter((product) => product.kind === "consumable")
    .map((product) => [product.productId, product.coins] as const),
)("records and repays exact partial-spend debt for %s", async (productId, grossCoins) => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 0}});
  /** Provides first purchase behavior. */
  const firstPurchase = {
    ...purchase(productId),
    paymentId: `partial-payment-${productId}`,
    purchaseToken: `partial-token-${productId}`,
  };
  await grantVerifiedFacebookPurchase(fixture.db, firstPurchase);
  /** Provides remaining coins behavior. */
  const remainingCoins = Math.floor(grossCoins / 3);
  /** Provides expected debt behavior. */
  const expectedDebt = grossCoins - remainingCoins;
  fixture.documents.set(`users/${uid}`, {coins: remainingCoins});
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: `partial-refund-${productId}`,
      paymentId: firstPurchase.paymentId,
      productId,
      refundedAtMs: firstPurchase.purchasedAtMs + 1,
    }),
  ).resolves.toMatchObject({
    coins: 0,
    coinsRemoved: remainingCoins,
    coinDebt: expectedDebt,
  });

  await expect(
    grantVerifiedFacebookPurchase(fixture.db, {
      ...firstPurchase,
      paymentId: `repayment-payment-${productId}`,
      purchaseToken: `repayment-token-${productId}`,
      purchasedAtMs: firstPurchase.purchasedAtMs + 2,
    }),
  ).resolves.toMatchObject({
    coins: remainingCoins,
    coinDebt: 0,
  });
});

it("rejects missing users, invalid UIDs, and receipt/product conflicts", async () => {
  await expect(grantVerifiedFacebookPurchase(database({}).db, purchase())).rejects.toThrow("facebook-user-not-found");
  await expect(grantVerifiedFacebookPurchase(database({}).db, {...purchase(), uid: "jest_bad"})).rejects.toThrow(
    "invalid-facebook-uid",
  );
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  await expect(grantVerifiedFacebookPurchase(fixture.db, {...purchase(), productId: durable})).rejects.toThrow(
    "facebook-purchase-receipt-conflict",
  );
  await expect(
    grantVerifiedFacebookPurchase(fixture.db, {...purchase(), purchaseToken: "different-token"}),
  ).rejects.toThrow("facebook-purchase-receipt-conflict");
});

it("rejects corrupted purchase accounting and cross-purchase refund event replay", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  /** Provides purchase path behavior. */
  const purchasePath = `facebookCommerceReceipts/${facebookCommerceReceiptId("purchase", `payment-${coinPack}`)}`;
  /** Provides valid receipt behavior. */
  const validReceipt = fixture.documents.get(purchasePath)!;
  fixture.documents.set(purchasePath, {...validReceipt, grossCoins: 1});
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "refund-corrupt",
      paymentId: `payment-${coinPack}`,
      productId: coinPack,
      refundedAtMs: 1_700_000_000_001,
    }),
  ).rejects.toThrow("facebook-refund-receipt-mismatch");

  fixture.documents.set(purchasePath, validReceipt);
  /** Provides refund id behavior. */
  const refundId = facebookCommerceReceiptId("refund", "refund-conflict");
  fixture.documents.set(`facebookCommerceRefunds/${refundId}`, {
    provider: "facebook",
    uid,
    productId: durable,
    purchaseReceiptId: "some-other-purchase",
  });
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "refund-conflict",
      paymentId: `payment-${coinPack}`,
      productId: coinPack,
      refundedAtMs: 1_700_000_000_001,
    }),
  ).rejects.toThrow("facebook-refund-event-conflict");
});

it("fails closed for malformed balances, debt, receipt arithmetic, and overflow", async () => {
  await expect(
    grantVerifiedFacebookPurchase(database({[`users/${uid}`]: {coins: "300"}}).db, purchase()),
  ).rejects.toThrow("invalid-facebook-commerce-coins");
  await expect(
    grantVerifiedFacebookPurchase(
      database({
        [`users/${uid}`]: {coins: 300},
        [`facebookCommerceAccounts/${uid}`]: {coinDebt: -1, removeInterstitialAds: false},
      }).db,
      purchase(),
    ),
  ).rejects.toThrow("invalid-facebook-commerce-coin-debt");
  await expect(
    grantVerifiedFacebookPurchase(database({[`users/${uid}`]: {coins: Number.MAX_SAFE_INTEGER}}).db, purchase()),
  ).rejects.toThrow("invalid-facebook-commerce-coin-balance");

  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  /** Provides receipt path behavior. */
  const receiptPath = `facebookCommerceReceipts/${facebookCommerceReceiptId("purchase", `payment-${coinPack}`)}`;
  /** Provides receipt behavior. */
  const receipt = fixture.documents.get(receiptPath)!;
  fixture.documents.set(receiptPath, {...receipt, coinsGranted: 249});
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).rejects.toThrow(
    "facebook-purchase-receipt-conflict",
  );
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "bad-accounting-refund",
      paymentId: `payment-${coinPack}`,
      productId: coinPack,
      refundedAtMs: 4,
    }),
  ).rejects.toThrow("facebook-refund-receipt-mismatch");

  fixture.documents.set(receiptPath, receipt);
  await expect(
    grantVerifiedFacebookPurchase(fixture.db, {...purchase(), purchasedAtMs: 1_700_000_000_001}),
  ).rejects.toThrow("facebook-purchase-receipt-conflict");
});

it("binds every refund event to one purchase even when the economic refund was already applied", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  /** Provides first behavior. */
  const first = {
    eventId: "refund-primary",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await refundVerifiedFacebookPurchase(fixture.db, first);
  /** Provides alias behavior. */
  const alias = {...first, eventId: "refund-alias", refundedAtMs: 1_700_000_000_002};
  await expect(refundVerifiedFacebookPurchase(fixture.db, alias)).resolves.toMatchObject({
    alreadyProcessed: true,
    coinsRemoved: 0,
  });
  expect(
    fixture.documents.get(`facebookCommerceRefunds/${facebookCommerceReceiptId("refund", alias.eventId)}`),
  ).toMatchObject({
    purchaseReceiptId: facebookCommerceReceiptId("purchase", first.paymentId),
    alreadyApplied: true,
  });

  await grantVerifiedFacebookPurchase(fixture.db, {...purchase(), paymentId: "second-payment"});
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      ...alias,
      paymentId: "second-payment",
    }),
  ).rejects.toThrow("facebook-refund-event-conflict");
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {...alias, refundedAtMs: alias.refundedAtMs + 1}),
  ).rejects.toThrow("facebook-refund-event-conflict");
});

it("fails closed on corrupted primary or alias refund replay accounting", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  /** Provides refund behavior. */
  const refund = {
    eventId: "refund-accounting",
    paymentId: `payment-${coinPack}`,
    productId: coinPack,
    refundedAtMs: 1_700_000_000_001,
  };
  await refundVerifiedFacebookPurchase(fixture.db, refund);
  /** Provides refund path behavior. */
  const refundPath = `facebookCommerceRefunds/${facebookCommerceReceiptId("refund", refund.eventId)}`;
  /** Provides valid refund behavior. */
  const validRefund = fixture.documents.get(refundPath)!;
  fixture.documents.set(refundPath, {...validRefund, coinsRemoved: 249});
  await expect(refundVerifiedFacebookPurchase(fixture.db, refund)).rejects.toThrow("facebook-refund-event-conflict");

  fixture.documents.set(refundPath, validRefund);
  /** Provides purchase path behavior. */
  const purchasePath = `facebookCommerceReceipts/${facebookCommerceReceiptId("purchase", refund.paymentId)}`;
  /** Provides valid purchase behavior. */
  const validPurchase = fixture.documents.get(purchasePath)!;
  fixture.documents.set(purchasePath, {...validPurchase, refundedAtMs: 1_699_999_999_999});
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {...refund, eventId: "refund-alias-corrupt"}),
  ).rejects.toThrow("facebook-refund-receipt-mismatch");
});

it("rejects a refund timestamp before the verified purchase", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${uid}`]: {coins: 300}});
  await grantVerifiedFacebookPurchase(fixture.db, purchase());
  await expect(
    refundVerifiedFacebookPurchase(fixture.db, {
      eventId: "refund-before-purchase",
      paymentId: `payment-${coinPack}`,
      productId: coinPack,
      refundedAtMs: 1_699_999_999_999,
    }),
  ).rejects.toThrow("facebook-refund-receipt-mismatch");
});

it("fails closed when account deletion has committed before a grant", async () => {
  /** Provides fixture behavior. */
  const fixture = database({
    [`users/${uid}`]: {coins: 300},
    [`jestAccountDeletionTombstones/${uid}`]: {recreationBlocked: true},
  });
  await expect(grantVerifiedFacebookPurchase(fixture.db, purchase())).rejects.toThrow("account-deleted");
  expect(fixture.documents.get(`users/${uid}`)?.coins).toBe(300);
});

it("acknowledges a post-deletion refund with identity-free replay tombstones only", async () => {
  /** Provides payment id behavior. */
  const paymentId = `payment-${coinPack}`;
  /** Provides purchase receipt id behavior. */
  const purchaseReceiptId = facebookCommerceReceiptId("purchase", paymentId);
  /** Provides fixture behavior. */
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
  /** Provides refund behavior. */
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
  /** Stores d. */
  const stored = JSON.stringify([...fixture.documents]);
  expect(stored).not.toContain(uid);
  expect(stored).not.toContain(paymentId);
  expect(
    fixture.documents.get(`facebookCommerceRefunds/${facebookCommerceReceiptId("refund", "deleted-refund")}`),
  ).toEqual({
    provider: "facebook",
    replayProtection: true,
    productId: coinPack,
    purchaseReceiptId,
    refundedAtMs: 4,
  });
});
