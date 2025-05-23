import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import * as admin from "firebase-admin"; // Needed for jest.mock
import * as functions from "firebase-functions"; // For HttpsError v1/v2
import {HttpsError, CallableRequest} from "firebase-functions/v2/https"; // Specifically for onCall v2 HttpsError
// import {logger as functionsLoggerV2} from "firebase-functions/v2"; // Unused, commented out

// Import the functions to test
import {getHint, spendCoins, skipRiddle} from "../gameLogic"; // Adjust path
import {updateUserCoins, getUser} from "../firestoreService"; // Mocked

// --- Mocks Start ---
jest.mock("../firestoreService", () => ({
  updateUserCoins: jest.fn(),
  getUser: jest.fn(),
}));

const mockFirestoreGet = jest.fn();
const mockFirestoreSet = jest.fn();
const mockFirestoreAdd = jest.fn(); // For functionCalls.add
const mockFirestoreDoc = jest.fn(() => ({
  get: mockFirestoreGet,
  set: mockFirestoreSet,
}));
const mockFirestoreCollection = jest.fn(() => ({
  doc: mockFirestoreDoc,
  where: jest.fn().mockReturnThis(), // For query chaining
  limit: jest.fn().mockReturnThis(), // For query chaining
  get: mockFirestoreGet, // For query.get()
  add: mockFirestoreAdd, // For collection.add()
}));

jest.mock("firebase-admin", async (modulePath: string) => {
  // modulePath is the path to 'firebase-admin'
  const actualAdmin = (await jest.requireActual(modulePath)) as any;
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: () => ({
      collection: mockFirestoreCollection,
      doc: mockFirestoreDoc,
      FieldValue: {
        serverTimestamp: () => new Date(), // Mock serverTimestamp
        increment: jest.fn((val: number) => `increment(${val})`), // Mock increment, typed val
      },
    }),
  };
});

// Mock for v1 and v2 logger/HttpsError (general)
jest.mock("firebase-functions", async (modulePath: string) => {
  // modulePath is path to 'firebase-functions'
  const actual = (await jest.requireActual(modulePath)) as any;
  return {
    ...actual,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    https: {
      ...actual.https,
      HttpsError: actual.https.HttpsError, // v1 HttpsError
    },
  };
});

// Explicit mock for v2 logger (used by onCall functions if they import logger from v2)
jest.mock("firebase-functions/v2", async (modulePath: string) => {
  // modulePath is path to 'firebase-functions/v2'
  const actual = (await jest.requireActual(modulePath)) as any;
  return {
    ...actual, // Includes HttpsError from v2/https
    logger: {
      ...actual.logger, // Spread existing logger properties if any
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(), // Add other logger methods if used
    },
    https: {
      ...actual.https, // Spread existing https properties if any
      HttpsError: actual.https.HttpsError, // Ensure v2 HttpsError is correctly passed
    },
  };
});
// --- Mocks End ---

// Define a type for the mock callable context (simplified)
interface MockCallableContext {}

// Define types for request data
interface GetHintData {
  currentAttempt: string[];
  riddleId: string;
}

interface SpendCoinsData {
  amount: number;
  reason: string;
}

interface SkipRiddleData {
  gameMode: string;
  riddleId: string;
}

describe("Game Logic Functions", () => {
  const mockUserId = "testUser123";
  const mockContext = {} as MockCallableContext;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all specific firestore mocks
    mockFirestoreGet.mockReset();
    mockFirestoreSet.mockReset();
    mockFirestoreAdd.mockReset();
    mockFirestoreDoc.mockImplementation(() => ({get: mockFirestoreGet, set: mockFirestoreSet}));
    mockFirestoreCollection.mockImplementation(() => ({
      doc: mockFirestoreDoc,
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: mockFirestoreGet,
      add: mockFirestoreAdd,
    }));
    (getUser as ReturnType<typeof jest.fn>).mockReset();
    (updateUserCoins as ReturnType<typeof jest.fn>).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getHint", () => {
    const riddleId = "riddle1";
    const mockRiddle = {answer: "apple"};
    const coinsCost = 50;

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {currentAttempt: [], riddleId},
      } as any as CallableRequest<GetHintData>;
      await expect(getHint(request, mockContext)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to get a hint."),
      );
    });

    it("should throw not-found if riddle does not exist", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: false} as never); // Riddle doc
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
      } as any as CallableRequest<GetHintData>;
      await expect(getHint(request, mockContext)).rejects.toThrow(
        new HttpsError("not-found", `Riddle with ID ${riddleId} not found.`),
      );
    });

    it("should throw internal if riddle has no answer", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => ({text: "A riddle"})} as never); // Riddle doc with no answer
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
      } as any as CallableRequest<GetHintData>;
      await expect(getHint(request, mockContext)).rejects.toThrow(
        new HttpsError("internal", `Answer not found for riddle ID ${riddleId}.`),
      );
    });

    it("should throw not-found if user data not found", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle doc
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
      } as any as CallableRequest<GetHintData>;
      await expect(getHint(request, mockContext)).rejects.toThrow(new HttpsError("not-found", "User data not found."));
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never);
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10} as any);
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
      } as any as CallableRequest<GetHintData>;
      await expect(getHint(request, mockContext)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to get a hint."),
      );
    });

    it("should throw failed-precondition if game is already completed", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost} as any); // User
      mockFirestoreGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({isCompleted: true, hintRevealedIndices: []}),
      } as never); // Game state
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: Array(5).fill(""), riddleId},
      } as any as CallableRequest<GetHintData>;

      await expect(getHint(request, mockContext)).rejects.toThrow(
        new HttpsError("failed-precondition", "Game is already completed."),
      );
    });

    it("should reveal a hint, deduct coins, and update game state", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as any); // User
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => ({hintRevealedIndices: []})} as never); // Game state
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreSet.mockResolvedValueOnce(undefined); // Game state update

      const currentAttempt = ["a", "", "", "l", ""]; // Example: a _ _ l _ for apple
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt, riddleId},
      } as any as CallableRequest<GetHintData>;

      const result = await getHint(request, mockContext);

      expect(result).toEqual({
        revealedLetter: "P", // Second letter of apple
        index: 1,
        coinsCost,
      });
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost);
      expect(mockFirestoreSet).toHaveBeenCalledWith({hintRevealedIndices: [1]}, {merge: true});
      expect(functions.logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} used a hint for riddle ${riddleId}, revealing letter P at index 1.`,
      );
    });

    it("should return null if no hint is available (all letters guessed or revealed)", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost} as any); // User
      // Game state: all letters of 'apple' are either guessed or revealed
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => ({hintRevealedIndices: [1, 3]})} as never);
      const currentAttempt = ["a", "p", "p", "l", "e"]; // Correct guess or already revealed
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt, riddleId},
      } as any as CallableRequest<GetHintData>;

      const result = await getHint(request, mockContext);
      expect(result).toBeNull();
      expect(updateUserCoins).not.toHaveBeenCalled();
      expect(mockFirestoreSet).not.toHaveBeenCalled();
    });
  });

  describe("spendCoins", () => {
    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {amount: 50, reason: "hint"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("unauthenticated", "The function must be called while authenticated."),
      );
    });

    it("should throw invalid-argument for invalid amount", async () => {
      let request = {
        auth: {uid: mockUserId},
        data: {amount: 0, reason: "hint"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount specified."),
      );
      request = {
        auth: {uid: mockUserId},
        data: {amount: -10, reason: "hint"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount specified."),
      );
    });

    it("should throw invalid-argument for invalid reason", async () => {
      const request = {
        auth: {uid: mockUserId},
        data: {amount: 50, reason: "purchase_unicorn"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid reason specified."),
      );
    });

    it("should deduct coins and return new balance", async () => {
      const amountToSpend = 50;
      const initialCoins = 100;
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins - amountToSpend} as any);
      const request = {
        auth: {uid: mockUserId},
        data: {amount: amountToSpend, reason: "skip"},
      } as any as CallableRequest<SpendCoinsData>;

      const result = await spendCoins(request, mockContext);

      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -amountToSpend);
      expect(getUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({newCoins: initialCoins - amountToSpend});
      expect(functions.logger.info).toHaveBeenCalledWith(`User ${mockUserId} spent ${amountToSpend} coins for skip.`);
    });

    it("should throw internal if updateUserCoins fails and rethrows HttpsError", async () => {
      const httpError = new HttpsError("failed-precondition", "Insufficient funds from service");
      (updateUserCoins as ReturnType<typeof jest.fn>).mockRejectedValueOnce(httpError);
      const request = {
        auth: {uid: mockUserId},
        data: {amount: 50, reason: "hint"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(httpError);
    });

    it("should throw internal if updateUserCoins fails with generic error", async () => {
      (updateUserCoins as ReturnType<typeof jest.fn>).mockRejectedValueOnce(new Error("Update failed"));
      const request = {
        auth: {uid: mockUserId},
        data: {amount: 50, reason: "hint"},
      } as any as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while spending coins."),
      );
    });
  });

  describe("skipRiddle", () => {
    const riddleId = "classicRiddle1";
    const gameMode = "Classic";
    const coinsCost = 50;

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = {auth: undefined, data: {gameMode, riddleId}} as any as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle."),
      );
    });

    it("should throw not-found if user data not found", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);
      const request = {
        auth: {uid: mockUserId},
        data: {gameMode, riddleId},
      } as any as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("not-found", "User data not found."),
      );
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10} as any);
      const request = {
        auth: {uid: mockUserId},
        data: {gameMode, riddleId},
      } as any as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to skip the riddle."),
      );
    });

    it("should successfully skip to next riddle, deduct coins", async () => {
      const currentRiddleData = {classicIndex: 1, answer: "current", text: "q1"};
      const nextRiddleData = {classicIndex: 2, answer: "nextone", text: "q2"};
      const nextRiddleId = "classicRiddle2";

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock current riddle fetch
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => currentRiddleData} as never);
      // Mock next riddle fetch
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{id: nextRiddleId, data: () => nextRiddleData} as any],
      } as never);

      const request = {
        auth: {uid: mockUserId},
        data: {gameMode, riddleId},
      } as any as CallableRequest<SkipRiddleData>;
      const result = (await skipRiddle(request, mockContext)) as any;

      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost);
      expect(result).toEqual({
        newRiddleIndex: nextRiddleData.classicIndex,
        newQuestion: nextRiddleData.text,
        newAnswerLength: nextRiddleData.answer.length,
        coinsCost,
        newRiddleId: nextRiddleId,
      });
      expect(functions.logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} skipped riddle ${riddleId} in ${gameMode} mode. New riddle: ${nextRiddleId}`,
      );
    });

    it("should log trigger for riddle generation if no next riddle exists", async () => {
      const currentRiddleData = {classicIndex: 1, answer: "current"};
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => currentRiddleData} as never); // Current riddle
      mockFirestoreGet.mockResolvedValueOnce({empty: true, docs: []} as never); // No next riddle
      mockFirestoreAdd.mockResolvedValueOnce(undefined); // functionCalls.add

      const request = {
        auth: {uid: mockUserId},
        data: {gameMode, riddleId},
      } as any as CallableRequest<SkipRiddleData>;
      const result = await skipRiddle(request, mockContext);

      expect(result).toBeNull(); // Or specific error/message indicating no new riddle
      expect(functions.logger.info).toHaveBeenCalledWith(
        `End of available classic riddles for user ${mockUserId} at index ${currentRiddleData.classicIndex}. Triggering generation.`,
      );
      expect(mockFirestoreAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "generateClassicRiddles",
          status: "requested",
        }),
      );
    });

    it("should throw not-found if current riddle does not exist for skip", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined); // Coins deducted before check
      mockFirestoreGet.mockResolvedValueOnce({exists: false} as never); // Current riddle not found

      const request = {
        auth: {uid: mockUserId},
        data: {gameMode, riddleId},
      } as any as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("not-found", "Current riddle not found."),
      );
    });
  });
});
