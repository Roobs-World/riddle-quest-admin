import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {HttpsError as HttpsErrorV2, CallableRequest} from "firebase-functions/v2/https"; // Specifically for onCall v2 HttpsError
import {logger} from "firebase-functions";
import {
  getHint as getHintOriginal,
  spendCoins as spendCoinsOriginal,
  skipRiddle as skipRiddleOriginal,
} from "../gameLogic";
import {updateUserCoins, getUser} from "../firestoreService";

// --- Mocks Start ---
jest.mock("../firestoreService.js", () => ({
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
jest.mock("firebase-functions", () => {
  const actual = jest.requireActual("firebase-functions") as typeof import("firebase-functions");
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    https: {
      ...(actual.https as object),
      HttpsError: actual.https.HttpsError,
    },
    config: () => ({}),
    params: {
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
  };
});

// Explicit mock for v2 logger (used by onCall functions if they import logger from v2)
jest.mock("firebase-functions/v2", () => {
  const actual = jest.requireActual("firebase-functions/v2") as typeof import("firebase-functions/v2");
  return {
    logger: {
      ...(actual.logger as object),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    https: {
      ...(actual.https as object),
      HttpsError: actual.https.HttpsError,
    },
    params: {
      defineString: jest.fn((name: string) => ({value: () => `mock-${name}`})),
      defineSecret: jest.fn((name: string) => ({value: () => `mock-secret-${name}`})),
    },
  };
});

jest.mock("firebase-functions/v2/https", () => {
  const actualV2Https = jest.requireActual(
    "firebase-functions/v2/https",
  ) as typeof import("firebase-functions/v2/https");
  return {
    ...actualV2Https,
    onCall: jest.fn((optionsOrHandler: any, handler?: any) => {
      if (typeof optionsOrHandler === "function") {
        return optionsOrHandler;
      }
      return handler;
    }),
  };
});
// --- Mocks End ---

// Define a type for the mock callable context (simplified)
// MockCallableContext removed as it was unused

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

// Define handler types based on function signatures and expected return values from tests
type GetHintHandler = (
  request: CallableRequest<GetHintData>,
) => Promise<{revealedLetter: string; index: number; coinsCost: number} | null>;
type SpendCoinsHandler = (request: CallableRequest<SpendCoinsData>) => Promise<{newCoinBalance: number}>;
type SkipRiddleHandler = (
  request: CallableRequest<SkipRiddleData>,
) => Promise<{success: boolean; newCoinBalance: number}>;

// Cast the imported functions to their handler types for use in tests
const getHint = getHintOriginal as unknown as GetHintHandler;
const spendCoins = spendCoinsOriginal as unknown as SpendCoinsHandler;
const skipRiddle = skipRiddleOriginal as unknown as SkipRiddleHandler;

describe("Game Logic Functions", () => {
  const mockUserId = "testUser123";

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
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("unauthenticated");
        expect(e.message).toBe("The user must be authenticated to get a hint.");
      }
    });

    it("should throw not-found if riddle does not exist", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: false} as never); // Riddle doc
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("not-found");
        expect(e.message).toBe(`Riddle with ID ${riddleId} not found.`);
      }
    });

    it("should throw internal if riddle has no answer", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => ({text: "A riddle"})} as never); // Riddle doc with no answer
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("internal");
        expect(e.message).toBe(`Answer not found for riddle ID ${riddleId}.`);
      }
    });

    it("should throw not-found if user data not found", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle doc
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("not-found");
        expect(e.message).toBe("User data not found.");
      }
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never);
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10} as any);
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt: [], riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("failed-precondition");
        expect(e.message).toBe("Insufficient coins to get a hint.");
      }
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
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;

      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("failed-precondition");
        expect(e.message).toBe("Game is already completed.");
      }
    });

    it("should reveal a hint, deduct coins, and update game state", async () => {
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => mockRiddle} as never); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as any); // User
      mockFirestoreGet.mockResolvedValueOnce({exists: true, data: () => ({hintRevealedIndices: []})} as never); // Game state
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreSet.mockResolvedValueOnce(undefined as never); // Game state update

      const currentAttempt = ["a", "", "", "l", ""]; // Example: a _ _ l _ for apple
      const request = {
        auth: {uid: mockUserId},
        data: {currentAttempt, riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;

      const result = await getHint(request);

      expect(result).toEqual({
        revealedLetter: "P", // Second letter of apple
        index: 1,
        coinsCost,
      });
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost);
      expect(mockFirestoreSet).toHaveBeenCalledWith({hintRevealedIndices: [1]}, {merge: true});
      expect(logger.info).toHaveBeenCalledWith(
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
        rawRequest: {headers: {}, body: {}} as any,
      } as any as CallableRequest<GetHintData>;

      const result = await getHint(request);
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
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("unauthenticated");
        expect(e.message).toBe("The user must be authenticated to spend coins.");
      }
    });

    it("should throw invalid-argument if amount is invalid", async () => {
      const auth = {uid: mockUserId} as any;

      // Test negative amount
      let request = {
        auth,
        data: {amount: -amountToSpend, reason},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("invalid-argument");
        expect(e.message).toBe("Invalid amount.");
      }

      // Test zero amount
      request = {
        auth,
        data: {amount: 0, reason},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("invalid-argument");
        expect(e.message).toBe("Invalid amount.");
      }
    });

    it("should throw not-found if user data not found", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("not-found");
        expect(e.message).toBe("User data not found.");
      }
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: amountToSpend - 10} as any);

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("failed-precondition");
        expect(e.message).toBe("Insufficient coins.");
      }
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should successfully deduct coins and return new balance", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {amount: amountToSpend, reason},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SpendCoinsData>;

      const initialCoins = 100;
      const expectedCoinsAfterSpend = initialCoins - amountToSpend;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock getUser a second time to return the updated coin balance after updateUserCoins is called
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: expectedCoinsAfterSpend} as any);

      const result = await spendCoins(request);

      expect(result).toEqual({newCoinBalance: expectedCoinsAfterSpend});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -amountToSpend); // Verify negative amount is passed
      expect(logger.info).toHaveBeenCalledWith(
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
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SkipRiddleData>;
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("unauthenticated");
        expect(e.message).toBe("The user must be authenticated to skip a riddle.");
      }
    });

    it("should throw invalid-argument if game mode is invalid", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode: "invalid_mode", riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SkipRiddleData>;
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("invalid-argument");
        expect(e.message).toBe("Invalid game mode specified.");
      }
    });

    it("should throw not-found if user data not found", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SkipRiddleData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);

      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("not-found");
        expect(e.message).toBe("User data not found.");
      }
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SkipRiddleData>;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10} as any);

      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(HttpsErrorV2);
        expect(e.code).toBe("failed-precondition");
        expect(e.message).toBe("Insufficient coins to skip riddle.");
      }
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should successfully skip a riddle and deduct coins", async () => {
      const auth = {uid: mockUserId} as any;
      const request = {
        auth,
        data: {gameMode, riddleId},
        rawRequest: {headers: {}, body: {}} as any,
      } as unknown as CallableRequest<SkipRiddleData>;

      const initialCoins = 100;
      const expectedCoinsAfterSkip = initialCoins - coinsCost;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins} as any);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock getUser a second time to return the updated coin balance after updateUserCoins is called
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: expectedCoinsAfterSkip} as any);
      mockFirestoreSet.mockResolvedValueOnce(undefined as never); // Simulate game state update

      const result = await skipRiddle(request);

      expect(result).toEqual({success: true, newCoinBalance: expectedCoinsAfterSkip});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost); // Verify coins are deducted
      // Verify game state is updated to mark the riddle as skipped
      expect(mockFirestoreSet).toHaveBeenCalledWith({isSkipped: true}, {merge: true});
      expect(logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} skipped riddle ${riddleId} in ${gameMode} mode. Cost: ${coinsCost}. New balance: ${expectedCoinsAfterSkip}.`,
      );
    });
  });
});
