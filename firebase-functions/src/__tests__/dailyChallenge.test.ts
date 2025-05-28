import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

// --- Mocks Start (must be before imports) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

jest.mock("firebase-functions", () => {
  const actual = jest.requireActual("firebase-functions") as any;
  return {
    ...actual,
    logger: mockLogger,
    https: {...actual.https, HttpsError: actual.https.HttpsError},
    config: () => ({}),
  };
});

jest.mock("../firestoreService", () => ({
  updateUserLastCompletedDailyChallengeDate: jest.fn(),
  getUser: jest.fn(),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({doc: jest.fn()})),
  })),
}));

// Simple mock for firebase-functions/v2/https that returns the handler directly
jest.mock("firebase-functions/v2/https", () => {
  const actualHttps = jest.requireActual("firebase-functions/v2/https") as any;
  return {
    HttpsError: actualHttps.HttpsError,
    onCall: jest.fn((options: any, handler: any) => {
      // Return the handler directly so we can test it
      return handler;
    }),
  };
});
// --- Mocks End ---

import * as functions from "firebase-functions";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Original imports from mocked services for typing
import type {
  updateUserLastCompletedDailyChallengeDate as originalUpdateUserDate,
  getUser as originalGetUser,
} from "../firestoreService";
import {PlayerSchema, PlayerStatsSchema, PlayerProgressSchema, Player} from "../validation/firestoreSchemas";

interface MockHasCompletedDailyChallengeData {
  id: string;
}

interface MockSetCompletedDailyChallengeData {
  // No specific data required for setCompletedDailyChallenge
}

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
    stats: PlayerStatsSchema.parse({}),
    progress: PlayerProgressSchema.parse({}),
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
  let setCompletedDailyChallenge: any;
  let hasCompletedDailyChallenge: any;

  beforeEach(() => {
    jest.resetModules();

    // Import the module to get the functions
    const dailyChallengeModule = require("../dailyChallenge");
    setCompletedDailyChallenge = dailyChallengeModule.setCompletedDailyChallenge;
    hasCompletedDailyChallenge = dailyChallengeModule.hasCompletedDailyChallenge;

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
    Object.values(mockLogger).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("setCompletedDailyChallenge (v2)", () => {
    it("should throw HttpsError if not authenticated", async () => {
      const mockRequest = {auth: undefined, data: {}} as CallableRequest<MockSetCompletedDailyChallengeData>;
      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to set completed daily challenge."),
      );
      expect(mockUpdateUserLastCompletedDailyChallengeDate).not.toHaveBeenCalled();
    });

    it("should call updateUserLastCompletedDailyChallengeDate and return success if authenticated", async () => {
      const mockUserId = "testUser123";
      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<MockSetCompletedDailyChallengeData>;
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
      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<MockSetCompletedDailyChallengeData>;
      const dbError = new Error("Database update failed");
      mockUpdateUserLastCompletedDailyChallengeDate.mockRejectedValue(dbError);

      await expect(setCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while setting completed daily challenge."),
      );
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Error setting completed daily challenge:",
        dbError,
      );
    });
  });

  describe("hasCompletedDailyChallenge (v2)", () => {
    it("should return true if user completed challenge today", async () => {
      const mockUserId = "testUserToday";
      const today = new Date();
      const todayTimestamp = today.getTime(); // Use milliseconds, not seconds
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: todayTimestamp}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(true);
      expect(mockGetUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return false if user completed challenge yesterday", async () => {
      const mockUserId = "testUserYesterday";
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayTimestamp = yesterday.getTime(); // Use milliseconds, not seconds
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: yesterdayTimestamp}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user has no lastDailyChallengeCompletedAt", async () => {
      const mockUserId = "testUserNever";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined}));
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(false);
    });

    it("should return false if user is not found", async () => {
      const mockUserId = "testUserNotFound";
      mockGetUser.mockResolvedValue(null as any);
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(false);
    });

    it("should throw internal error if getUser fails", async () => {
      const mockUserId = "testUserError";
      const dbError = new Error("DB fetch failed");
      mockGetUser.mockRejectedValue(dbError);
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      await expect(hasCompletedDailyChallenge(mockRequest)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while checking daily challenge status."),
      );
    });
  });
});
