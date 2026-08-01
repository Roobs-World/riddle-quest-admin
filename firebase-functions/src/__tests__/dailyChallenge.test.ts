// Placed at the VERY TOP of the file, before any imports or other jest.mock calls
const mockAdminFirestoreGet: jest.Mock<() => Promise<MockDocumentSnapshot<any>>> = jest.fn();

import {afterEach, beforeEach, describe, expect, it, jest, afterAll} from "@jest/globals";

// Store original Date.now
const originalDateNow = Date.now;

// --- Mocks Start (must be before imports) ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

interface MockFirebaseFunctions {
  logger: typeof mockLogger;
  https: {HttpsError: unknown};
  config: () => Record<string, unknown>;
}

jest.mock("firebase-functions", () => {
  return {
    logger: mockLogger,
    config: () => ({}),
  };
});

jest.mock("../firestoreService", () => ({
  // Refine getUser mock return type to match Player | undefined
  getUser: jest.fn<(...args: any[]) => Promise<Player | undefined>>().mockResolvedValue(undefined), // Default to undefined for user not found
  getClassicRiddleByIndex: jest.fn(),
}));

jest.mock("../riddleGeneration", () => ({
  generateTodaysDailyChallenge: jest.fn().mockResolvedValue(undefined),
}));

// Define types for mocked Firestore objects to improve type checking
interface MockDocumentSnapshot<T> {
  exists: boolean;
  data(): T | undefined;
  // Add other DocumentSnapshot properties/methods if needed by tests
}

interface MockQuerySnapshot<T> {
  empty: boolean;
  size: number;
  docs: MockDocumentSnapshot<T>[];
  // Add other QuerySnapshot properties/methods if needed by tests
}

interface MockDocumentReference<T> {
  get(): Promise<MockDocumentSnapshot<T>>;
  set(data: T): Promise<void>;
  update(data: Partial<T>): Promise<void>;
  // Add other DocumentReference properties/methods if needed by tests
}

interface MockCollectionReference<T> {
  doc(documentPath?: string): MockDocumentReference<T>;
  where(_fieldPath: string, _opStr: string, _value: any): MockCollectionReference<T>;
  get(): Promise<MockQuerySnapshot<T>>;
  // Add other CollectionReference properties/methods if needed by tests
}

interface MockFirestore {
  collection<T>(collectionPath: string): MockCollectionReference<T>;
  // Add other Firestore properties/methods if needed by tests (e.g., FieldValue)
  FieldValue: {serverTimestamp: jest.Mock};
}

// New firebase-admin mock with refined types and structure
jest.mock("firebase-admin", () => {
  const mockFirestore = {} as MockFirestore; // Initialize as partial type

  // Mock FieldValue separately
  mockFirestore.FieldValue = {
    serverTimestamp: jest.fn(() => new Date()), // Mock serverTimestamp to return a Date
  };

  const mockFirestoreCollection = jest.fn(
    <T>(collectionPath: string): MockCollectionReference<T> =>
      ({
        doc: jest.fn(
          (documentPath?: string): MockDocumentReference<T> =>
            ({
              get:
                collectionPath === "localizedRiddles/en/riddles" && documentPath === "current"
                  ? mockAdminFirestoreGet
                  : jest
                      .fn<() => Promise<MockDocumentSnapshot<T>>>()
                      .mockResolvedValue({exists: false, data: () => undefined} as MockDocumentSnapshot<T>),
              set: jest.fn((_data: T) => Promise.resolve()),
              update: jest.fn((_data: Partial<T>) => Promise.resolve()),
            }) as MockDocumentReference<T>,
        ),
        where: jest.fn((_fieldPath: string, _opStr: string, _value: any): MockCollectionReference<T> => {
          const mockWhereResult: Partial<MockCollectionReference<T>> = {
            get: jest
              .fn<() => Promise<MockQuerySnapshot<T>>>()
              .mockResolvedValue({docs: [], empty: true, size: 0} as MockQuerySnapshot<T>),
            // Explicitly cast jest.fn() to the expected type
            doc: jest.fn() as MockCollectionReference<T>["doc"],
            where: jest.fn() as MockCollectionReference<T>["where"],
          };
          return mockWhereResult as MockCollectionReference<T>;
        }),
        get: jest
          .fn<() => Promise<MockQuerySnapshot<T>>>()
          .mockResolvedValue({docs: [], empty: true, size: 0} as MockQuerySnapshot<T>),
      }) as MockCollectionReference<T>,
  );

  mockFirestore.collection = mockFirestoreCollection as any;

  const firestoreFunc = jest.fn(() => mockFirestore);
  // Allow admin.firestore.FieldValue.serverTimestamp() static access used in source.
  Object.assign(firestoreFunc, {
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date().toISOString()),
    },
  });

  return {
    initializeApp: jest.fn(),
    firestore: firestoreFunc,
    mockFirestoreCollection: mockFirestoreCollection as any,
  } as any;
});

interface MockOnCallHandler {
  (options: unknown, handler: unknown): unknown;
}

// Simple mock for firebase-functions/v2/https that returns the handler directly
jest.mock("firebase-functions/v2/https", () => {
  const actualHttps = jest.requireActual("firebase-functions/v2/https") as {HttpsError: unknown};
  return {
    HttpsError: actualHttps.HttpsError,
    onCall: jest.fn(((options: unknown, handler: unknown) => {
      return handler;
    }) as MockOnCallHandler),
  };
});

// --- Mocks End ---

import * as functions from "firebase-functions";
import {HttpsError, CallableRequest} from "firebase-functions/v2/https";

// Original imports from mocked services for typing
import type {getUser as originalGetUser} from "../firestoreService";
import {PlayerSchema, PlayerStatsSchema, PlayerProgressSchema, Player} from "../validation/firestoreSchemas";

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
    lastDailyChallengeCompletedAt: undefined, // Ensure this is number | undefined in schema
    stats: PlayerStatsSchema.parse({}),
    progress: PlayerProgressSchema.parse({}),
    ...overrides,
  });
};

const createTimestampMock = (iso: string) => ({
  toDate: () => new Date(iso),
});

const createCurrentDailyRiddleDoc = (
  overrides: Partial<{riddleId: string; text: string; answer: string; timestamp: unknown}> = {},
) => ({
  riddleId: "current",
  text: "Question 1?",
  answer: "answer",
  timestamp: createTimestampMock("2023-01-01T10:00:00.000Z"),
  ...overrides,
});

describe("Daily Challenge Functions", () => {
  let mockGetUser: jest.MockedFunction<typeof originalGetUser>;
  let mockGetClassicRiddleByIndex: jest.Mock;
  let mockFirebaseFunctionsV1: {
    logger: {error: jest.MockedFunction<(message?: any, ...optionalParams: any[]) => void>};
    https: {HttpsError: typeof functions.https.HttpsError};
  };
  let getCurrentDailyChallenge: any;
  let getCurrentClassicRiddle: any;

  beforeEach(() => {
    jest.resetModules();
    mockAdminFirestoreGet.mockReset();

    // Mock Date.now globally and Date constructor
    const mockDate = new Date("2023-01-01T10:00:00.000Z");
    const OriginalDate = Date;

    Date.now = jest.fn(() => mockDate.getTime());

    // Create a smarter Date constructor mock
    global.Date = jest.fn((dateArg?: any) => {
      if (dateArg === undefined) {
        // new Date() - return mocked current date
        return mockDate;
      } else {
        // new Date(timestamp) - return actual date for that timestamp
        return new OriginalDate(dateArg);
      }
    }) as any;
    global.Date.now = jest.fn(() => mockDate.getTime());

    // Import the module to get the functions
    const dailyChallengeModule = require("../dailyChallenge");
    getCurrentDailyChallenge = dailyChallengeModule.getCurrentDailyChallenge;
    getCurrentClassicRiddle = dailyChallengeModule.getCurrentClassicRiddle;

    const mockFsService = jest.requireMock("../firestoreService") as {
      getUser: jest.MockedFunction<typeof originalGetUser>;
      getClassicRiddleByIndex: jest.Mock;
    };
    mockGetUser = mockFsService.getUser;
    mockGetClassicRiddleByIndex = mockFsService.getClassicRiddleByIndex;

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

  afterAll(() => {
    Date.now = originalDateNow;
  });

  // --- Tests for getCurrentDailyChallenge (v2) ---
  describe("getCurrentDailyChallenge (v2)", () => {
    beforeEach(() => {
      // Date.now is now mocked globally in the main beforeEach
      mockAdminFirestoreGet.mockReset();
    });

    afterEach(() => {
      // Date.now restoration is handled in the main afterEach
    });

    it("should return error if no daily challenge document exists", async () => {
      mockAdminFirestoreGet.mockResolvedValue({
        exists: false,
        data: () => undefined,
      } as MockDocumentSnapshot<any>);
      const mockRequest = {auth: undefined} as CallableRequest<unknown>;

      const result = await getCurrentDailyChallenge(mockRequest);
      expect(result.error).toBe("No daily challenge available at the moment.");
    });

    it("should return challenge and completion status for authenticated user", async () => {
      const mockUserId = "testUser123";
      const mockPlayer = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});

      mockGetUser.mockResolvedValue(mockPlayer);

      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [{riddleId: "current", text: "Question 1?", answer: "answer", questionNumber: 1}],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(false); // Player has no lastDailyChallengeCompletedAt
      expect(result.currentQuestion).toBe(0);
      expect(result.questionsCompleted).toBe(0);
    });

    it("should return challenge and completion if user completed challenge today", async () => {
      const mockUserId = "testUserToday";
      const todayTimestamp = Date.now(); // Use the mocked Date.now
      const mockPlayer = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: todayTimestamp,
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 1, // Completed today's single question
        },
      });

      mockGetUser.mockResolvedValue(mockPlayer);

      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [{riddleId: "current", text: "Question 1?", answer: "answer", questionNumber: 1}],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(true); // Player completed today
      expect(result.currentQuestion).toBe(1);
      expect(result.questionsCompleted).toBe(1);
    });

    it("should treat Timestamp-like completion values as completed today", async () => {
      const mockUserId = "testUserTimestampGetCurrent";
      const mockPlayer = {
        ...getDefaultPlayer(mockUserId),
        lastDailyChallengeCompletedAt: createTimestampMock("2023-01-01T06:00:00.000Z"),
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 1,
        },
      } as unknown as Player;

      mockGetUser.mockResolvedValue(mockPlayer);

      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.hasCompletedToday).toBe(true);
      expect(result.questionsCompleted).toBe(1);
    });

    it("should return challenge and undefined completion if getUser fails for authenticated user", async () => {
      const mockUserId = "testUserError";
      const dbError = new Error("DB fetch failed");
      mockGetUser.mockRejectedValue(dbError);

      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toBeUndefined();
      // When getUser fails, the function should return an error
      expect(result.error).toBe("An error occurred while fetching the daily challenge.");
    });

    it("should return challenge and false completion if user not authenticated", async () => {
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: undefined} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [{riddleId: "current", text: "Question 1?", answer: "answer", questionNumber: 1}],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBeUndefined(); // Not authenticated means no completion status
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("should return challenge and false completion if daily challenge date is not today", async () => {
      const mockUserId = "testUserOldChallenge";
      const mockPlayer = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});

      mockGetUser.mockResolvedValue(mockPlayer);

      const mockDailyChallenge = createCurrentDailyRiddleDoc({
        timestamp: createTimestampMock("2023-01-02T10:00:00.000Z"),
      });
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-02",
        questions: [{riddleId: "current", text: "Question 1?", answer: "answer", questionNumber: 1}],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(false); // Challenge is not for today
    });

    it("should return error if daily challenge document is missing required fields", async () => {
      // Test case where document exists but is missing questions array or has wrong number of questions
      const mockDailyChallengeIncomplete = {
        answer: "answer",
        timestamp: createTimestampMock("2023-01-01T10:00:00.000Z"),
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallengeIncomplete,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: undefined} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.error).toBe("Daily challenge data is incomplete. Expected 1 question.");
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Daily challenge document is missing required question data.",
        mockDailyChallengeIncomplete,
      );
    });

    it("should return error if daily challenge document data is null", async () => {
      // Test case where document exists but data() returns null/undefined
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => null,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: undefined} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.error).toBe("Daily challenge data is incomplete. Expected 1 question.");
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Daily challenge document is missing required question data.",
        null,
      );
    });

    it("should set defaults when authenticated user exists but getUser returns null", async () => {
      const mockUserId = "testUserNotFound";
      mockGetUser.mockResolvedValue(undefined);

      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.currentQuestion).toBe(0);
      expect(result.questionsCompleted).toBe(0);
      expect(result.hasCompletedToday).toBe(false);
      expect(result.challenge).toBeDefined();
    });
  });

  describe("getCurrentClassicRiddle (v2)", () => {
    it("should throw HttpsError if not authenticated", async () => {
      const mockRequest = {auth: undefined, data: {classicIndex: 4}} as CallableRequest<{
        classicIndex?: number;
        locale?: string;
      }>;

      await expect(getCurrentClassicRiddle(mockRequest)).rejects.toMatchObject({
        code: "unauthenticated",
        message: "The user must be authenticated to load a classic riddle.",
      });
      expect(mockGetClassicRiddleByIndex).not.toHaveBeenCalled();
    });

    it("should return classic challenge payload for authenticated user", async () => {
      const mockUserId = "classicUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId));
      mockGetClassicRiddleByIndex.mockResolvedValue({
        riddleId: "classic-10",
        text: "Classic question?",
        answer: "ANSWER",
        locale: "en",
      });

      const mockRequest = {auth: {uid: mockUserId}, data: {classicIndex: 10}} as CallableRequest<{
        classicIndex?: number;
        locale?: string;
      }>;

      const result = await getCurrentClassicRiddle(mockRequest);

      expect(result.challenge).toEqual({
        date: undefined,
        questions: [{riddleId: "classic-10", text: "Classic question?", answer: "ANSWER", questionNumber: 1}],
        totalQuestions: 1,
      });
      expect(mockGetClassicRiddleByIndex).toHaveBeenCalledWith(10, "en");
    });

    it("should return error when the requested classic riddle is unavailable", async () => {
      const mockUserId = "classicMissingUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId));
      mockGetClassicRiddleByIndex.mockResolvedValue(undefined);

      const mockRequest = {auth: {uid: mockUserId}, data: {classicIndex: 10}} as CallableRequest<{
        classicIndex?: number;
        locale?: string;
      }>;

      const result = await getCurrentClassicRiddle(mockRequest);

      expect(result.error).toBe("No classic riddle available at index 10.");
    });
  });

});

// Helper function to create a CallableRequest mock
// const mockCallableRequest = <T>(data: T, auth?: {uid: string}): CallableRequest<T> => ({
//   data,
//   auth,
// });
