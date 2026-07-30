/* eslint-disable @typescript-eslint/no-explicit-any */
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// 1. Mock const declarations
const mockUpdateUserProfile = jest.fn<(userId: string, profileData: Record<string, unknown>) => Promise<void>>();
const mockAdminFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockAdminFirestoreSet = jest.fn<() => Promise<void>>();
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
jest.mock("../firestoreService", () => ({
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

// 5. Describe block
describe("Profile Cloud Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enables App Check on profile update callables", () => {
    expect(mockOnCallInvocations).toEqual([
      [{enforceAppCheck: true}, expect.any(Function)],
      [{enforceAppCheck: true}, expect.any(Function)],
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
      mockUpdateUserProfile.mockResolvedValue(undefined);
      const request = {
        auth: mockAuth,
        data: {username: validUsername},
      } as CallableRequest<{username: string}>;

      const result = await (updateUsername as any)(request);

      expect(mockExistingUsersGet).toHaveBeenCalled();
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockAuth.uid, {username: validUsername});
      expect(result).toEqual({success: true, message: "Username updated successfully."});
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
  });
});
