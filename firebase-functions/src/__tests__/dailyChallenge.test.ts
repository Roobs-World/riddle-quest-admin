import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import * as functions from "firebase-functions";
import {HttpsError, CallableRequest, HttpsOptions} from "firebase-functions/v2/https"; // For onCall
import {logger as functionsLogger} from "firebase-functions/v2"; // For onCall logger

// Import the functions to test
import {setCompletedDailyChallenge /* hasCompletedDailyChallenge - removed */} from "../dailyChallenge"; // Adjust path
import {updateUserLastCompletedDailyChallengeDate, getUser} from "../firestoreService"; // Mocked

// --- Mocks Start ---
jest.mock("../firestoreService", () => ({
  updateUserLastCompletedDailyChallengeDate: jest.fn(),
  getUser: jest.fn(),
}));

// Mock for v1 functions (setCompletedDailyChallenge)
jest.mock("firebase-functions", async () => {
  const actual = await jest.requireActual<typeof functions>("firebase-functions");
  return {
    ...actual,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    https: {
      ...actual.https,
      HttpsError: actual.https.HttpsError, // Ensure HttpsError is available for v1
    },
  };
});

// Mock for v2 logger (hasCompletedDailyChallenge)
jest.mock("firebase-functions/v2", async () => {
  const actual = await jest.requireActual<typeof import("firebase-functions/v2")>("firebase-functions/v2");
  return {
    ...actual,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    // onCall will be tested by directly invoking the handler
  };
});
// --- Mocks End ---

// Define a type for the v2 mock request data
interface MockHasCompletedDailyChallengeData {
  id: string;
}

describe("Daily Challenge Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("setCompletedDailyChallenge", () => {
    it("should throw HttpsError if not authenticated", async () => {
      const mockRequest = {
        auth: undefined,
        data: {},
      } as functions.https.CallableRequest;
      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new functions.https.HttpsError(
          "unauthenticated",
          "The user must be authenticated to set completed daily challenge.",
        ),
      );
      expect(updateUserLastCompletedDailyChallengeDate).not.toHaveBeenCalled();
    });

    it("should call updateUserLastCompletedDailyChallengeDate and return success if authenticated", async () => {
      const mockUserId = "testUser123";
      const mockRequest = {
        auth: {uid: mockUserId},
        data: {},
      } as functions.https.CallableRequest;
      (updateUserLastCompletedDailyChallengeDate as ReturnType<typeof jest.fn>).mockResolvedValue(undefined);
      const expectedIsoDate = "2023-01-01T12:00:00.000Z";
      // Keep the original Date spy for now, address 'any' in a later step if needed
      const dateSpy = jest.spyOn(global, "Date").mockImplementation(
        () =>
          ({
            toISOString: () => expectedIsoDate,
          }) as Date,
      );

      const result = await setCompletedDailyChallenge(mockRequest);

      expect(updateUserLastCompletedDailyChallengeDate).toHaveBeenCalledWith(
        mockUserId,
        expectedIsoDate, // Verify specific date string
      );
      expect(result).toEqual({message: "Last completed daily challenge date set successfully."});
      dateSpy.mockRestore(); // Clean up the spy
    });

    it("should throw internal HttpsError if updateUserLastCompletedDailyChallengeDate fails", async () => {
      const mockUserId = "testUser123";
      const mockRequest = {
        auth: {uid: mockUserId},
        data: {},
      } as functions.https.CallableRequest;
      const dbError = new Error("Database update failed");
      (updateUserLastCompletedDailyChallengeDate as ReturnType<typeof jest.fn>).mockRejectedValue(dbError);

      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new functions.https.HttpsError(
          "internal",
          "An error occurred while setting completed daily challenge.",
          // dbError // HttpsError v1 doesn't seem to propagate the third arg like this in tests
        ),
      );
      // Check if the original error was logged
      expect(functions.logger.error).toHaveBeenCalledWith("Error setting completed daily challenge:", dbError);
    });
  });

  describe("hasCompletedDailyChallenge", () => {
    let actualV2OnCallHandler:
      | ((request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>)
      | null = null;

    beforeEach(() => {
      jest.resetModules(); // Reset modules before re-requiring
      const httpsV2 = jest.requireActual("firebase-functions/v2/https") as Record<string, unknown>;

      jest.mock("firebase-functions/v2/https", () => ({
        ...httpsV2,
        onCall: (
          optionsOrHandler:
            | HttpsOptions
            | ((request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>),
          handler?: (request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>,
        ) => {
          actualV2OnCallHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
          return jest.fn(async (request: CallableRequest<MockHasCompletedDailyChallengeData>) =>
            actualV2OnCallHandler!(request),
          );
        },
      }));
      // Re-require dailyChallenge to apply the new mock for onCall
      // The specific function is extracted from the module after it's loaded with mocks.
      void import("../dailyChallenge.js");
      // Note: hasCompletedDailyChallenge itself is an HttpsFunction.
      // The actual handler is captured by actualV2OnCallHandler.
    });

    it("should return true if user completed challenge today", async () => {
      const mockUserId = "testUserToday";
      const today = new Date();
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue({
        userId: mockUserId,
        lastDailyChallengeCompletedAt: today.toISOString(),
        // Add other required Player fields if getUser returns a full Player object
        username: "test",
        xp: 0,
        coins: 0,
        progress: {},
        stats: {},
      });
      const mockRequest = {
        data: {id: mockUserId},
      } as CallableRequest<MockHasCompletedDailyChallengeData>;

      expect(actualV2OnCallHandler).not.toBeNull();
      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(true);
      expect(getUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return false if user completed challenge on a different day", async () => {
      const mockUserId = "testUserYesterday";
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue({
        userId: mockUserId,
        lastDailyChallengeCompletedAt: yesterday.toISOString(),
        username: "test",
        xp: 0,
        coins: 0,
        progress: {},
        stats: {},
      });
      const mockRequest = {
        data: {id: mockUserId},
      } as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user has no lastDailyChallengeCompletedAt", async () => {
      const mockUserId = "testUserNever";
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue({
        userId: mockUserId,
        lastDailyChallengeCompletedAt: null, // or undefined
        username: "test",
        xp: 0,
        coins: 0,
        progress: {},
        stats: {},
      });
      const mockRequest = {
        data: {id: mockUserId},
      } as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user is not found", async () => {
      const mockUserId = "testUserNotFound";
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(undefined);
      const mockRequest = {
        data: {id: mockUserId},
      } as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(false);
    });

    it("should throw HttpsError (v2) if getUser fails", async () => {
      const mockUserId = "testUserError";
      const dbError = new Error("DB fetch failed");
      (getUser as ReturnType<typeof jest.fn>).mockRejectedValue(dbError);
      const mockRequest = {
        data: {id: mockUserId},
      } as CallableRequest<MockHasCompletedDailyChallengeData>;
      // const mockV2Context = {}; // Ensured removed

      expect(actualV2OnCallHandler).not.toBeNull();
      await expect(actualV2OnCallHandler!(mockRequest)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while checking daily challenge status."),
      );
      // Check if the original error was logged using the v2 logger mock
      // This requires functionsLogger to be mocked correctly for v2 calls
      expect(functionsLogger.error).toHaveBeenCalledWith("Error checking daily challenge status:", dbError);
    });
  });
});
