// 1. Mock const declarations
const mockUpdateUserProfile = jest.fn<(userId: string, profileData: any) => Promise<void>>(); // For firestoreService mock
const mockAdminFirestoreUpdate = jest.fn<() => Promise<void>>();
const mockAdminFirestoreDoc = jest.fn((_id?: string) => ({update: mockAdminFirestoreUpdate}));
const mockAdminFirestoreCollection = jest.fn((_path?: string) => ({doc: mockAdminFirestoreDoc}));

// Mock for console methods (these are the jest.fn() implementations)
const mockConsoleLogInternal = jest.fn<(...args: any[]) => void>();
const mockConsoleErrorInternal = jest.fn<(...args: any[]) => void>();

// 2. Jest/type imports
import {jest, describe, it, expect, beforeEach, afterEach} from "@jest/globals";
import * as adminTypes from "firebase-admin"; // For types, using adminTypes to avoid conflict if admin is imported later
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// 3. jest.mock() calls
jest.mock("../firestoreService", () => ({
  // This ensures that when firestoreService.updateUserProfile is called,
  // it delegates to the mockUpdateUserProfile defined in the outer scope.
  updateUserProfile: (...args: [string, any]) => mockUpdateUserProfile(...args),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: (path: string) => mockAdminFirestoreCollection(path),
  }),
  // Mock FieldValue if resetStats uses it directly (e.g. for timestamps)
  // If PlayerStatsSchema.parse({}) provides all defaults, this might not be needed here.
  // However, if server timestamps were used in reset, it would be:
  // FieldValue: { serverTimestamp: jest.fn() }
}));

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    onCall: jest.fn((optionsOrHandler: any, handler?: any) => {
      if (typeof optionsOrHandler === "function") return optionsOrHandler;
      return handler;
    }),
    HttpsError: actualV2Https.HttpsError,
  };
});

// 4. Import the module under test
import {resetStats, updateAvatar} from "../profile";

// 5. Describe block
describe("Profile Cloud Functions", () => {
  // Use correct type for spies: jest.SpiedFunction<typeof target>
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLogInternal.mockClear(); // Clear the internal jest.fn mocks too
    mockConsoleErrorInternal.mockClear();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(mockConsoleLogInternal);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(mockConsoleErrorInternal);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("resetStats", () => {
    const mockAuth = {uid: "testUserId123"};

    it("should successfully reset user stats", async () => {
      mockAdminFirestoreUpdate.mockResolvedValue(undefined);
      const request = {auth: mockAuth} as CallableRequest;
      const result = await resetStats(request);
      expect(mockAdminFirestoreCollection).toHaveBeenCalledWith("users");
      expect(mockAdminFirestoreDoc).toHaveBeenCalledWith(mockAuth.uid);
      expect(mockAdminFirestoreUpdate).toHaveBeenCalledWith({
        stats: {
          gamesPlayed: 0,
          wins: 0,
          totalWins: 0,
          winStreak: 0,
          bestStreak: 0,
          averageGuesses: 0,
          winRate: 0,
          challengeWins: 0,
          totalGuessesInWins: 0,
          dailyPuzzlesCompleted: 0,
          totalWordsGuessed: 0,
          totalScore: 0,
          highestLevelClassic: 0,
        },
      });
      expect(result).toEqual({success: true, message: "Stats reset successfully."});
      expect(consoleLogSpy).toHaveBeenCalledWith(`Resetting stats for user: ${mockAuth.uid}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`User ${mockAuth.uid} stats reset successfully.`);
    });

    it("should throw HttpsError if not authenticated", async () => {
      const request = {auth: undefined} as CallableRequest;
      await expect(resetStats(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw HttpsError and log error if Firestore update fails", async () => {
      const firestoreError = new Error("Firestore update failed");
      mockAdminFirestoreUpdate.mockRejectedValue(firestoreError);
      const request = {auth: mockAuth} as CallableRequest;
      await expect(resetStats(request)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while resetting stats.", firestoreError),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(`Error resetting stats for user ${mockAuth.uid}:`, firestoreError);
    });
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
      const result = await updateAvatar(request);
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(mockAuth.uid, {avatarUrl: validAvatarUrl});
      expect(result).toEqual({success: true, message: "Avatar URL updated successfully."});
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Updating avatar URL for user: ${mockAuth.uid} with ${validAvatarUrl}`,
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(`User ${mockAuth.uid} avatar URL updated successfully.`);
    });

    it("should throw HttpsError if not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {avatarUrl: validAvatarUrl},
      } as CallableRequest<{avatarUrl: string}>;
      await expect(updateAvatar(request)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw HttpsError for invalid avatar URL (missing)", async () => {
      const request = {
        auth: mockAuth,
        data: {avatarUrl: undefined as any},
      } as CallableRequest<{avatarUrl: string}>;
      await expect(updateAvatar(request)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid or missing avatar URL."),
      );
    });

    it("should throw HttpsError for invalid avatar URL (not a string)", async () => {
      const request = {
        auth: mockAuth,
        data: {avatarUrl: 123 as any},
      } as CallableRequest<{avatarUrl: string}>;
      await expect(updateAvatar(request)).rejects.toThrow(
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
      await expect(updateAvatar(request)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while updating avatar URL.", serviceError),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(`Error updating avatar URL for user ${mockAuth.uid}:`, serviceError);
    });
  });
});
