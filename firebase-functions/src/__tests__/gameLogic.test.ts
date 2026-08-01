import {beforeEach, describe, expect, it, jest, beforeAll, afterAll} from "@jest/globals";
import {HttpsError as HttpsErrorV2, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https"; // Specifically for onCall v2 HttpsError
import {logger} from "firebase-functions";
import {spendCoins as spendCoinsOriginal, skipRiddle as skipRiddleOriginal} from "../gameLogic";
import {updateUserCoins, getUser, getRiddleByGameMode} from "../firestoreService";
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
  getRiddleByGameMode: jest.fn(),
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
  const firestoreFn = () => mockFirestoreRoot;
  (firestoreFn as {FieldValue: {increment: (n: number) => unknown; serverTimestamp: () => unknown}}).FieldValue = {
    increment: (n: number) => ({__type: "increment" as const, value: n}),
    serverTimestamp: () => ({__type: "serverTimestamp" as const}),
  };
  return {
    initializeApp: jest.fn(),
    firestore: firestoreFn,
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
interface SpendCoinsData {
  amount: number;
  reason: string;
  gameMode?: "classic" | "challenge";
}

interface SkipRiddleData {
  riddleId: string;
  gameMode: "classic" | "challenge";
}

// Define handler types based on function signatures and expected return values from tests
type SpendCoinsHandler = (request: CallableRequestV2<SpendCoinsData>) => Promise<{newCoins: number}>;
type SkipRiddleHandler = (
  request: CallableRequestV2<SkipRiddleData>,
) => Promise<{success: boolean; newProgress?: unknown; message: string; costDeducted: number}>;

// Cast the imported functions to their handler types for use in tests
const spendCoins = spendCoinsOriginal as unknown as SpendCoinsHandler;
const skipRiddle = skipRiddleOriginal as unknown as SkipRiddleHandler;

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

    // Default getRiddleByGameMode mock for classic riddles
    (getRiddleByGameMode as ReturnType<typeof jest.fn>).mockResolvedValue({answer: "apple"});
  });

  // Cleanup that runs once after all tests
  afterAll(() => {
    jest.restoreAllMocks();
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
          expect(e.message).toBe("Invalid request payload for spendCoins.");
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
          expect(e.message).toBe("Invalid request payload for spendCoins.");
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
          expect(e.message).toMatch(/Insufficient coins to spend/);
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

      (getUser as ReturnType<typeof jest.fn>)
        .mockResolvedValueOnce({coins: initialCoins})
        .mockResolvedValueOnce({coins: expectedCoinsAfterSpend});
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);

      const result = await spendCoins(request);

      expect(result).toEqual({newCoins: expectedCoinsAfterSpend});
      expect(getUser).toHaveBeenCalledTimes(2); // Once to check balance, once to return new balance
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -amountToSpend); // Verify negative amount is passed
      expect(logger.info).toHaveBeenCalledWith(
        `User ${mockUserId} spent ${amountToSpend} coins for reason: ${reason}. New balance: ${expectedCoinsAfterSpend}.`,
      );
    });

    it("should reject legacy skip spending for a daily riddle", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest(
        {amount: 150, reason: "skip", gameMode: "challenge"},
        auth,
      );

      await expect(spendCoins(request)).rejects.toMatchObject({
        code: "failed-precondition",
        message: "Daily riddles cannot be skipped.",
      });
      expect(updateUserCoins).not.toHaveBeenCalled();
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
          expect(e.message).toBe("Invalid reason specified. Must be 'hint', 'skip', or 'continue'.");
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
          expect(e.message).toBe("Invalid request payload for spendCoins.");
        } else {
          throw e;
        }
      }
    });

    it("should throw internal error if cannot retrieve updated user data after spending coins", async () => {
      const auth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({amount: amountToSpend, reason}, auth);

      // spendCoins: getUser (balance check) -> updateUserCoins -> getUser (updated balance)
      (getUser as ReturnType<typeof jest.fn>)
        .mockResolvedValueOnce({coins: 100})
        .mockResolvedValueOnce(undefined as any); // Second getUser returns undefined = cannot retrieve updated data
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);

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

  describe("skipRiddle", () => {
    const riddleId = "riddle-classic-1";

    it("should throw unauthenticated if user is not authenticated", async () => {
      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, undefined);
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("unauthenticated");
          expect(e.message).toBe("The user must be authenticated to skip a riddle.");
        } else {
          throw e;
        }
      }
    });

    it("should throw invalid-argument if game mode is invalid", async () => {
      const request = createMockCallableRequest(
        {riddleId, gameMode: "invalid" as "classic"},
        createMockAuth(mockUserId),
      );
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("invalid-argument");
          expect(e.message).toBe("Invalid game mode specified.");
        } else {
          throw e;
        }
      }
    });

    it("should throw not-found if user data not found", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce(null);
      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("not-found");
          expect(e.message).toBe("User data not found.");
        } else {
          throw e;
        }
      }
    });

    it("should throw failed-precondition if user has insufficient coins for classic", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValueOnce({coins: 50}); // SKIP_COST_CLASSIC is 100
      (getRiddleByGameMode as ReturnType<typeof jest.fn>).mockResolvedValueOnce({answer: "apple"});
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({isCompleted: false})};
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc);

      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toContain("Insufficient coins to skip");
          expect(e.message).toContain("100");
        } else {
          throw e;
        }
      }
    });

    it("should throw not-found if riddle does not exist", async () => {
      (getRiddleByGameMode as jest.Mock).mockReset();
      (getRiddleByGameMode as jest.Mock).mockResolvedValue(undefined);
      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("not-found");
          expect(e.message).toBe(`classic riddle with ID ${riddleId} not found.`);
        } else {
          throw e;
        }
      }
    });

    it("should throw failed-precondition if riddle is already completed", async () => {
      (getRiddleByGameMode as jest.Mock).mockResolvedValueOnce({answer: "apple"});
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({isCompleted: true})};
      mockFirestoreGet.mockReset();
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc);

      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("failed-precondition");
          expect(e.message).toBe("Riddle is already completed.");
        } else {
          throw e;
        }
      }
    });

    it("should skip classic riddle, deduct coins, and update progress and stats", async () => {
      (getRiddleByGameMode as ReturnType<typeof jest.fn>).mockResolvedValueOnce({answer: "apple"});
      const gameStateDoc: MockDocumentSnapshot = {exists: true, data: () => ({isCompleted: false})};
      const userDoc: MockDocumentSnapshot = {
        exists: true,
        data: () => ({progress: {classicIndex: 2}, stats: {}}),
      };
      mockFirestoreGet.mockResolvedValueOnce(gameStateDoc).mockResolvedValueOnce(userDoc);
      (updateUserCoins as ReturnType<typeof jest.fn>).mockResolvedValueOnce(undefined);
      mockFirestoreSet.mockResolvedValueOnce(undefined);
      mockFirestoreUpdate.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));

      const result = await skipRiddle(request);

      expect(result.success).toBe(true);
      expect(result.costDeducted).toBe(100); // SKIP_COST_CLASSIC
      expect(result.newProgress).toEqual({classicIndex: 3});
      expect(result.message).toContain("Riddle skipped successfully");
      expect(updateUserCoins).toHaveBeenCalledWith(mockUserId, -100);
      expect(mockFirestoreSet).toHaveBeenCalledWith(expect.objectContaining({isCompleted: true, isSkipped: true}), {
        merge: true,
      });
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(expect.objectContaining({"progress.classicIndex": 3}));
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({"stats.classicSkipped": expect.anything()}),
      );
    });

    it("should reject attempts to skip a daily riddle", async () => {
      const request = createMockCallableRequest({riddleId, gameMode: "challenge" as const}, createMockAuth(mockUserId));

      await expect(skipRiddle(request)).rejects.toMatchObject({
        code: "failed-precondition",
        message: "Daily riddles cannot be skipped.",
      });
      expect(getUser).not.toHaveBeenCalled();
      expect(updateUserCoins).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors and throw internal HttpsError", async () => {
      (getRiddleByGameMode as ReturnType<typeof jest.fn>).mockRejectedValueOnce(new Error("Firestore error"));
      const request = createMockCallableRequest({riddleId, gameMode: "classic" as const}, createMockAuth(mockUserId));
      try {
        await skipRiddle(request);
        throw new Error("Test failed: Expected HttpsErrorV2 to be thrown.");
      } catch (e: unknown) {
        if (e instanceof HttpsErrorV2) {
          expect(e.code).toBe("internal");
          expect(e.message).toBe("An error occurred while skipping the riddle.");
        } else {
          throw e;
        }
      }
    });
  });

  describe("Error Handling Edge Cases", () => {
    it("should handle unexpected errors in spendCoins and throw internal HttpsError", async () => {
      (getUser as ReturnType<typeof jest.fn>).mockRejectedValueOnce(new Error("Database error"));
      const request = createMockCallableRequest({amount: 50, reason: "hint"}, createMockAuth(mockUserId));

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
  });
});
