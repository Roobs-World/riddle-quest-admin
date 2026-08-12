import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// 1. Mock const declarations
const mockUpdateUserProfile = jest.fn<(userId: string, profileData: Record<string, unknown>) => Promise<void>>();
const mockAdminFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockAdminFirestoreSet = jest.fn<() => Promise<void>>();
type MockDocumentRef = {kind: "document"; collection: string; id: string; path: string};
type MockQueryRef = {kind: "query"; collection: string; field: string; value: unknown};
const mockFirestoreDocuments = new Map<string, Record<string, unknown>>();
const mockTransactionGet = jest.fn(async (ref: MockDocumentRef | MockQueryRef) => {
  if (ref.kind === "query") {
    const prefix = `${ref.collection}/`;
    const docs = [...mockFirestoreDocuments.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/")
        && data[ref.field] === ref.value)
      .map(([path, data]) => ({id: path.slice(prefix.length), data: () => data}));
    return {empty: docs.length === 0, docs};
  }
  const data = mockFirestoreDocuments.get(ref.path);
  return {exists: data !== undefined, data: () => data};
});
const mockTransactionUpdate = jest.fn((ref: MockDocumentRef, data: Record<string, unknown>) => {
  const current = mockFirestoreDocuments.get(ref.path);
  if (!current) throw new Error(`Missing document ${ref.path}`);
  mockFirestoreDocuments.set(ref.path, {...current, ...data});
});
const mockTransactionSet = jest.fn((ref: MockDocumentRef, data: Record<string, unknown>) => {
  mockFirestoreDocuments.set(ref.path, {...mockFirestoreDocuments.get(ref.path), ...data});
});
const mockTransactionDelete = jest.fn((ref: MockDocumentRef) => {
  mockFirestoreDocuments.delete(ref.path);
});
const mockTransaction = {
  get: mockTransactionGet,
  update: mockTransactionUpdate,
  set: mockTransactionSet,
  delete: mockTransactionDelete,
};
let mockTransactionTail: Promise<unknown> = Promise.resolve();
const runQueuedTransaction = (callback: (transaction: typeof mockTransaction) => unknown) => {
  const result = mockTransactionTail.then(() => callback(mockTransaction));
  mockTransactionTail = result.then(() => undefined, () => undefined);
  return result;
};
const mockRunTransaction = jest.fn(runQueuedTransaction);
const mockAdminFirestoreDoc = jest.fn((collection: string, id = "") => ({
  kind: "document" as const,
  collection,
  id,
  path: `${collection}/${id}`,
  update: mockAdminFirestoreUpdate,
  set: mockAdminFirestoreSet,
}));
const mockAdminFirestoreCollection = jest.fn((path: string) => ({
  doc: (id?: string) => mockAdminFirestoreDoc(path, id),
  where: (field: string, _operator: string, value: unknown) => ({
    limit: () => ({kind: "query" as const, collection: path, field, value}),
  }),
}));

const mockLoggerInfo = jest.fn<(...args: unknown[]) => void>();
const mockLoggerError = jest.fn<(...args: unknown[]) => void>();
const mockStorageSave = jest.fn<() => Promise<void>>();
const mockRunWithJestAccountOperationLease = jest.fn(async (
  _userId: string,
  _timeoutSeconds: number,
  operation: () => Promise<unknown>,
) => operation());
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

jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual<typeof import("../jest/jestAccountDeletion")>("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
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
    runTransaction: mockRunTransaction,
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
import {createUsernameReservationId} from "../profile/usernameReservations";

// 5. Describe block
describe("Profile Cloud Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestoreDocuments.clear();
    mockFirestoreDocuments.set("usernameReservationMigrations/v1", {complete: true});
    mockTransactionTail = Promise.resolve();
    mockRunTransaction.mockImplementation(runQueuedTransaction);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enables App Check and public Cloud Run ingress on profile update callables", () => {
    expect(mockOnCallInvocations).toEqual([
      [{enforceAppCheck: true, invoker: "public", timeoutSeconds: 60}, expect.any(Function)],
      [{enforceAppCheck: true, invoker: "public", timeoutSeconds: 60}, expect.any(Function)],
      [{enforceAppCheck: true, invoker: "public", timeoutSeconds: 540}, expect.any(Function)],
    ]);
  });

  describe("updateUsername", () => {
    const mockAuth = {uid: "testUserId456"};
    const validUsername = "newplayer";

    beforeEach(() => {
      mockFirestoreDocuments.set(`users/${mockAuth.uid}`, {username: validUsername});
    });

    it("should successfully update username", async () => {
      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      const result = await (updateUsername as any)(request);

      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({path: `users/${mockAuth.uid}`}),
        expect.objectContaining({
          username: validUsername,
          usernameNormalized: validUsername,
          usernameReservationId: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      );
      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.objectContaining({path: expect.stringMatching(/^usernameReservations\/[0-9a-f]{64}$/)}),
        expect.objectContaining({username: validUsername, userId: mockAuth.uid}),
      );
      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.objectContaining({path: `leaderboard/${mockAuth.uid}`}),
        expect.objectContaining({
          userId: mockAuth.uid,
          subjectUserId: mockAuth.uid,
          username: validUsername,
          updatedAt: expect.any(Number),
        }),
        {merge: true},
      );
      expect(result).toEqual({success: true, message: "Username updated successfully."});
    });

    it("does not report success when the atomic leaderboard update fails", async () => {
      mockRunTransaction.mockRejectedValueOnce(new Error("leaderboard unavailable"));
      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      await expect((updateUsername as any)(request)).rejects.toMatchObject({code: "internal"});
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
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
      mockFirestoreDocuments.set("users/another-user", {username: validUsername});

      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      await expect((updateUsername as any)(request)).rejects.toThrow(
        new HttpsError("already-exists", "Username already taken."),
      );
    });

    it("rejects a missing profile before writing a reservation", async () => {
      mockFirestoreDocuments.delete(`users/${mockAuth.uid}`);

      await expect((updateUsername as any)({auth: mockAuth, data: {username: validUsername}})).rejects.toMatchObject({
        code: "not-found",
      });
      expect(mockTransactionSet).not.toHaveBeenCalled();
    });

    it("allows a user to keep their current username", async () => {
      await expect((updateUsername as any)({auth: mockAuth, data: {username: validUsername}})).resolves.toEqual({
        success: true,
        message: "Username updated successfully.",
      });
    });

    it("cleans up an owned previous reservation when a user renames", async () => {
      const previousId = createUsernameReservationId("Old Player");
      mockFirestoreDocuments.set(`users/${mockAuth.uid}`, {
        username: "Old Player",
        usernameNormalized: "old player",
        usernameReservationId: previousId,
      });
      mockFirestoreDocuments.set(`usernameReservations/${previousId}`, {userId: mockAuth.uid});

      await expect((updateUsername as any)({auth: mockAuth, data: {username: validUsername}})).resolves.toBeDefined();

      expect(mockTransactionDelete).toHaveBeenCalledWith(
        expect.objectContaining({path: `usernameReservations/${previousId}`}),
      );
      expect(mockFirestoreDocuments.has(`usernameReservations/${previousId}`)).toBe(false);
    });

    it("serializes concurrent NFKC/case-equivalent claims", async () => {
      mockFirestoreDocuments.set("users/player-two", {username: "Player Two"});
      const claims = await Promise.allSettled([
        (updateUsername as any)({auth: mockAuth, data: {username: "Nova"}}),
        (updateUsername as any)({auth: {uid: "player-two"}, data: {username: "ＮＯＶＡ"}}),
      ]);

      expect(claims.filter(({status}) => status === "fulfilled")).toHaveLength(1);
      expect(claims.filter(({status}) => status === "rejected")).toHaveLength(1);
      expect(claims.find(({status}) => status === "rejected")).toMatchObject({
        reason: {code: "already-exists"},
      });
    });

    it("fails closed before legacy case variants have been migrated", async () => {
      mockFirestoreDocuments.delete("usernameReservationMigrations/v1");
      mockFirestoreDocuments.set("users/legacy-user", {username: "Ada"});

      await expect((updateUsername as any)({auth: mockAuth, data: {username: "ada"}})).rejects.toMatchObject({
        code: "failed-precondition",
      });
    });

    it("rejects profanity before querying username availability", async () => {
      await expect((updateUsername as any)({auth: mockAuth, data: {username: "damn-player"}})).rejects.toMatchObject({
        code: "invalid-argument",
      });
      expect(mockRunTransaction).not.toHaveBeenCalled();
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
        expect.objectContaining({
          userId: "user-1",
          subjectUserId: "user-1",
          username: "Ada",
          avatarUrl: "https://example.test/avatar",
          updatedAt: expect.any(Number),
        }),
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
