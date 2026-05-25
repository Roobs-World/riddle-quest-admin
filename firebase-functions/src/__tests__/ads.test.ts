import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {CallableRequest} from "firebase-functions/v2/https";

type MockDocRef = {
  path: string;
  collection: (name: string) => {doc: (id: string) => MockDocRef};
};

type MockSnapshot = {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();
const mockCaptureException = jest.fn<(...args: unknown[]) => void>();
const mockRunTransaction = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTransactionGet = jest.fn<(...args: unknown[]) => Promise<MockSnapshot>>();
const mockTransactionUpdate = jest.fn<(...args: unknown[]) => void>();
const mockTransactionSet = jest.fn<(...args: unknown[]) => void>();

const docs = new Map<string, Record<string, unknown>>();

const createDocRef = (path: string): MockDocRef => ({
  path,
  collection: (name: string) => ({
    doc: (id: string) => createDocRef(`${path}/${name}/${id}`),
  }),
});

const createSnapshot = (path: string): MockSnapshot => {
  const data = docs.get(path);
  return {
    exists: data !== undefined,
    data: () => data,
  };
};

const mockDb = {
  collection: jest.fn((name: string) => ({
    doc: (id?: string) => createDocRef(`${name}/${id ?? "auto-generated-id"}`),
  })),
  runTransaction: mockRunTransaction,
};

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockDb), {
    FieldValue: {
      serverTimestamp: jest.fn(() => "MOCK_SERVER_TIMESTAMP"),
    },
  }),
}));

jest.mock("firebase-functions/v2", () => {
  const actual = jest.requireActual("firebase-functions/v2") as typeof import("firebase-functions/v2");
  return {
    ...actual,
    logger: {
      ...(actual.logger as object),
      info: (...args: unknown[]) => mockLoggerInfo(...args),
      error: (...args: unknown[]) => mockLoggerError(...args),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
});

jest.mock("firebase-functions/v2/https", () => {
  const actual = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    ...actual,
    onCall: jest.fn((optionsOrHandler: unknown, maybeHandler?: unknown) =>
      maybeHandler ?? optionsOrHandler,
    ),
  };
});

jest.mock("../sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import {awardedAdCallback as originalAwardedAdCallback} from "../ads";

type AwardedAdRequestData = {
  userId?: unknown;
  placement?: unknown;
  callbackId?: unknown;
  provider?: unknown;
};

type AwardedAdResponse = {
  success: boolean;
  placement: "loss_continue" | "coin_shop";
  callbackId: string;
  rewardCoins: number;
  newCoins: number;
  alreadyProcessed: boolean;
  message: string;
};

const awardedAdCallback = originalAwardedAdCallback as unknown as (
  request: CallableRequest<AwardedAdRequestData>,
) => Promise<AwardedAdResponse>;

const createRequest = (
  data: AwardedAdRequestData,
  uid = "user-123",
): CallableRequest<AwardedAdRequestData> =>
  ({
    auth: uid ? {uid, token: {uid}} : undefined,
    data,
    rawRequest: {
      rawBody: Buffer.from(""),
      headers: {},
      body: {},
    },
    acceptsStreaming: false,
  }) as CallableRequest<AwardedAdRequestData>;

describe("awardedAdCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docs.clear();
    docs.set("users/user-123", {coins: 100});
    mockDb.collection.mockClear();
    mockTransactionGet.mockImplementation(async (ref: MockDocRef) =>
      createSnapshot(ref.path),
    );
    mockTransactionUpdate.mockImplementation((ref: MockDocRef, data: Record<string, unknown>) => {
      docs.set(ref.path, {...(docs.get(ref.path) ?? {}), ...data});
    });
    mockTransactionSet.mockImplementation((ref: MockDocRef, data: Record<string, unknown>) => {
      docs.set(ref.path, data);
    });
    mockRunTransaction.mockImplementation(async (callback: unknown) =>
      (callback as (transaction: {
        get: typeof mockTransactionGet;
        update: typeof mockTransactionUpdate;
        set: typeof mockTransactionSet;
      }) => Promise<unknown>)({
        get: mockTransactionGet,
        update: mockTransactionUpdate,
        set: mockTransactionSet,
      }),
    );
    jest.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects unauthenticated calls", async () => {
    await expect(
      awardedAdCallback(createRequest({userId: "user-123", placement: "loss_continue"}, "")),
    ).rejects.toMatchObject({
      code: "unauthenticated",
      message: "The function must be called while authenticated.",
    });
  });

  it("rejects callbacks for a different user", async () => {
    await expect(
      awardedAdCallback(createRequest({userId: "other-user", placement: "loss_continue"})),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects unsupported placements", async () => {
    await expect(
      awardedAdCallback(createRequest({userId: "user-123", placement: "banner"})),
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "Invalid rewarded ad placement.",
    });
  });

  it("awards coins once and records callback plus interaction data", async () => {
    const result = await awardedAdCallback(
      createRequest({
        userId: "user-123",
        placement: "loss_continue",
        callbackId: "reward-abc",
        provider: "google-mobile-ads",
      }),
    );

    expect(result).toEqual({
      success: true,
      placement: "loss_continue",
      callbackId: "reward-abc",
      rewardCoins: 25,
      newCoins: 125,
      alreadyProcessed: false,
      message: "Rewarded ad reward applied.",
    });
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "users/user-123"}),
      {coins: 125},
    );
    expect(docs.get("users/user-123/processedAdCallbacks/reward-abc")).toMatchObject({
      userId: "user-123",
      placement: "loss_continue",
      provider: "google-mobile-ads",
      rewardCoins: 25,
      newCoins: 125,
      status: "processed",
    });
    expect(docs.get("users/user-123/pendingAdCompletions/loss_continue")).toMatchObject({
      latestCallbackId: "reward-abc",
      cooldownUntilMs: 1_030_000,
    });
    expect(docs.get("adInteractions/auto-generated-id")).toMatchObject({
      eventType: "rewarded_ad_completed",
      userId: "user-123",
      placement: "loss_continue",
      rewardCoins: 25,
      newCoins: 125,
    });
  });

  it("returns an idempotent response for a duplicate callback id without awarding twice", async () => {
    docs.set("users/user-123/processedAdCallbacks/reward-abc", {
      rewardCoins: 25,
      newCoins: 125,
    });

    const result = await awardedAdCallback(
      createRequest({
        userId: "user-123",
        placement: "loss_continue",
        callbackId: "reward-abc",
      }),
    );

    expect(result).toMatchObject({
      success: true,
      callbackId: "reward-abc",
      rewardCoins: 25,
      newCoins: 125,
      alreadyProcessed: true,
    });
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("rate limits a different callback in the same placement cooldown window", async () => {
    docs.set("users/user-123/pendingAdCompletions/coin_shop", {
      cooldownUntilMs: 1_010_000,
    });

    await expect(
      awardedAdCallback(
        createRequest({
          userId: "user-123",
          placement: "coin_shop",
          callbackId: "reward-next",
        }),
      ),
    ).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Rewarded ad reward is on cooldown for this placement.",
    });
    expect(mockTransactionUpdate).not.toHaveBeenCalled();
  });

  it("returns not-found when the user document is missing", async () => {
    docs.delete("users/user-123");

    await expect(
      awardedAdCallback(
        createRequest({
          userId: "user-123",
          placement: "loss_continue",
          callbackId: "reward-missing-user",
        }),
      ),
    ).rejects.toMatchObject({
      code: "not-found",
      message: "User data not found.",
    });
  });

  it("maps unexpected transaction failures to an internal error", async () => {
    const error = new Error("transaction exploded");
    mockRunTransaction.mockRejectedValueOnce(error);

    await expect(
      awardedAdCallback(
        createRequest({
          userId: "user-123",
          placement: "loss_continue",
          callbackId: "reward-error",
        }),
      ),
    ).rejects.toMatchObject({
      code: "internal",
      message: "An error occurred while processing the rewarded ad callback.",
    });
    expect(mockCaptureException).toHaveBeenCalledWith(error);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Unexpected error processing rewarded ad callback:",
      error,
    );
  });
});
