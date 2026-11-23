import {
  grantVerifiedYahooStripePurchase,
  refundVerifiedYahooStripePurchase,
  yahooStripeLedgerId,
} from "../yahooStripeLedger";

/** Provides uid behavior. */
const UID = "yahoo:player-1";
/** Provides row behavior. */
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
        /** Stores path. */
        path: string;
      }) => ({
        exists: rows.has(path),
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
    runTransaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction),
  };
  return {db: db as never, rows};
};

it("grants a paid checkout once and hashes Stripe identifiers", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 100}, [`yahooStripeAccounts/${UID}`]: {coinDebt: 50}});
  /** Provides input behavior. */
  const input = {
    uid: UID,
    /** Provides checkout session id behavior. */
    checkoutSessionId: "cs_test_1",
    /** Provides payment intent id behavior. */
    paymentIntentId: "pi_test_1",
    /** Provides product id behavior. */
    productId: "com.roobsworld.riddlequest.coinpack1",
    purchasedAtMs: 1_000,
  };
  await expect(grantVerifiedYahooStripePurchase(fixture.db, input)).resolves.toEqual({
    alreadyProcessed: false,
    coins: 300,
    coinDebt: 0,
  });
  await expect(grantVerifiedYahooStripePurchase(fixture.db, input)).resolves.toEqual({
    alreadyProcessed: true,
    coins: 300,
    coinDebt: 0,
  });
  /** Provides receipt id behavior. */
  const receiptId = yahooStripeLedgerId("checkout", input.checkoutSessionId);
  expect(receiptId).toMatch(/^[0-9a-f]{64}$/u);
  expect(receiptId).not.toContain(input.checkoutSessionId);
  expect(fixture.rows.get(`yahooStripeReceipts/${receiptId}`)).toMatchObject({
    /** Provides provider behavior. */
    provider: "stripe",
    grossCoins: 250,
    coinsGranted: 200,
    debtRepaid: 50,
  });
});

it("turns a full refund into coin removal and debt, then replays safely", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 10}});
  /** Provides purchase behavior. */
  const purchase = {
    uid: UID,
    /** Provides checkout session id behavior. */
    checkoutSessionId: "cs_refund",
    /** Provides payment intent id behavior. */
    paymentIntentId: "pi_refund",
    /** Provides product id behavior. */
    productId: "com.roobsworld.riddlequest.coinpack1",
    purchasedAtMs: 1_000,
  };
  await grantVerifiedYahooStripePurchase(fixture.db, purchase);
  fixture.rows.set(`users/${UID}`, {coins: 10});
  /** Provides refund behavior. */
  const refund = {paymentIntentId: purchase.paymentIntentId, refundedAtMs: 2_000};
  await expect(refundVerifiedYahooStripePurchase(fixture.db, refund)).resolves.toEqual({alreadyProcessed: false});
  await expect(refundVerifiedYahooStripePurchase(fixture.db, refund)).resolves.toEqual({alreadyProcessed: true});
  expect(fixture.rows.get(`users/${UID}`)).toMatchObject({coins: 0});
  expect(fixture.rows.get(`yahooStripeAccounts/${UID}`)).toMatchObject({coinDebt: 240});
});

it("rejects unknown products and conflicting payment reuse", async () => {
  /** Provides fixture behavior. */
  const fixture = database({[`users/${UID}`]: {coins: 0}});
  await expect(
    grantVerifiedYahooStripePurchase(fixture.db, {
      uid: UID,
      /** Provides checkout session id behavior. */
      checkoutSessionId: "cs_unknown",
      /** Provides payment intent id behavior. */
      paymentIntentId: "pi_unknown",
      /** Provides product id behavior. */
      productId: "attacker-product",
      purchasedAtMs: 1_000,
    }),
  ).rejects.toThrow("invalid-yahoo-stripe-product");

  /** Provides input behavior. */
  const input = {
    uid: UID,
    /** Provides checkout session id behavior. */
    checkoutSessionId: "cs_valid",
    /** Provides payment intent id behavior. */
    paymentIntentId: "pi_valid",
    /** Provides product id behavior. */
    productId: "com.roobsworld.riddlequest.coinpack1",
    purchasedAtMs: 1_000,
  };
  await grantVerifiedYahooStripePurchase(fixture.db, input);
  await expect(
    grantVerifiedYahooStripePurchase(fixture.db, {
      ...input,
      /** Provides checkout session id behavior. */
      checkoutSessionId: "cs_different",
    }),
  ).rejects.toThrow("yahoo-stripe-receipt-conflict");
});
