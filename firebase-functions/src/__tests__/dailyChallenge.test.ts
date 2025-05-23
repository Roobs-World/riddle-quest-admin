import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import * as functions from "firebase-functions";
import {HttpsError, CallableRequest, HttpsOptions} from "firebase-functions/v2/https";
// import {logger as functionsLogger} from "firebase-functions/v2"; // Not used in this file's current state

// Original imports from SUT needed for typing the dynamically imported versions
import type * as OriginalDailyChallenge from "../dailyChallenge";

// Original imports from mocked services for typing
import type {
  updateUserLastCompletedDailyChallengeDate as originalUpdateUserDate,
  getUser as originalGetUser,
} from "../firestoreService";
import {PlayerSchema, PlayerStatsSchema, PlayerProgressSchema, Player} from "../validation/firestoreSchemas"; // Import Zod schemas AND Player type

// --- Mocks Start ---
jest.mock("../firestoreService", () => ({
  updateUserLastCompletedDailyChallengeDate: jest.fn(),
  getUser: jest.fn(),
}));

jest.mock("firebase-functions", () => {
  const actual = jest.requireActual("firebase-functions") as typeof functions;
  return {
    ...actual,
    logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
    https: {...actual.https, HttpsError: actual.https.HttpsError}, // Ensure HttpsError is from v1 for v1 functions
    config: () => ({}),
  };
});

jest.mock("firebase-functions/v2", async () => {
  const actualV2 = await jest.requireActual<typeof import("firebase-functions/v2")>("firebase-functions/v2");
  // Provide a more complete mock for v2 https if hasCompletedDailyChallenge uses HttpsErrorV2 or other v2 features
  const actualV2Https =
    await jest.requireActual<typeof import("firebase-functions/v2/https")>("firebase-functions/v2/https");
  return {
    ...actualV2,
    logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()}, // v2 logger
    https: {
      // Mock for v2 https
      ...actualV2Https,
      onCall: jest.fn(), // Placeholder, will be refined in describe block for hasCompletedDailyChallenge
      HttpsError: actualV2Https.HttpsError, // v2 HttpsError
    },
  };
});
// --- Mocks End ---

interface MockHasCompletedDailyChallengeData {
  id: string;
}

let setCompletedDailyChallenge: typeof OriginalDailyChallenge.setCompletedDailyChallenge;

const getDefaultPlayer = (userId: string, overrides: Partial<Player> = {}): Player => {
  const now = Date.now();
  return PlayerSchema.parse({
    userId,
    email: `${userId}@example.com`,
    username: userId,
    displayName: userId,
    avatarUrl: `http://example.com/avatar/${userId}.png`,
    xp: 0,
    coins: 100,
    createdAt: now,
    registeredAt: now,
    lastLogin: now,
    lastDailyChallengeCompletedAt: undefined,
    stats: PlayerStatsSchema.parse({}), // Use Zod schema to get defaults
    progress: PlayerProgressSchema.parse({}), // Use Zod schema to get defaults
    ...overrides,
  });
};

describe("Daily Challenge Functions", () => {
  let mockUpdateUserLastCompletedDailyChallengeDate: jest.MockedFunction<typeof originalUpdateUserDate>;
  let mockGetUser: jest.MockedFunction<typeof originalGetUser>;
  let mockFirebaseFunctionsV1: {
    logger: {error: jest.MockedFunction<(message?: any, ...optionalParams: any[]) => void>};
    https: {HttpsError: typeof functions.https.HttpsError};
  };

  beforeEach(() => {
    jest.resetModules();
    const dailyChallengeModule = require("../dailyChallenge") as typeof OriginalDailyChallenge;
    setCompletedDailyChallenge = dailyChallengeModule.setCompletedDailyChallenge;

    const mockFsService = jest.requireMock("../firestoreService") as {
      updateUserLastCompletedDailyChallengeDate: jest.MockedFunction<typeof originalUpdateUserDate>;
      getUser: jest.MockedFunction<typeof originalGetUser>;
    };
    mockUpdateUserLastCompletedDailyChallengeDate = mockFsService.updateUserLastCompletedDailyChallengeDate;
    mockGetUser = mockFsService.getUser;

    mockFirebaseFunctionsV1 = jest.requireMock("firebase-functions") as {
      logger: {error: jest.MockedFunction<(message?: any, ...optionalParams: any[]) => void>};
      https: {HttpsError: typeof functions.https.HttpsError};
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("setCompletedDailyChallenge (v1)", () => {
    it("should throw HttpsError if not authenticated", async () => {
      const mockRequest = {auth: undefined, data: {}} as functions.https.CallableRequest;
      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new mockFirebaseFunctionsV1.https.HttpsError(
          "unauthenticated",
          "The user must be authenticated to set completed daily challenge.",
        ),
      );
      expect(mockUpdateUserLastCompletedDailyChallengeDate).not.toHaveBeenCalled();
    });

    it("should call updateUserLastCompletedDailyChallengeDate and return success if authenticated", async () => {
      const mockUserId = "testUser123";
      const mockRequest = {auth: {uid: mockUserId}, data: {}} as functions.https.CallableRequest;
      mockUpdateUserLastCompletedDailyChallengeDate.mockResolvedValue(undefined);
      const expectedIsoDate = "2023-01-01T12:00:00.000Z";
      const dateSpy = jest
        .spyOn(global, "Date")
        .mockImplementation(() => ({toISOString: () => expectedIsoDate}) as Date);
      const result = await setCompletedDailyChallenge(mockRequest);
      expect(mockUpdateUserLastCompletedDailyChallengeDate).toHaveBeenCalledWith(mockUserId, expectedIsoDate);
      expect(result).toEqual({message: "Last completed daily challenge date set successfully."});
      dateSpy.mockRestore();
    });

    it("should throw internal HttpsError if updateUserLastCompletedDailyChallengeDate fails", async () => {
      const mockUserId = "testUser123";
      const mockRequest = {auth: {uid: mockUserId}, data: {}} as functions.https.CallableRequest;
      const dbError = new Error("Database update failed");
      mockUpdateUserLastCompletedDailyChallengeDate.mockRejectedValue(dbError);
      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new mockFirebaseFunctionsV1.https.HttpsError(
          "internal",
          "An error occurred while setting completed daily challenge.",
        ),
      );
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Error setting completed daily challenge:",
        dbError,
      );
    });
  });

  describe("hasCompletedDailyChallenge (v2)", () => {
    let actualV2OnCallHandler:
      | ((request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>)
      | null = null;
    beforeEach(() => {
      jest.resetModules(); // Reset again for v2 specific mock setup
      const actualV2Https = jest.requireActual(
        "firebase-functions/v2/https",
      ) as typeof import("firebase-functions/v2/https");
      jest.mock("firebase-functions/v2/https", () => ({
        ...actualV2Https,
        onCall: (
          optionsOrHandler:
            | HttpsOptions
            | ((request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>),
          handler?: (request: CallableRequest<MockHasCompletedDailyChallengeData>) => Promise<boolean>,
        ) => {
          actualV2OnCallHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
          // Return a jest.fn that calls the captured handler to simulate Firebase execution
          return jest.fn(async (request: CallableRequest<MockHasCompletedDailyChallengeData>) =>
            actualV2OnCallHandler!(request),
          );
        },
        HttpsError: actualV2Https.HttpsError, // Ensure v2 HttpsError is used
      }));
      // Re-require the SUT and mocked dependencies as resetModules clears them
      require("../dailyChallenge") as typeof OriginalDailyChallenge;
      const mockFsService = jest.requireMock("../firestoreService") as {
        updateUserLastCompletedDailyChallengeDate: jest.MockedFunction<typeof originalUpdateUserDate>;
        getUser: jest.MockedFunction<typeof originalGetUser>;
      };
      mockUpdateUserLastCompletedDailyChallengeDate = mockFsService.updateUserLastCompletedDailyChallengeDate;
      mockGetUser = mockFsService.getUser;
    });

    it("should return true if user completed challenge today", async () => {
      const mockUserId = "testUserToday";
      const today = new Date();
      const todayTimestamp = Math.floor(today.getTime() / 1000);
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: todayTimestamp}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;
      expect(actualV2OnCallHandler).not.toBeNull();
      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(true);
      expect(mockGetUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return false if user completed challenge yesterday", async () => {
      const mockUserId = "testUserYesterday";
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: yesterdayTimestamp}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;
      expect(actualV2OnCallHandler).not.toBeNull();
      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user has no lastDailyChallengeCompletedAt", async () => {
      const mockUserId = "testUserNever";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;
      expect(actualV2OnCallHandler).not.toBeNull();
      const result = await actualV2OnCallHandler!(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user is not found", async () => {
      const mockUserId = "testUserNotFound";
      mockGetUser.mockResolvedValue(null as any); // Simulate user not found
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;
      expect(actualV2OnCallHandler).not.toBeNull();
      await expect(actualV2OnCallHandler!(mockRequest)).rejects.toThrow(
        new HttpsError("not-found", `User ${mockUserId} not found.`),
      );
    });

    it("should throw internal error if getUser fails", async () => {
      const mockUserId = "testUserError";
      const dbError = new Error("DB fetch failed");
      mockGetUser.mockRejectedValue(dbError);
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;
      expect(actualV2OnCallHandler).not.toBeNull();
      await expect(actualV2OnCallHandler!(mockRequest)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while fetching user data."),
      );
    });
  });
});
