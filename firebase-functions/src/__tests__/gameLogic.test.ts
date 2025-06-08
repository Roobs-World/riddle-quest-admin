import {beforeEach, describe, expect, it, jest, beforeAll, afterAll} from "@jest/globals";
import {HttpsError as HttpsErrorV2, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https"; // Specifically for onCall v2 HttpsError
import {logger} from "firebase-functions";
import {getHint as getHintOriginal, spendCoins as spendCoinsOriginal} from "../gameLogic";
import {updateUserCoins, getUser} from "../firestoreService";
import {DecodedIdToken} from "firebase-admin/auth";

// Mock document snapshot interface
interface MockDocumentSnapshot {
  exists: boolean;
  data: () => unknown;
}

// --- Mocks Start ---
jest.mock("../firestoreService", () => ({
  updateUserCoins: jest.fn(),
  getUser: jest.fn(),
}));

const mockFirestoreGet = jest.fn() as jest.MockedFunction<() => Promise<MockDocumentSnapshot>>;
const mockFirestoreSet = jest.fn() as jest.MockedFunction<(data: unknown, options?: unknown) => Promise<void>>;
const mockFirestoreAdd = jest.fn() as jest.MockedFunction<(data: unknown) => Promise<unknown>>;
const mockFirestoreUpdate = jest.fn() as jest.MockedFunction<(data: unknown) => Promise<void>>;

// Create a chainable mock that can handle nested collection/doc calls
// Define a simple interface for the chainable mock methods
interface MockFirestoreRef {
  get: jest.MockedFunction<() => Promise<MockDocumentSnapshot>>;
  set: jest.MockedFunction<(data: unknown, options?: unknown) => Promise<void>>;
  update: jest.MockedFunction<(data: unknown) => Promise<void>>;
  collection: jest.MockedFunction<(name: string) => MockFirestoreRef>;
  doc: jest.MockedFunction<(id: string) => MockFirestoreRef>;
  where: jest.MockedFunction<(field: string, op: unknown, value: unknown) => MockFirestoreRef>;
  limit: jest.MockedFunction<(count: number) => MockFirestoreRef>;
  add: jest.MockedFunction<(data: unknown) => Promise<unknown>>;
}

const createMockFirestoreRef = (): MockFirestoreRef => ({
  get: mockFirestoreGet,
  set: mockFirestoreSet,
  update: mockFirestoreUpdate,
  collection: jest.fn(() => createMockFirestoreRef()) as jest.MockedFunction<(name: string) => MockFirestoreRef>,
  doc: jest.fn(() => createMockFirestoreRef()) as jest.MockedFunction<(id: string) => MockFirestoreRef>,
  where: jest.fn(() => createMockFirestoreRef()) as jest.MockedFunction<
    (field: string, op: unknown, value: unknown) => MockFirestoreRef
  >,
  limit: jest.fn(() => createMockFirestoreRef()) as jest.MockedFunction<(count: number) => MockFirestoreRef>,
  add: mockFirestoreAdd,
});

const mockFirestoreRoot = createMockFirestoreRef();

jest.mock("firebase-admin", () => {
  return {
    initializeApp: jest.fn(),
    firestore: () => mockFirestoreRoot,
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
    onCall: jest.fn((optionsOrHandler: unknown, handler?: unknown) => {
      if (typeof optionsOrHandler === "function") {
        return optionsOrHandler;
      }
      return handler;
    }),
  };
});
// --- Mocks End ---

// Define types for request data
interface GetHintData {
  currentAttempt: string[];
  riddleId: string;
}

interface SpendCoinsData {
  amount: number;
  reason: string;
}

// Define handler types based on function signatures and expected return values from tests
type GetHintHandler = (
  request: CallableRequestV2<GetHintData>,
) => Promise<{revealedLetter: string; index: number; coinsCost: number} | null>;
type SpendCoinsHandler = (request: CallableRequestV2<SpendCoinsData>) => Promise<{newCoins: number}>;

// Cast the imported functions to their handler types for use in tests
const getHint = getHintOriginal as unknown as GetHintHandler;
const spendCoins = spendCoinsOriginal as unknown as SpendCoinsHandler;

// Helper function to create mock CallableRequest
const createMockCallableRequest = <T>(
  data: T,
  auth?: {uid: string; token: DecodedIdToken} | undefined,
): CallableRequestV2<T> => ({
  auth,
  data,
  rawRequest: {
    rawBody: Buffer.from(""),
    headers: {},
    body: {},
  } as CallableRequestV2<T>["rawRequest"],
  acceptsStreaming: false,
});

// Helper function to create mock auth
const createMockAuth = (uid: string): {uid: string; token: DecodedIdToken} => ({
  uid,
  token: {
    aud: "test-audience",
    auth_time: Date.now() / 1000,
    exp: Date.now() / 1000 + 3600,
    firebase: {
      identities: {},
      sign_in_provider: "custom",
    },
    iat: Date.now() / 1000,
    iss: "test-issuer",
    sub: uid,
    uid,
  },
});

// Helper function to create mock user data
interface MockUser {
  coins: number;
}

describe("Game Logic Functions", () => {
  const mockUserId = "testUser123";
  const defaultMockUser: MockUser = {coins: 200}; // Default user with sufficient coins

  // Setup that runs once before all tests
  beforeAll(() => {
    // Set default mock for getUser to return a valid user
    (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(defaultMockUser);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all specific firestore mocks
    mockFirestoreGet.mockReset();
    mockFirestoreSet.mockReset();
    mockFirestoreAdd.mockReset();
    mockFirestoreUpdate.mockReset();

    // Re-establish default mock for getUser after clearing mocks
    (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(defaultMockUser);
  });

  // Cleanup that runs once after all tests
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("getHint", () => {
    const riddleId = "riddle1";
    const mockRiddle = {answer: "apple"};
    const coinsCost = 50;

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = createMockCallableRequest({currentAttempt: [], riddleId}, undefined);
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("unauthenticated");
          expect(e.message).toBe("The user must be authenticated to get a hint.");
        } else {
          throw e;
        }
      }
    });

    it("should throw not-found if riddle does not exist", async () => {
      const mockDoc: MockDocumentSnapshot = {exists: false, data: () => undefined};
      mockFirestoreGet.mockResolvedValueOnce(mockDoc); // Riddle doc
      const request = createMockCallableRequest({currentAttempt: [], riddleId}, createMockAuth(mockUserId));
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("not-found");
          expect(e.message).toBe(`Riddle with ID ${riddleId} not found.`);
        } else {
          throw e;
        }
      }
    });

    it("should throw internal if riddle has no answer", async () => {
      const mockDoc: MockDocumentSnapshot = {exists: true, data: () => ({text: "A riddle"})};
      mockFirestoreGet.mockResolvedValueOnce(mockDoc); // Riddle doc with no answer
      const request = createMockCallableRequest({currentAttempt: [], riddleId}, createMockAuth(mockUserId));
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("internal");
          expect(e.message).toBe(`Answer not found for riddle ID ${riddleId}.`);
        } else {
          throw e;
        }
      }
    });

    it("should throw not-found if user data not found", async () => {
      const mockDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      mockFirestoreGet.mockResolvedValueOnce(mockDoc); // Riddle doc
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);
      const request = createMockCallableRequest({currentAttempt: [], riddleId}, createMockAuth(mockUserId));
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("not-found");
          expect(e.message).toBe("User data not found.");
        } else {
          throw e;
        }
      }
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const mockDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      mockFirestoreGet.mockResolvedValueOnce(mockDoc);
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost - 10});
      const request = createMockCallableRequest({currentAttempt: [], riddleId}, createMockAuth(mockUserId));
      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toBe("Insufficient coins to get a hint.");
        } else {
          throw e;
        }
      }
    });

    it("should throw failed-precondition if game is already completed", async () => {
      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const gameStateDoc: MockDocumentSnapshot = {
        exists: true,
        data: () => ({isCompleted: true, hintRevealedIndices: []}),
      };
      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost} as MockUser); // User
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc); // Game state
      const request = createMockCallableRequest(
        {currentAttempt: Array(5).fill(""), riddleId},
        createMockAuth(mockUserId),
      );

      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toBe("Game is already completed.");
        } else {
          throw e;
        }
      }
    });

    it("should reveal a hint, deduct coins, and update game state", async () => {
      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({hintRevealedIndices: []})};
      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as MockUser); // User
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc); // Game state
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreSet.mockResolvedValueOnce(undefined); // Game state update

      const currentAttempt = ["a", "", "", "l", ""]; // Example: a _ _ l _ for apple
      const request = createMockCallableRequest({currentAttempt, riddleId}, createMockAuth(mockUserId));

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
      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({hintRevealedIndices: [1, 3]})};
      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost} as MockUser); // User
      // Game state: all letters of 'apple' are either guessed or revealed
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc);
      const currentAttempt = ["a", "p", "p", "l", "e"]; // Correct guess or already revealed
      const request = createMockCallableRequest({currentAttempt, riddleId}, createMockAuth(mockUserId));

      const result = await getHint(request);
      expect(result).toBeNull();
      expect(updateUserCoins).not.toHaveBeenCalled();
      expect(mockFirestoreSet).not.toHaveBeenCalled();
    });

    it("should reveal a hint and create game state if it does not exist", async () => {
      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const nonExistentGameStateDoc: MockDocumentSnapshot = {exists: false, data: () => undefined}; // Game state does not exist
      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost + 10} as MockUser); // User
      mockFirestoreGet.mockResolvedValueOnce(nonExistentGameStateDoc); // Game state (riddleStates)
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreSet.mockResolvedValueOnce(undefined); // Game state creation/update

      const currentAttempt = ["", "", "", "", ""]; // All blank for 'apple'
      const request = createMockCallableRequest({currentAttempt, riddleId}, createMockAuth(mockUserId));

      const result = await getHint(request);

      expect(result).toEqual({
        revealedLetter: "A", // First letter of apple
        index: 0,
        coinsCost,
      });
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -coinsCost);
      // Should be called to create/update the hintRevealedIndices
      expect(mockFirestoreSet).toHaveBeenCalledWith({hintRevealedIndices: [0]}, {merge: true});
      expect(logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} used a hint for riddle ${riddleId}, revealing letter A at index 0.`,
      );
    });
  });

  describe("spendCoins", () => {
    const amountToSpend = 50;
    const reason = "hint";

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = createMockCallableRequest({amount: amountToSpend, reason}, undefined);
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("unauthenticated");
          expect(e.message).toBe("The function must be called while authenticated.");
        } else {
          throw e;
        }
      }
    });

    it("should throw invalid-argument if amount is invalid", async () => {
      const auth = createMockAuth(mockUserId);

      // Test negative amount
      let request = createMockCallableRequest({amount: -amountToSpend, reason}, auth);
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("invalid-argument");
          expect(e.message).toBe("Invalid amount specified.");
        } else {
          throw e;
        }
      }

      // Test zero amount
      request = createMockCallableRequest({amount: 0, reason}, auth);
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("invalid-argument");
          expect(e.message).toBe("Invalid amount specified.");
        } else {
          throw e;
        }
      }
    });

    it("should throw not-found if user data not found", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason}, auth);

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("not-found");
          expect(e.message).toBe("User data not found.");
        } else {
          throw e;
        }
      }
    });

    it("should throw failed-precondition if user has insufficient coins", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason}, auth);

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: amountToSpend - 10});

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toBe("Insufficient coins to spend.");
        } else {
          throw e;
        }
      }
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should successfully deduct coins and return new balance", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason}, auth);

      const initialCoins = 100;
      const expectedCoinsAfterSpend = initialCoins - amountToSpend;

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: initialCoins});
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      // Mock getUser a second time to return the updated coin balance after updateUserCoins is called
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: expectedCoinsAfterSpend});

      const result = await spendCoins(request);

      expect(result).toEqual({newCoins: expectedCoinsAfterSpend});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -amountToSpend); // Verify negative amount is passed
      expect(logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} spent ${amountToSpend} coins for reason: ${reason}. New balance: ${expectedCoinsAfterSpend}.`,
      );
    });

    it("should throw invalid-argument if reason is invalid", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason: "invalid_reason"}, auth);
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("invalid-argument");
          expect(e.message).toBe("Invalid reason specified.");
        } else {
          throw e;
        }
      }
    });

    it("should throw invalid-argument if amount is not a number", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: "not-a-number" as any, reason}, auth);
      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("invalid-argument");
          expect(e.message).toBe("Invalid amount specified.");
        } else {
          throw e;
        }
      }
    });

    it("should throw internal error if cannot retrieve updated user data after spending coins", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason}, auth);

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: 100}); // Initial check
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined); // Successful update
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null); // Failed to retrieve updated data

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e).toBeInstanceOf(HttpsErrorV2);
          expect(e.code).toBe("internal");
          expect(e.message).toBe("Could not retrieve updated user data after spending coins.");
        } else {
          throw e;
        }
      }
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should properly log warning when requesting hint for completed game", async () => {
      // This test specifically targets the logger.warn call on lines 120-121
      const riddleId = "riddle1";
      const mockRiddle = {answer: "apple"};
      const coinsCost = 50;

      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const gameStateDoc: MockDocumentSnapshot = {
        exists: true,
        data: () => ({isCompleted: true, hintRevealedIndices: []}),
      };

      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost}); // User
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc); // Game state

      const request = createMockCallableRequest(
        {currentAttempt: Array(5).fill(""), riddleId},
        createMockAuth(mockUserId),
      );

      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toBe("Game is already completed.");
          // Verify that the warning log was called with the expected message
          expect(logger.warn).toHaveBeenCalledWith(
            `User ${mockUserId} requested hint for completed riddle ${riddleId}.`,
          );
        } else {
          throw e;
        }
      }
    });

    it("should handle unexpected errors in getHint and throw internal HttpsError", async () => {
      // This test specifically targets lines 182-183 - unexpected error handling path
      const riddleId = "riddle1";

      // Mock a non-HttpsError (e.g., TypeError, database connection error, etc.)
      mockFirestoreGet.mockRejectedValueOnce(new TypeError("Unexpected database error"));

      const request = createMockCallableRequest(
        {currentAttempt: ["", "", "", "", ""], riddleId},
        createMockAuth(mockUserId),
      );

      try {
        await getHint(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("internal");
          expect(e.message).toBe("An error occurred while getting a hint.");
          // Verify that the unexpected error was logged
          expect(logger.error).toHaveBeenCalledWith("Unexpected error getting hint:", expect.any(TypeError));
        } else {
          throw e;
        }
      }
    });

    it("should handle unexpected errors in spendCoins and throw internal HttpsError", async () => {
      // This test specifically targets lines 182-183 equivalent in spendCoins - unexpected error handling path
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: 50, reason: "hint"}, auth);

      // Mock a non-HttpsError (e.g., database connection error, TypeError, etc.)
      (getUser as ReturnType<typeof jest.fn>).mockRejectedValueOnce(new Error("Database connection failed"));

      try {
        await spendCoins(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("internal");
          expect(e.message).toBe("An error occurred while spending coins.");
          // Verify that the unexpected error was logged
          expect(logger.error).toHaveBeenCalledWith("Unexpected error spending coins:", expect.any(Error));
        } else {
          throw e;
        }
      }
    });

    it("should log warning when no hint is available due to all letters revealed/guessed", async () => {
      // This test targets the logger.warn call when no hint is available
      const riddleId = "riddle1";
      const mockRiddle = {answer: "abc"}; // Short word for easier testing
      const coinsCost = 50;

      const riddleDoc: MockDocumentSnapshot = {exists: true, data: () => mockRiddle};
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({hintRevealedIndices: [1, 2]})};

      mockFirestoreGet.mockResolvedValueOnce(riddleDoc); // Riddle
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: coinsCost}); // User
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc); // Game state

      const currentAttempt = ["a", "b", "c"]; // All letters guessed correctly
      const request = createMockCallableRequest({currentAttempt, riddleId}, createMockAuth(mockUserId));

      const result = await getHint(request);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        `No hint available for user ${mockUserId}, riddle ${riddleId}. All letters revealed or guessed correctly.`,
      );
    });
  });
});
