/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";

const mockRecursiveDelete = jest.fn<() => Promise<void>>();
const mockUserDocDelete = jest.fn<() => Promise<void>>();
const mockLeaderboardDocDelete = jest.fn<() => Promise<void>>();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn<() => Promise<void>>();
const mockPurchaseAnalyticsGet = jest.fn<() => Promise<any>>();
const mockNotificationHistoryGet = jest.fn<() => Promise<any>>();
const mockDeleteFiles = jest.fn<() => Promise<unknown>>();
const mockDeleteUser = jest.fn<() => Promise<void>>();
const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();
const mockCaptureException = jest.fn();

const makeQuery = (get: () => Promise<any>) => ({
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get,
});

const mockUserDocRef = {path: "users/auth-user-1", delete: mockUserDocDelete};
const mockLeaderboardDocRef = {path: "leaderboard/auth-user-1", delete: mockLeaderboardDocDelete};
const mockPurchaseAnalyticsQuery = makeQuery(() => mockPurchaseAnalyticsGet());
const mockNotificationHistoryQuery = makeQuery(() => mockNotificationHistoryGet());

const mockFirestore = {
  recursiveDelete: mockRecursiveDelete,
  batch: jest.fn(() => ({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  })),
  collection: jest.fn((path: string) => {
    if (path === "users") {
      return {
        doc: jest.fn(() => mockUserDocRef),
      };
    }
    if (path === "leaderboard") {
      return {
        doc: jest.fn(() => mockLeaderboardDocRef),
      };
    }
    if (path === "purchaseAnalytics") {
      return mockPurchaseAnalyticsQuery;
    }
    if (path === "notificationHistory") {
      return mockNotificationHistoryQuery;
    }
    return {
      doc: jest.fn(() => ({delete: jest.fn()})),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(() => Promise.resolve({empty: true, docs: [], size: 0})),
    };
  }),
};

jest.mock("../firestoreService", () => ({
  initializeNewUser: jest.fn(),
  ensureUserDocumentComplete: jest.fn(),
}));

jest.mock("../sentry", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: jest.fn((optionsOrHandler: unknown, handler?: unknown) => {
      if (typeof optionsOrHandler === "function") {
        return optionsOrHandler;
      }
      return handler;
    }),
    HttpsError: actualV2Https.HttpsError,
  };
});

jest.mock("firebase-admin", () => ({
  firestore: () => mockFirestore,
  storage: () => ({
    bucket: () => ({
      deleteFiles: mockDeleteFiles,
    }),
  }),
  auth: () => ({
    deleteUser: mockDeleteUser,
  }),
}));

import {deleteAccount} from "../userManagement";

describe("deleteAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecursiveDelete.mockResolvedValue(undefined);
    mockUserDocDelete.mockResolvedValue(undefined);
    mockLeaderboardDocDelete.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockPurchaseAnalyticsGet.mockResolvedValue({empty: true, docs: [], size: 0});
    mockNotificationHistoryGet.mockResolvedValue({empty: true, docs: [], size: 0});
    mockDeleteFiles.mockResolvedValue([]);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated requests", async () => {
    const request = {
      auth: undefined,
      data: {},
    } as CallableRequest<object>;

    await expect((deleteAccount as any)(request)).rejects.toThrow(
      new HttpsError("unauthenticated", "The function must be called while authenticated."),
    );
  });

  it("deletes only request.auth.uid owned resources", async () => {
    const request = {
      auth: {uid: "auth-user-1"},
      data: {userId: "attacker-target"},
    } as unknown as CallableRequest<object>;

    const result = await (deleteAccount as any)(request);

    expect(result).toEqual({
      success: true,
      message: "Account deleted successfully.",
    });
    expect(mockFirestore.collection).toHaveBeenCalledWith("users");
    expect(mockRecursiveDelete).toHaveBeenCalledWith(mockUserDocRef);
    expect(mockLeaderboardDocDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "avatars/auth-user-1/"});
    expect(mockDeleteFiles).toHaveBeenCalledWith({prefix: "exports/auth-user-1/"});
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(mockDeleteUser).not.toHaveBeenCalledWith("attacker-target");
  });

  it("deletes user-owned top-level documents matched by userId", async () => {
    const purchaseDocRef = {path: "purchaseAnalytics/p1"};
    const historyDocRef = {path: "notificationHistory/n1"};
    mockPurchaseAnalyticsGet
      .mockResolvedValueOnce({empty: false, docs: [{ref: purchaseDocRef}], size: 1})
      .mockResolvedValueOnce({empty: true, docs: [], size: 0});
    mockNotificationHistoryGet
      .mockResolvedValueOnce({empty: false, docs: [{ref: historyDocRef}], size: 1})
      .mockResolvedValueOnce({empty: true, docs: [], size: 0});

    const request = {
      auth: {uid: "auth-user-1"},
      data: {},
    } as unknown as CallableRequest<object>;

    await (deleteAccount as any)(request);

    expect(mockBatchDelete).toHaveBeenCalledWith(purchaseDocRef);
    expect(mockBatchDelete).toHaveBeenCalledWith(historyDocRef);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  it("returns success when the Auth user is already missing", async () => {
    mockDeleteUser.mockRejectedValueOnce({code: "auth/user-not-found"});
    const request = {
      auth: {uid: "auth-user-1"},
      data: {},
    } as unknown as CallableRequest<object>;

    await expect((deleteAccount as any)(request)).resolves.toEqual({
      success: true,
      message: "Account deleted successfully.",
    });
  });
});
