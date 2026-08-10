import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// 1. Mock const declarations
const mockUpdateUserProfile = jest.fn<(userId: string, profileData: Record<string, unknown>) => Promise<void>>();
const mockAdminFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockAdminFirestoreSet = jest.fn<() => Promise<void>>();
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn<() => Promise<void>>();
const mockAdminFirestoreBatch = jest.fn(() => ({
  update: mockBatchUpdate,
  set: mockBatchSet,
  commit: mockBatchCommit,
}));
const mockAdminFirestoreDoc = jest.fn((_id?: string) => ({
  update: mockAdminFirestoreUpdate,
  set: mockAdminFirestoreSet,
}));
const mockExistingUsersGet = jest.fn();
const mockAdminFirestoreCollection = jest.fn((_path?: string) => ({
  doc: mockAdminFirestoreDoc,
  where: jest.fn(() => ({
    limit: jest.fn(() => ({
      get: mockExistingUsersGet,
    })),
  })),
}));

const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();
const mockStorageSave = jest.fn<() => Promise<void>>();
const mockStorageFile = jest.fn((_path?: string) => ({
  save: mockStorageSave,
}));
const mockOnCallInvocations: Array<[unknown, unknown?]> = [];
const mockOnCall = jest.fn((optionsOrHandler: unknown, handler?: unknown) => {
  mockOnCallInvocations.push([optionsOrHandler, handler]);
  // Handle both signatures: onCall(handler) and onCall(options, handler)
  if (typeof optionsOrHandler === "function") {
    return optionsOrHandler;
  }
  return handler;
});

// 2. Jest/type imports
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";

// 3. jest.mock() calls
jest.mock("../gameplay/firestoreService", () => ({
  updateUserProfile: (...args: [string, Record<string, unknown>]) => mockUpdateUserProfile(...args),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: (path: string) => mockAdminFirestoreCollection(path),
    batch: mockAdminFirestoreBatch,
  }),
  storage: () => ({
    bucket: () => ({
      name: "test-bucket",
      file: (path: string) => mockStorageFile(path),
    }),
  }),
}));

interface MockOnCallHandler {
  (optionsOrHandler: unknown, handler?: unknown): unknown;
}

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: mockOnCall as MockOnCallHandler,
    HttpsError: actualV2Https.HttpsError,
  };
});

// 4. Import the module under test
import {updateAvatar, updateUsername} from "../profile";
import {syncLeaderboardProfileFields} from "../profile/leaderboardProfile";

// 5. Describe block
describe("Profile Cloud Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enables App Check and public Cloud Run ingress on profile update callables", () => {
    expect(mockOnCallInvocations).toEqual([
      [{enforceAppCheck: true, invoker: "public"}, expect.any(Function)],
      [{enforceAppCheck: true, invoker: "public"}, expect.any(Function)],
      [{enforceAppCheck: true, invoker: "public"}, expect.any(Function)],
    ]);
  });

  describe("updateUsername", () => {
    const mockAuth = {uid: "testUserId456"};
    const validUsername = "newplayer";

    beforeEach(() => {
      mockExistingUsersGet.mockResolvedValue({
        empty: true,
        docs: [],
      });
    });

    it("should successfully update username", async () => {
      mockBatchCommit.mockResolvedValue(undefined);
      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      const result = await (updateUsername as any)(request);

      expect(mockExistingUsersGet).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.any(Object), {username: validUsername});
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({username: validUsername, updatedAt: expect.any(Number)}),
        {merge: true},
      );
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(result).toEqual({success: true, message: "Username updated successfully."});
    });

    it("does not report success when the atomic leaderboard update fails", async () => {
      mockBatchCommit.mockRejectedValue(new Error("leaderboard unavailable"));
      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      await expect((updateUsername as any)(request)).rejects.toMatchObject({code: "internal"});
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it("should throw HttpsError if not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      await expect((updateUsername as any)(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw HttpsError for a taken username", async () => {
      mockExistingUsersGet.mockResolvedValue({
        empty: false,
        docs: [{id: "another-user"}],
      });

      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      await expect((updateUsername as any)(request)).rejects.toThrow(
        new HttpsError("already-exists", "Username already taken."),
      );
    });

    it("allows a user to keep their current username", async () => {
      mockExistingUsersGet.mockResolvedValue({empty: false, docs: [{id: mockAuth.uid}]});
      mockBatchCommit.mockResolvedValue(undefined);

      await expect((updateUsername as any)({auth: mockAuth, data: {username: validUsername}})).resolves.toEqual({
        success: true,
        message: "Username updated successfully.",
      });
    });

    it("rejects profanity before querying username availability", async () => {
      await expect((updateUsername as any)({auth: mockAuth, data: {username: "damn-player"}})).rejects.toMatchObject({
        code: "invalid-argument",
      });
      expect(mockExistingUsersGet).not.toHaveBeenCalled();
    });
  });

  describe("leaderboard profile synchronization", () => {
    it("does nothing when no display fields are supplied", async () => {
      await syncLeaderboardProfileFields("user-1", {});
      expect(mockAdminFirestoreSet).not.toHaveBeenCalled();
    });

    it("merges username and avatar display fields", async () => {
      mockAdminFirestoreSet.mockResolvedValue(undefined);

      await syncLeaderboardProfileFields("user-1", {username: "Ada", avatarUrl: "https://example.test/avatar"});

      expect(mockAdminFirestoreSet).toHaveBeenCalledWith(
        expect.objectContaining({username: "Ada", avatarUrl: "https://example.test/avatar", updatedAt: expect.any(Number)}),
        {merge: true},
      );
    });

    it("contains best-effort leaderboard failures", async () => {
      mockAdminFirestoreSet.mockRejectedValue(new Error("offline"));

      await expect(syncLeaderboardProfileFields("user-1", {username: "Ada"})).resolves.toBeUndefined();
    });
  });

  describe("updateAvatar", () => {
    const pngDataUrl = `data:image/png;base64,${Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]).toString("base64")}`;

    it("uploads a registered Jest player's avatar and updates profile records", async () => {
      mockStorageSave.mockResolvedValue(undefined);
      mockUpdateUserProfile.mockResolvedValue(undefined);
      mockAdminFirestoreSet.mockResolvedValue(undefined);
      const request = {
        auth: {uid: "jest_user", token: {jestRegistered: true}},
        data: {imageDataUrl: pngDataUrl},
      } as unknown as CallableRequest<{imageDataUrl: string}>;

      const result = await (updateAvatar as any)(request);

      expect(mockStorageFile).toHaveBeenCalledWith("avatars/jest_user/profile");
      expect(mockStorageSave).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({resumable: false, metadata: expect.objectContaining({contentType: "image/png"})}),
      );
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        "jest_user",
        expect.objectContaining({avatarUrl: expect.stringContaining("firebasestorage.googleapis.com")}),
      );
      expect(result).toEqual(expect.objectContaining({success: true, avatarUrl: expect.any(String)}));
    });

    it("rejects guest players before accepting avatar data", async () => {
      const request = {
        auth: {uid: "jest_guest", token: {jestRegistered: false}},
        data: {imageDataUrl: pngDataUrl},
      } as unknown as CallableRequest<{imageDataUrl: string}>;

      await expect((updateAvatar as any)(request)).rejects.toThrow(
        new HttpsError("failed-precondition", "Register with Jest before uploading a profile photo."),
      );
      expect(mockStorageSave).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated avatar uploads", async () => {
      await expect((updateAvatar as any)({auth: undefined, data: {imageDataUrl: pngDataUrl}})).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("maps invalid encoded images to a client-safe error", async () => {
      const invalidPng = `data:image/png;base64,${Buffer.from("not a png").toString("base64")}`;

      await expect((updateAvatar as any)({
        auth: {uid: "jest_user", token: {jestRegistered: true}},
        data: {imageDataUrl: invalidPng},
      })).rejects.toMatchObject({code: "invalid-argument"});
      expect(mockStorageSave).not.toHaveBeenCalled();
    });

    it("maps storage failures to an internal error", async () => {
      mockStorageSave.mockRejectedValue(new Error("storage unavailable"));

      await expect((updateAvatar as any)({
        auth: {uid: "jest_user", token: {jestRegistered: true}},
        data: {imageDataUrl: pngDataUrl},
      })).rejects.toMatchObject({code: "internal"});
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it("preserves explicit HTTPS errors from downstream services", async () => {
      const error = new HttpsError("resource-exhausted", "Try again later.");
      mockStorageSave.mockResolvedValue(undefined);
      mockUpdateUserProfile.mockRejectedValue(error);

      await expect((updateAvatar as any)({
        auth: {uid: "jest_user", token: {jestRegistered: true}},
        data: {imageDataUrl: pngDataUrl},
      })).rejects.toBe(error);
    });

    it("handles non-Error failures without exposing their value", async () => {
      mockStorageSave.mockRejectedValue("offline");

      await expect((updateAvatar as any)({
        auth: {uid: "jest_user", token: {jestRegistered: true}},
        data: {imageDataUrl: pngDataUrl},
      })).rejects.toMatchObject({code: "internal"});
    });
  });
});
