/** Signed payload returned by the Jest verification boundary in the current test. */
let verifiedPayload: Record<string, unknown> = {};
/** Firestore documents visible to the mocked purchase transaction. */
const documents = new Map<string, Record<string, unknown>>();
/** Firestore document IDs requested by endpoint code. */
const requestedDocumentIds: string[] = [];
/** Transactional document creation mock. */
const mockCreate = jest.fn((ref: {path: string}, data: Record<string, unknown>) => documents.set(ref.path, data));
/** Transactional document update mock. */
const mockUpdate = jest.fn((ref: {path: string}, data: Record<string, unknown>) => {
  const next = {...documents.get(ref.path), ...data};
  for (const [key, value] of Object.entries(next)) if (value === "field-delete") delete next[key];
  documents.set(ref.path, next);
});
const mockSet = jest.fn((ref: {path: string}, data: Record<string, unknown>, options?: {merge?: boolean}) => documents.set(ref.path, {...(options?.merge ? documents.get(ref.path) : {}), ...data}));
/** Transactional document deletion mock. */
const mockDelete = jest.fn();
/** Firebase custom-token creation mock. */
const mockCreateCustomToken = jest.fn(async () => "custom-token");
/** Authoritative deletion-only retry mock. */
const mockDeleteAccountForUser = jest.fn(async (_uid: string, _playerId?: string) => undefined);
/** Deployment options captured for each exported Jest HTTP boundary. */
const deployedOptions = new Map<string, Record<string, unknown>>();

/** Returns one mocked Firestore document snapshot. */
const snapshot = (path: string) => {
  /** Provides data behavior. */
  const data = documents.get(path);
  return {exists: data !== undefined, data: () => data, get: (field: string) => data?.[field]};
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
      set: typeof mockSet;
    }) => Promise<void>,
  ) =>
    operation({
      get: async (ref) => snapshot(ref.path),
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      set: mockSet,
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
        Object.defineProperty(ref, "id", {value: id, enumerable: false});
        Object.defineProperty(ref, "get", {value: async () => snapshot(path), enumerable: false});
        return ref;
      },
    }),
    runTransaction,
  }),
  {FieldValue: {serverTimestamp: () => "server-timestamp", delete: () => "field-delete"}},
);

jest.mock("../../../../../firebase-functions/src/shared/firebaseAdmin", () => ({
  admin: {
    firestore,
    auth: () => ({createCustomToken: mockCreateCustomToken}),
  },
}));
jest.mock("../jestSecurity", () => ({
  jestFirebaseUid: (playerId: string, generation = 1) => generation === 1 ? `uid-${playerId}` : `uid-${playerId}-g${generation}`,
  verifyJestSigned: () => verifiedPayload,
}));
jest.mock("../../../../../firebase-functions/src/profile/accountDeletion/deleteAccountData", () => ({
  deleteAccountForUser: mockDeleteAccountForUser,
}));
jest.mock("../../../../../firebase-functions/src/shared/sentryHandlers", () => ({
  onRequestWithSentry: (name: string, options: Record<string, unknown>, handler: unknown) => {
    deployedOptions.set(name, options);
    return handler;
  },
}));
jest.mock("../../../../../firebase-functions/src/shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));
jest.mock("firebase-functions", () => ({logger: {warn: jest.fn()}}));
jest.mock("firebase-functions/params", () => ({defineSecret: () => ({value: () => "secret"})}));

import {exchangeJestIdentity, grantJestPurchase, retryJestAccountDeletion} from "../jestEndpoints";
import {createJestPurchaseGrantId} from "../jestPurchaseReceipts";

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
const invokeDeletionRetry = async (body: Record<string, unknown> = {playerSigned: "signed"}) => {
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
      body,
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
    mockDeleteAccountForUser.mockImplementation(async (uid: string) => {
      documents.delete(`users/${uid}`);
      const path = `jestAccountDeletionTombstones/${uid}`;
      documents.set(path, {...documents.get(path), recreationBlocked: true, cleanupComplete: true});
    });
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

  it("creates a clean generation only after the requested deletion finishes", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});
    documents.set("users/uid-player-1", {coins: 9000, premiumCoinsGrantedAt: 123456, stats: {xp: 500, level: 20}});
    const freshStart = {playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"};
    expect((await invokeIdentity(freshStart)).statusCode).toBe(409);
    await invokeDeletionRetry();
    const result = await invokeIdentity(freshStart);
    expect(result).toMatchObject({statusCode: 200, body: {uid: "uid-player-1-g2", accountGeneration: 2, freshAccount: true}});
    expect(documents.get("users/uid-player-1-g2")).toMatchObject({coins: 300, stats: {xp: 0, level: 1}, progress: {classicIndex: 1}, unlockedAchievements: []});
    expect([...documents.entries()].find(([path]) => path.startsWith("providerIdentities/"))?.[1]).toMatchObject({premiumCoinsGrantedAt: 123456});
    expect(mockCreateCustomToken).toHaveBeenCalledWith("uid-player-1-g2", expect.objectContaining({jestAccountGeneration: 2}));
    expect((await invokeIdentity(freshStart)).body).toMatchObject({uid: "uid-player-1-g2", freshAccount: false});
  });

  it("old deletion retries preserve a replacement account and expose its UID", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});
    await invokeDeletionRetry();
    await invokeIdentity({playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"});
    documents.set("users/uid-player-1-g2", {coins: 777});
    mockDeleteAccountForUser.mockClear();
    expect((await invokeDeletionRetry()).body).toMatchObject({accountDeleted: true, deletedUid: "uid-player-1", activeAccountUid: "uid-player-1-g2"});
    expect((await invokeDeletionRetry({playerSigned: "signed", deletedUid: "uid-player-1"})).statusCode).toBe(200);
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
    expect(documents.get("users/uid-player-1-g2")).toEqual({coins: 777});
  });

  it("recovers a legacy initial deletion marker even when its first server request never started", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    documents.set("users/uid-player-1", {coins: 999});
    expect((await invokeDeletionRetry()).body).toMatchObject({accountDeleted: true, deletedUid: "uid-player-1"});
    expect(mockDeleteAccountForUser).toHaveBeenCalledWith("uid-player-1", "player-1");
    expect(documents.has("users/uid-player-1")).toBe(false);
    expect((await invokeIdentity({playerSigned: "signed", freshStart: true})).statusCode).toBe(401);
  });

  it("never uses the legacy initial-generation fallback for an active replacement", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    await invokeDeletionRetry();
    await invokeIdentity({playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"});
    const provider = [...documents.entries()].find(([path]) => path.startsWith("providerIdentities/"))![1];
    delete provider.lastDeletedUid;
    mockDeleteAccountForUser.mockClear();
    expect((await invokeDeletionRetry()).statusCode).toBe(400);
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
    expect(documents.get("users/uid-player-1-g2")?.coins).toBe(300);
  });

  it("rejects legacy purchase requests from an old client after recreation", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});
    await invokeDeletionRetry();
    await invokeIdentity({playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"});
    verifiedPayload = {purchase: {purchaseToken: "old-client-token", productSku}};
    expect((await invokePurchase("old-client-token", "old-client")).statusCode).toBe(400);
    expect(documents.get("users/uid-player-1-g2")?.coins).toBe(300);
  });

  it("does not release fresh start while a concurrent deletion sweep is still running", async () => {
    verifiedPayload = {sub: "player-1", player: {playerId: "player-1", registered: true}};
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    mockDeleteAccountForUser.mockImplementationOnce(async (uid) => {
      const path = `jestAccountDeletionTombstones/${uid}`;
      documents.set(path, {...documents.get(path), cleanupComplete: true});
      entered();
      await pending;
    });
    const deleting = invokeDeletionRetry({playerSigned: "signed", deletedUid: "uid-player-1"});
    await started;
    expect((await invokeDeletionRetry({playerSigned: "signed", deletedUid: "uid-player-1"})).statusCode).toBe(409);
    expect((await invokeIdentity({playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"})).statusCode).toBe(409);
    release();
    expect((await deleting).statusCode).toBe(200);
    expect((await invokeIdentity({playerSigned: "signed", freshStart: true, deletedUid: "uid-player-1"})).statusCode).toBe(200);
    expect(mockDeleteAccountForUser).toHaveBeenCalledTimes(1);
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
    documents.set("jestAccountDeletionTombstones/uid-player-1", {recreationBlocked: true});
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
