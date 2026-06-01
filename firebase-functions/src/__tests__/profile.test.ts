/* eslint-disable @typescript-eslint/no-explicit-any */
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// 1. Mock const declarations
const mockUpdateUserProfile = jest.fn<(userId: string, profileData: Record<string, unknown>) => Promise<void>>();
const mockAdminFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockAdminFirestoreDoc = jest.fn((_id?: string) => ({update: mockAdminFirestoreUpdate}));
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
}));

interface MockOnCallHandler {
  (optionsOrHandler: unknown, handler?: unknown): unknown;
}

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: jest.fn(((optionsOrHandler: unknown, handler?: unknown) => {
      // Handle both signatures: onCall(handler) and onCall(options, handler)
      if (typeof optionsOrHandler === "function") {
        return optionsOrHandler; // Single argument: onCall(handler)
      }
      return handler; // Two arguments: onCall(options, handler)
    }) as MockOnCallHandler),
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

  describe("updateAvatar", () => {
    const mockAuth = {uid: "testUserId456"};
    const validAvatarUrl = "https://example.com/avatar.png";

    it("should successfully update avatar URL", async () => {
      mockUpdateUserProfile.mockResolvedValue(undefined);
      const request = {
        auth: mockAuth,
        data: {avatarUrl: validAvatarUrl},
      } as CallableRequest<{avatarUrl: string}>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (updateAvatar as any)(request);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockAuth.uid, {avatarUrl: validAvatarUrl});
      expect(result).toEqual({success: true, message: "Avatar URL updated successfully."});
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        `Updating avatar URL for user: ${mockAuth.uid} with ${validAvatarUrl}`,
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(`User ${mockAuth.uid} avatar URL updated successfully.`);
    });

    it("should throw HttpsError if not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {avatarUrl: validAvatarUrl},
      } as CallableRequest<{avatarUrl: string}>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((updateAvatar as any)(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw HttpsError for invalid avatar URL (missing)", async () => {
      const request = {
        auth: mockAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {avatarUrl: undefined as any},
      } as CallableRequest<{avatarUrl: string}>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((updateAvatar as any)(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });

    it("should throw HttpsError for invalid avatar URL (not a string)", async () => {
      const request = {
        auth: mockAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {avatarUrl: 123 as any},
      } as CallableRequest<{avatarUrl: string}>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((updateAvatar as any)(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });

    it("should throw HttpsError and log error if updateUserProfile service fails", async () => {
      const serviceError = new Error("Service call failed");
      mockUpdateUserProfile.mockRejectedValue(serviceError);
      const request = {
        auth: mockAuth,
        data: {avatarUrl: validAvatarUrl},
      } as CallableRequest<{avatarUrl: string}>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((updateAvatar as any)(request)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while updating avatar URL.", serviceError),
      );
      expect(mockLoggerError).toHaveBeenCalledWith(`Error updating avatar URL for user ${mockAuth.uid}:`, serviceError);
    });
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
});
