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

jest.mock("firebase-admin", async () => {
  // Simplified mock to avoid type issues with modulePath
  return {
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
jest.mock("firebase-functions", async () => {
  // Simplified mock to avoid type issues with modulePath
  return {
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
jest.mock("firebase-functions/v2", async () => {
  // Simplified mock to avoid type issues with modulePath
  return {
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
    const amountToSpend = 50;
    const reason = "skip riddle";

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {amount: amountToSpend, reason},
      } as unknown as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to spend coins."),
      );
    });

    it("should throw invalid-argument if amount is invalid", async () => {
      const auth = {uid: mockUserId} as any;

      // Test negative amount
      let request = {
        auth,
        data: {amount: -amountToSpend, reason},
      } as unknown as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount."),
      );

      // Test zero amount
      request = {
        auth,
        data: {amount: 0, reason},
      } as unknown as CallableRequest<SpendCoinsData>;
      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid amount."),
      );
    });

    it("should throw not-found if user data not found", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
      } as unknown as CallableRequest<SpendCoinsData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);

      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("not-found", "User data not found."),
      );
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
      } as unknown as CallableRequest<SpendCoinsData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: amountToSpend - 10} as any);

      await expect(spendCoins(request, mockContext)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins."),
      );
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should successfully deduct coins and return new balance", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
      } as unknown as CallableRequest<SpendCoinsData>;

      const initialCoins = 100;
      const expectedCoinsAfterSpend = initialCoins - amountToSpend;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock getUser a second time to return the updated coin balance after updateUserCoins is called
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: expectedCoinsAfterSpend} as any);

      const result = await spendCoins(request, mockContext);

      expect(result).toEqual({newCoinBalance: expectedCoinsAfterSpend});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -amountToSpend); // Verify negative amount is passed
      expect(functions.logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} spent ${amountToSpend} coins for reason: ${reason}. New balance: ${expectedCoinsAfterSpend}.`,
      );
    });
  });

  describe("skipRiddle", () => {
    const gameMode = "classic";
    const riddleId = "riddle2";
    const coinsCost = 50;

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = {
        auth: undefined,
        data: {gameMode, riddleId},
      } as unknown as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("unauthenticated", "The user must be authenticated to skip a riddle."),
      );
    });

    it("should throw invalid-argument if game mode is invalid", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode: "invalid_mode", riddleId},
      } as unknown as CallableRequest<SkipRiddleData>;
      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("invalid-argument", "Invalid game mode specified."),
      );
    });

    it("should throw not-found if user data not found", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
      } as unknown as CallableRequest<SkipRiddleData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);

      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("not-found", "User data not found."),
      );
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
      } as unknown as CallableRequest<SkipRiddleData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10} as any);

      await expect(skipRiddle(request, mockContext)).rejects.toThrow(
        new HttpsError("failed-precondition", "Insufficient coins to skip riddle."),
      );
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should successfully skip a riddle and deduct coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
      } as unknown as CallableRequest<SkipRiddleData>;

      const initialCoins = 100;
      const expectedCoinsAfterSkip = initialCoins - coinsCost;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock getUser a second time to return the updated coin balance after updateUserCoins is called
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: expectedCoinsAfterSkip} as any);
      mockFirestoreSet.mockResolvedValueOnce(undefined); // Simulate game state update

      const result = await skipRiddle(request, mockContext);

      expect(result).toEqual({success: true, newCoinBalance: expectedCoinsAfterSkip});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost); // Verify coins are deducted
      // Verify game state is updated to mark the riddle as skipped
      expect(mockFirestoreSet).toHaveBeenCalledWith({isSkipped: true}, {merge: true});
      expect(functions.logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} skipped riddle ${riddleId} in ${gameMode} mode. Cost: ${coinsCost}. New balance: ${expectedCoinsAfterSkip}.`,
      );
    });
  });
});
