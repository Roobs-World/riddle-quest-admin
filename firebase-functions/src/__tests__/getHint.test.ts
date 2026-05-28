/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// Mocks for firebase admin and functions
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: () => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => ({exists: false, data: () => undefined})),
        set: jest.fn(async () => undefined),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn(() => ({exists: false, data: () => undefined})),
            set: jest.fn(async () => undefined),
          })),
        })),
      })),
    })),
    FieldValue: {increment: (v: number) => v},
  }),
}));

// Mock the onCall wrapper to return the handler so we can call it directly
jest.mock("firebase-functions/v2/https", () => {
  const actual = jest.requireActual("firebase-functions/v2/https") as any;
  return {
    onCall: jest.fn((optionsOrHandler: unknown, handler?: unknown) => {
      if (typeof optionsOrHandler === "function") return optionsOrHandler;
      return handler;
    }),
    HttpsError: actual.HttpsError,
  };
});

// Mock dependent services
const mockGetUser = jest.fn();
const mockUpdateUserCoins = jest.fn();
const mockUpdateUserStats = jest.fn();
const mockGetRiddleByGameMode = jest.fn();

jest.mock("../firestoreService", () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
  updateUserCoins: (...args: any[]) => mockUpdateUserCoins(...args),
  updateUserStats: (...args: any[]) => mockUpdateUserStats(...args),
  getRiddleByGameMode: (...args: any[]) => mockGetRiddleByGameMode(...args),
}));

const mockEvaluateAchievements = jest.fn();
jest.mock("../achievements", () => ({
  evaluateAchievements: (...args: any[]) => mockEvaluateAchievements(...args),
}));

// Import the function under test
import {getHint} from "../gameLogic";
import {HttpsError} from "firebase-functions/v2/https";
import {HINT_COST_COINS} from "../constants";

describe("getHint callable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reveals next unrevealed letter, deducts coins, increments stats and returns new balance", async () => {
    // Arrange
    const mockAuth = {uid: "user123"};
    const request = {
      auth: mockAuth,
      data: {riddleId: "rid-1", gameMode: "classic", currentAttempt: ["a", "p", "p", "z", "z"]},
    } as any;

    mockGetRiddleByGameMode.mockResolvedValueOnce({answer: "apple"});

    // initial user with enough coins
    mockGetUser.mockResolvedValueOnce({coins: 200});
    // final user after deduction
    mockGetUser.mockResolvedValueOnce({coins: 150});

    mockUpdateUserCoins.mockResolvedValue(undefined);
    mockUpdateUserStats.mockResolvedValue(undefined);
    mockEvaluateAchievements.mockResolvedValue(["hints_1"]);

    // Act
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    try {
      result = await (getHint as any)(request);
    } catch (err) {
      // Surface the error details for debugging then rethrow
      // eslint-disable-next-line no-console
      console.error("getHint test - caught error:", err);
      throw err;
    }

    // Assert
    // eslint-disable-next-line no-console
    console.log("getHint test - result:", result);
    expect(mockGetRiddleByGameMode).toHaveBeenCalledWith("rid-1", "classic");
    expect(mockUpdateUserCoins).toHaveBeenCalledWith("user123", -HINT_COST_COINS);
    expect(mockEvaluateAchievements).toHaveBeenCalledWith("user123", expect.any(Object));
    expect(result).toBeDefined();
    expect(result.revealedLetter).toBe("L");
    expect(result.index).toBe(3);
    expect(result.coinsCost).toBe(HINT_COST_COINS);
    expect(result.newCoins).toBe(150);
    expect(result.newlyUnlockedAchievementIds).toEqual(["hints_1"]);
  });

  it("throws failed-precondition when user has insufficient coins", async () => {
    const mockAuth = {uid: "userLow"};
    const request = {auth: mockAuth, data: {riddleId: "rid-2", gameMode: "classic", currentAttempt: []}} as any;

    mockGetRiddleByGameMode.mockResolvedValueOnce({answer: "cat"});
    mockGetUser.mockResolvedValueOnce({coins: 10});

    await expect((getHint as any)(request)).rejects.toThrow(HttpsError);
  });
});
