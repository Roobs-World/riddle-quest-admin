/** Signed payload returned by the Jest verification boundary in the current test. */
let verifiedPayload: Record<string, unknown> = {};
/** Firestore documents visible to the mocked purchase transaction. */
const documents = new Map<string, Record<string, unknown>>();
/** Firestore document IDs requested by endpoint code. */
const requestedDocumentIds: string[] = [];
/** Transactional document creation mock. */
const mockCreate = jest.fn();
/** Transactional document update mock. */
const mockUpdate = jest.fn();
/** Transactional document deletion mock. */
const mockDelete = jest.fn();
/** Firebase custom-token creation mock. */
const mockCreateCustomToken = jest.fn(async () => "custom-token");
/** Authoritative deletion-only retry mock. */
const mockDeleteAccountForUser = jest.fn(async () => undefined);
/** Deployment options captured for each exported Jest HTTP boundary. */
const deployedOptions = new Map<string, Record<string, unknown>>();

/** Returns one mocked Firestore document snapshot. */
const snapshot = (path: string) => {
  /** Provides data behavior. */
  const data = documents.get(path);
  return {exists: data !== undefined, data: () => data};
};

/** Firestore transaction runner used by the purchase endpoint. */
const runTransaction = jest.fn(
  async (
    operation: (transaction: {
      /** Provides get behavior. */
      get(ref: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }): Promise<ReturnType<typeof snapshot>>;
      /** Stores create. */
      create: typeof mockCreate;
      /** Stores update. */
      update: typeof mockUpdate;
      /** Stores delete. */
      delete: typeof mockDelete;
    }) => Promise<void>,
  ) =>
    operation({
      get: async (ref) => snapshot(ref.path),
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    }),
);

/** Mock Firestore factory with the legacy static FieldValue surface used by Admin SDK code. */
const firestore = Object.assign(
  () => ({
    collection: (collection: string) => ({
      doc: (id: string) => {
        requestedDocumentIds.push(id);
        /** Provides path behavior. */
        const path = `${collection}/${id}`;
        /** Provides ref behavior. */
        const ref = {path} as {
          /** Stores path. */
          path: string; /** Provides get behavior. */
          /** Provides get behavior. */
          get(): Promise<ReturnType<typeof snapshot>>;
        };
        Object.defineProperty(ref, "get", {value: async () => snapshot(path), enumerable: false});
        return ref;
      },
    }),
    runTransaction,
  }),
  {FieldValue: {serverTimestamp: () => "server-timestamp"}},
);

jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    firestore,
    auth: () => ({createCustomToken: mockCreateCustomToken}),
  },
}));
jest.mock("../jest/jestSecurity", () => ({
  jestFirebaseUid: (playerId: string) => `uid-${playerId}`,
  verifyJestSigned: () => verifiedPayload,
}));
jest.mock("../profile/accountDeletion/deleteAccountData", () => ({
  deleteAccountForUser: mockDeleteAccountForUser,
}));
jest.mock("../shared/sentryHandlers", () => ({
  onRequestWithSentry: (name: string, options: Record<string, unknown>, handler: unknown) => {
    deployedOptions.set(name, options);
    return handler;
  },
}));
jest.mock("../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));
jest.mock("firebase-functions", () => ({logger: {warn: jest.fn()}}));
jest.mock("firebase-functions/params", () => ({defineSecret: () => ({value: () => "secret"})}));

import {exchangeJestIdentity, grantJestPurchase, retryJestAccountDeletion} from "../jest/jestEndpoints";
import {createJestPurchaseGrantId} from "../jest/jestPurchaseReceipts";

/** Creates a trusted JSON request for one signed purchase token. */
const request = (purchaseToken: string, ip: string) => ({
  body: {purchaseSigned: "signed", playerId: "player-1", purchaseToken},
  get: (name: string) =>
    name.toLowerCase() === "origin" ? "https://019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com" : undefined,
  method: "POST",
  is: (type: string) => type === "application/json",
  ip,
});

/** Creates a response recorder compatible with the Jest HTTP endpoint. */
const response = () => {
  /** Provides output behavior. */
  const output = {
    body: undefined as unknown,
    statusCode: 200,
    set: jest.fn(),
    /** Provides status behavior. */
    status(code: number) {
      output.statusCode = code;
      return output;
    },
    /** Provides json behavior. */
    json(body: unknown) {
      output.body = body;
      return output;
    },
    /** Provides send behavior. */
    send(body: string) {
      output.body = body;
      return output;
    },
  };
  return output;
};

/** Invokes the unwrapped purchase handler returned by the Sentry boundary mock. */
const invokePurchase = async (purchaseToken: string, ip: string) => {
  /** Provides output behavior. */
  const output = response();
  await (
    grantJestPurchase as unknown as (
      input: ReturnType<typeof request>,
      output: ReturnType<typeof response>,
    ) => Promise<void>
  )(request(purchaseToken, ip), output);
  return output;
};

/** Invokes the signed identity exchange handler. */
const invokeIdentity = async (body: Record<string, unknown> = {playerSigned: "signed"}) => {
  /** Provides output behavior. */
  const output = response();
  await (
    exchangeJestIdentity as unknown as (
      input: ReturnType<typeof request> & {
        /** Stores body. */
        body: Record<string, unknown>;
      },
      output: ReturnType<typeof response>,
    ) => Promise<void>
  )(
    {
      ...request("unused", `identity-${JSON.stringify(body)}`),
      body,
    },
    output,
  );
  return output;
};

/** Invokes the dedicated signed deletion-only retry handler. */
const invokeDeletionRetry = async () => {
  /** Provides output behavior. */
  const output = response();
  await (
    retryJestAccountDeletion as unknown as (
      input: ReturnType<typeof request> & {
        /** Stores body. */
        body: Record<string, unknown>;
      },
      output: ReturnType<typeof response>,
    ) => Promise<void>
  )(
    {
      ...request("unused", "deletion-retry"),
      body: {playerSigned: "signed"},
    },
    output,
  );
  return output;
};

describe("grantJestPurchase receipt idempotency", () => {
  /** Provides product sku behavior. */
  const productSku = "com.roobsworld.riddlequest.coinpack1";

  beforeEach(() => {
    jest.clearAllMocks();
    documents.clear();
    requestedDocumentIds.length = 0;
  });

  it("deploys every signed browser endpoint with deterministic public ingress", () => {
    expect([...deployedOptions.entries()]).toEqual([
      ["exchangeJestIdentity", expect.objectContaining({invoker: "public", minInstances: 0})],
      ["retryJestAccountDeletion", expect.objectContaining({invoker: "public", timeoutSeconds: 540})],
      ["grantJestPurchase", expect.objectContaining({invoker: "public"})],
      ["syncJestSubscriptions", expect.objectContaining({invoker: "public"})],
      ["verifyJestReferrals", expect.objectContaining({invoker: "public"})],
    ]);
  });

  it("blocks identity recreation and retries deletion without minting credentials", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});

    await expect(invokeIdentity()).resolves.toMatchObject({
      statusCode: 409,
      body: {error: "account-deleted"},
    });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();

    await expect(invokeDeletionRetry()).resolves.toMatchObject({
      statusCode: 200,
      body: {accountDeleted: true},
    });
    expect(mockDeleteAccountForUser).toHaveBeenCalledWith("uid-player-1", "player-1");
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalledWith({path: "users/uid-player-1"}, expect.anything());
  });

  it("withholds a token when deletion commits during custom-token minting", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    mockCreateCustomToken.mockImplementationOnce(async () => {
      documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});
      return "pre-deletion-custom-token";
    });

    await expect(invokeIdentity()).resolves.toMatchObject({
      statusCode: 409,
      body: {error: "account-deleted"},
    });
    expect(mockCreateCustomToken).toHaveBeenCalledTimes(1);
  });

  it("rejects a forged recovery flag at the normal identity boundary", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};

    await expect(invokeIdentity({playerSigned: "signed", deletionRecovery: true})).resolves.toMatchObject({
      statusCode: 401,
      body: {error: "invalid-request"},
    });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
  });

  it("keeps deletion retryable while an older authenticated operation drains", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    mockDeleteAccountForUser.mockRejectedValueOnce(new Error("account-deletion-in-progress"));

    await expect(invokeDeletionRetry()).resolves.toMatchObject({
      statusCode: 409,
      body: {error: "account-deletion-in-progress"},
    });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("never grants a purchase or recreates a user after account deletion", async () => {
    /** Provides purchase token behavior. */
    const purchaseToken = "post-deletion-purchase";
    verifiedPayload = {purchase: {purchaseToken, productSku}};
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});

    /** Provides output behavior. */
    const output = await invokePurchase(purchaseToken, "purchase-after-deletion");

    expect(output).toMatchObject({statusCode: 409, body: {error: "account-deleted"}});
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("never sends an unsafe signed token to Firestore and stores only an opaque tombstone", async () => {
    /** Provides purchase token behavior. */
    const purchaseToken = `unsafe/token/${"x".repeat(2_000)}`;
    /** Provides purchase token hash behavior. */
    const purchaseTokenHash = createJestPurchaseGrantId(purchaseToken);
    verifiedPayload = {purchase: {purchaseToken, productSku}};
    documents.set("users/uid-player-1", {coins: 100, unlockedAchievements: []});

    /** Provides output behavior. */
    const output = await invokePurchase(purchaseToken, "purchase-new");

    expect(output.statusCode).toBe(200);
    expect(requestedDocumentIds).toContain(purchaseTokenHash);
    expect(requestedDocumentIds).not.toContain(purchaseToken);
    expect(mockCreate).toHaveBeenCalledWith(
      {path: `jestPurchaseGrants/${purchaseTokenHash}`},
      {
        purchaseTokenHash,
        replayProtection: true,
        productSku,
        coins: 250,
        grantedAt: "server-timestamp",
      },
    );
  });

  it("rejects an oversized token before any Firestore or grant work", async () => {
    /** Provides purchase token behavior. */
    const purchaseToken = "x".repeat(4_097);
    verifiedPayload = {purchase: {purchaseToken, productSku}};

    /** Provides output behavior. */
    const output = await invokePurchase(purchaseToken, "purchase-oversized");

    expect(output).toMatchObject({statusCode: 400, body: {error: "invalid-request"}});
    expect(runTransaction).not.toHaveBeenCalled();
    expect(requestedDocumentIds).toEqual([]);
  });

  it("returns the user's current balance when a hashed receipt is replayed", async () => {
    /** Provides purchase token behavior. */
    const purchaseToken = "already-spent";
    /** Provides purchase token hash behavior. */
    const purchaseTokenHash = createJestPurchaseGrantId(purchaseToken);
    verifiedPayload = {purchase: {purchaseToken, productSku}};
    documents.set(`jestPurchaseGrants/${purchaseTokenHash}`, {
      purchaseTokenHash,
      newCoins: 600,
      replayProtection: true,
    });
    documents.set("users/uid-player-1", {coins: 73});

    /** Provides output behavior. */
    const output = await invokePurchase(purchaseToken, "purchase-replay");

    expect(output.body).toMatchObject({alreadyProcessed: true, newCoins: 73});
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("atomically migrates a safe raw-token receipt without granting it again", async () => {
    /** Provides purchase token behavior. */
    const purchaseToken = "legacy-token";
    /** Provides purchase token hash behavior. */
    const purchaseTokenHash = createJestPurchaseGrantId(purchaseToken);
    verifiedPayload = {purchase: {purchaseToken, productSku}};
    documents.set(`jestPurchaseGrants/${purchaseToken}`, {
      uid: "uid-player-1",
      playerId: "player-1",
      productSku,
      coins: 250,
      newCoins: 600,
      grantedAt: "original-timestamp",
    });
    documents.set("users/uid-player-1", {coins: 42});

    /** Provides output behavior. */
    const output = await invokePurchase(purchaseToken, "purchase-legacy");

    expect(output.body).toMatchObject({alreadyProcessed: true, newCoins: 42});
    expect(mockCreate).toHaveBeenCalledWith(
      {path: `jestPurchaseGrants/${purchaseTokenHash}`},
      {
        purchaseTokenHash,
        replayProtection: true,
        productSku,
        coins: 250,
        grantedAt: "original-timestamp",
      },
    );
    expect(mockDelete).toHaveBeenCalledWith({path: `jestPurchaseGrants/${purchaseToken}`});
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
