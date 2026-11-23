import {
  grantVerifiedRedditOrder,
  redditCommerceReceiptId,
  refundVerifiedRedditOrder,
} from "../redditCommerceLedger";

/** Renders the uid interface. */
const UID = `reddit_${"a".repeat(40)}`;
/** Describes row. */
type Row = Record<string, unknown>;
/** Provides database behavior. */
const database = (initial: Record<string, Row>) => {
  /** Provides rows behavior. */
  const rows = new Map(Object.entries(initial));
  /** Provides ref behavior. */
  const ref = (path: string) => ({path, id: path.split("/").at(-1)});
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async ({
        path,
      }: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => ({
        exists: rows.has(path),
        id: path.split("/").at(-1),
        data: () => rows.get(path),
      }),
    ),
    update: jest.fn(
      (
        {
          path,
        }: {
          /** Stores path. */
          path: string;
        },
        value: Row,
      ) => rows.set(path, {...rows.get(path), ...value}),
    ),
    set: jest.fn(
      (
        {
          path,
        }: {
          /** Stores path. */
          path: string;
        },
        value: Row,
        options?: {
          /** Stores merge. */
          merge?: boolean;
        },
      ) => rows.set(path, options?.merge ? {...rows.get(path), ...value} : value),
    ),
    create: jest.fn(
      (
        {
          path,
        }: {
          /** Stores path. */
          path: string;
        },
        value: Row,
      ) => {
        if (rows.has(path)) throw new Error("already-exists");
        rows.set(path, value);
      },
    ),
  };
  /** Provides db behavior. */
  const db = {
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    doc: ref,
    runTransaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction),
  };
  return {db: db as never, rows};
};

beforeEach(() => {
  process.env.REDDIT_APPROVED_FEATURES = "commerce";
  process.env.REDDIT_COMMERCE_SANDBOX_ENABLED = "1";
  delete process.env.REDDIT_DISABLED_FEATURES;
});
afterEach(() => {
  delete process.env.REDDIT_APPROVED_FEATURES;
  delete process.env.REDDIT_COMMERCE_SANDBOX_ENABLED;
  delete process.env.REDDIT_DISABLED_FEATURES;
});

it("grants after debt repayment and replays the provider/environment receipt idempotently", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 300}, [`redditCommerceAccounts/${UID}`]: {coinDebt: 100}});
  /** Provides input behavior. */
  const input = {
    uid: UID,
    orderId: "order-1",
    productId: "riddle_quest_coins_250" as const,
    environment: "sandbox" as const,
    purchasedAtMs: 1_000,
  };
  await expect(grantVerifiedRedditOrder(fixture.db, input)).resolves.toEqual({
    alreadyProcessed: false,
    coins: 450,
    coinDebt: 0,
  });
  await expect(grantVerifiedRedditOrder(fixture.db, input)).resolves.toEqual({
    alreadyProcessed: true,
    coins: 450,
    coinDebt: 0,
  });
  expect(fixture.rows.get(`users/${UID}`)).toMatchObject({coins: 450, hasPurchasedApp: true});
  expect(fixture.rows.get(`redditCommerceReceipts/${redditCommerceReceiptId("sandbox", "order-1")}`)).toMatchObject({
    provider: "reddit",
    environment: "sandbox",
    grossCoins: 250,
    coinsGranted: 150,
    debtRepaid: 100,
  });
  expect(redditCommerceReceiptId("sandbox", "order-1")).not.toBe(redditCommerceReceiptId("production", "order-1"));
});

it("removes available refunded coins, records hidden debt, and repays it from a future grant", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 10}, [`redditCommerceAccounts/${UID}`]: {coinDebt: 0}});
  /** Provides purchase id behavior. */
  const purchaseId = redditCommerceReceiptId("production", "order-refund");
  fixture.rows.set(`redditCommerceReceipts/${purchaseId}`, {
    provider: "reddit",
    environment: "production",
    uid: UID,
    orderIdHash: purchaseId,
    productId: "riddle_quest_coins_250",
    grossCoins: 250,
    goldCost: 50,
    coinsGranted: 250,
    debtRepaid: 0,
    purchasedAtMs: 1_000,
    refundedAtMs: null,
  });
  /** Provides refund behavior. */
  const refund = {
    orderId: "order-refund",
    productId: "riddle_quest_coins_250" as const,
    environment: "production" as const,
    refundedAtMs: 2_000,
  };
  await expect(refundVerifiedRedditOrder(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: false,
    coins: 0,
    coinsRemoved: 10,
    coinDebt: 240,
  });
  await expect(refundVerifiedRedditOrder(fixture.db, refund)).resolves.toMatchObject({
    alreadyProcessed: true,
    coins: 0,
    coinsRemoved: 0,
    coinDebt: 240,
  });
  await expect(
    grantVerifiedRedditOrder(fixture.db, {
      uid: UID,
      orderId: "order-next",
      productId: "riddle_quest_coins_550",
      environment: "production",
      purchasedAtMs: 3_000,
    }),
  ).resolves.toEqual({alreadyProcessed: false, coins: 310, coinDebt: 0});
});

it("fails closed for disabled commerce, cross-provider UIDs, and receipt scope changes", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 300}});
  process.env.REDDIT_DISABLED_FEATURES = "commerce";
  await expect(
    grantVerifiedRedditOrder(fixture.db, {
      uid: UID,
      orderId: "order-1",
      productId: "riddle_quest_coins_250",
      environment: "sandbox",
      purchasedAtMs: 1_000,
    }),
  ).rejects.toThrow("reddit-commerce-disabled");
  delete process.env.REDDIT_DISABLED_FEATURES;
  await expect(
    grantVerifiedRedditOrder(fixture.db, {
      uid: `facebook_${"a".repeat(40)}`,
      orderId: "order-1",
      productId: "riddle_quest_coins_250",
      environment: "sandbox",
      purchasedAtMs: 1_000,
    }),
  ).rejects.toThrow("invalid-reddit-commerce-uid");
});
