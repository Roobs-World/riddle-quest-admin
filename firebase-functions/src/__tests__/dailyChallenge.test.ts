// Placed at the VERY TOP of the file, before any imports or other jest.mock calls
const mockAdminFirestoreGet: jest.Mock<() => Promise<MockDocumentSnapshot<any>>> = jest.fn();

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  updateUserLastCompletedDailyChallengeDate: jest.fn(),
  // Refine getUser mock return type to match Player | undefined
  getUser: jest.fn<(...args: any[]) => Promise<Player | undefined>>().mockResolvedValue(undefined), // Default to undefined for user not found
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
                collectionPath === "dailyChallenge" && documentPath === "current"
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
    lastDailyChallengeCompletedAt: undefined, // Ensure this is number | undefined in schema
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
  let getCurrentDailyChallenge: any;
  let advanceDailyChallengeProgress: any;

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
    setCompletedDailyChallenge = dailyChallengeModule.setCompletedDailyChallenge;
    hasCompletedDailyChallenge = dailyChallengeModule.hasCompletedDailyChallenge;
    getCurrentDailyChallenge = dailyChallengeModule.getCurrentDailyChallenge;
    advanceDailyChallengeProgress = dailyChallengeModule.advanceDailyChallengeProgress;

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

  afterAll(() => {
    Date.now = originalDateNow;
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
      mockUpdateUserLastCompletedDailyChallengeDate.mockResolvedValue(undefined as any);
      const expectedIsoDate = "2023-01-01T10:00:00.000Z";

      await setCompletedDailyChallenge(mockRequest);
      expect(mockUpdateUserLastCompletedDailyChallengeDate).toHaveBeenCalledWith(mockUserId, expectedIsoDate);
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
      const todayTimestamp: number = today.getTime(); // Use milliseconds, not seconds
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          lastDailyChallengeCompletedAt: todayTimestamp,
          progress: {
            classicIndex: 0,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 5, // Completed all 5 questions
          },
        }),
      );
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(true);
      expect(mockGetUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should return false if user completed challenge yesterday", async () => {
      const mockUserId = "testUserYesterday";
      // Create yesterday's timestamp manually since Date constructor is mocked
      // Mocked date is 2023-01-01T10:00:00.000Z, so yesterday would be 2022-12-31
      const yesterdayTimestamp: number = 1672444800000; // 2022-12-31T00:00:00.000Z
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
      // Mock getUser to return undefined for a not-found user
      mockGetUser.mockResolvedValue(undefined);
      const mockRequest = {data: {id: mockUserId}} as CallableRequest<MockHasCompletedDailyChallengeData>;

      const result = await hasCompletedDailyChallenge(mockRequest);
      expect(result).toBe(false);
      expect(mockGetUser).toHaveBeenCalledWith(mockUserId);
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

      const mockDailyChallenge = {
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?", questionNumber: 1},
        ],
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

      const mockDailyChallenge = {
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?", questionNumber: 1},
        ],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(true); // Player completed today
      expect(result.currentQuestion).toBe(1);
      expect(result.questionsCompleted).toBe(1);
    });

    it("should return challenge and undefined completion if getUser fails for authenticated user", async () => {
      const mockUserId = "testUserError";
      const dbError = new Error("DB fetch failed");
      mockGetUser.mockRejectedValue(dbError);

      const mockDailyChallenge = {
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
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
      const mockDailyChallenge = {
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: undefined} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?", questionNumber: 1},
        ],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBeUndefined(); // Not authenticated means no completion status
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("should return challenge and false completion if daily challenge date is not today", async () => {
      const mockUserId = "testUserOldChallenge";
      const mockPlayer = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});

      mockGetUser.mockResolvedValue(mockPlayer);

      const mockDailyChallenge = {
        date: "2023-01-02", // Different day
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-02",
        questions: [
          {riddleId: "q1", text: "Question 1?", questionNumber: 1},
        ],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(false); // Challenge is not for today
    });

    it("should return error if daily challenge document is missing required fields", async () => {
      // Test case where document exists but is missing questions array or has wrong number of questions
      const mockDailyChallengeIncomplete = {
        date: "2023-01-01",
        questions: [],
        totalQuestions: 0,
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

      const mockDailyChallenge = {
        date: "2023-01-01",
        questions: [
          {riddleId: "q1", text: "Question 1?"},
          {riddleId: "q2", text: "Question 2?"},
          {riddleId: "q3", text: "Question 3?"},
          {riddleId: "q4", text: "Question 4?"},
          {riddleId: "q5", text: "Question 5?"},
        ],
        totalQuestions: 5,
      };
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

  // --- Tests for advanceDailyChallengeProgress (v2) ---
  describe("advanceDailyChallengeProgress (v2)", () => {
    let mockUserUpdate: jest.Mock;

    beforeEach(() => {
      mockAdminFirestoreGet.mockReset();
      mockUserUpdate = jest.fn().mockResolvedValue(undefined);

      const adminMock = jest.requireMock("firebase-admin") as any;
      adminMock.mockFirestoreCollection.mockImplementation((collectionPath: string) => ({
        doc: jest.fn((docId?: string) => ({
          get:
            collectionPath === "dailyChallenge" && docId === "current"
              ? mockAdminFirestoreGet
              : jest.fn().mockResolvedValue({exists: false, data: () => undefined}),
          set: jest.fn().mockResolvedValue(undefined),
          update: mockUserUpdate,
        })),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({docs: [], empty: true, size: 0}),
      }));
    });

    it("should throw HttpsError unauthenticated if not authenticated", async () => {
      const mockRequest = {auth: undefined, data: {}} as CallableRequest<unknown>;
      await expect(advanceDailyChallengeProgress(mockRequest)).rejects.toThrow(
        new HttpsError("unauthenticated", "User must be authenticated to advance progress."),
      );
    });

    it("should throw HttpsError not-found if user data not found", async () => {
      mockGetUser.mockResolvedValue(undefined);
      const mockRequest = {auth: {uid: "unknownUser"}, data: {}} as CallableRequest<unknown>;
      await expect(advanceDailyChallengeProgress(mockRequest)).rejects.toThrow(
        new HttpsError("not-found", "User data not found."),
      );
    });

    it("should return already completed when currentQuestionIndex >= 1", async () => {
      const mockUserId = "completedUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {
            classicIndex: 0,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 1,
          },
        }),
      );

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      const result = await advanceDailyChallengeProgress(mockRequest);
      expect(result).toEqual({
        newQuestionIndex: 1,
        isFullyCompleted: true,
        message: "Daily challenge already completed.",
      });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });

    it("should complete challenge when not yet completed", async () => {
      const mockUserId = "progressUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {
            classicIndex: 0,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          },
        }),
      );

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      const result = await advanceDailyChallengeProgress(mockRequest);
      expect(result).toEqual({
        newQuestionIndex: 1,
        isFullyCompleted: true,
        message: "Daily challenge completed! 1 riddle finished.",
      });
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          "progress.dailyChallengeCurrentQuestion": 1,
        }),
      );
    });

    it("should mark fully completed when advancing from question 0", async () => {
      const mockUserId = "almostDoneUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {
            classicIndex: 0,
            dailyChallengeIndex: 0,
            dailyChallengeCurrentQuestion: 0,
          },
        }),
      );

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      const result = await advanceDailyChallengeProgress(mockRequest);
      expect(result).toEqual({
        newQuestionIndex: 1,
        isFullyCompleted: true,
        message: "Daily challenge completed! 1 riddle finished.",
      });
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          "progress.dailyChallengeCurrentQuestion": 1,
        }),
      );
    });

    it("should advance from question 0 to 1", async () => {
      const mockUserId = "freshUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId));

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      const result = await advanceDailyChallengeProgress(mockRequest);
      expect(result).toEqual({
        newQuestionIndex: 1,
        isFullyCompleted: true,
        message: "Daily challenge completed! 1 riddle finished.",
      });
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          "progress.dailyChallengeCurrentQuestion": 1,
        }),
      );
    });

    it("should wrap non-HttpsError in internal HttpsError", async () => {
      const mockUserId = "errorUser";
      const dbError = new Error("Unexpected DB error");
      mockGetUser.mockRejectedValue(dbError);

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      await expect(advanceDailyChallengeProgress(mockRequest)).rejects.toThrow(
        new HttpsError("internal", "An error occurred while advancing progress."),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error advancing daily challenge progress:",
        dbError,
      );
    });

    it("should re-throw HttpsError without wrapping", async () => {
      const mockUserId = "errorUser";
      const {HttpsError: CurrentHttpsError} = jest.requireMock("firebase-functions/v2/https") as {HttpsError: typeof HttpsError};
      const httpsError = new CurrentHttpsError("permission-denied", "Custom error");
      mockGetUser.mockRejectedValue(httpsError);

      const mockRequest = {auth: {uid: mockUserId}, data: {}} as CallableRequest<unknown>;
      await expect(advanceDailyChallengeProgress(mockRequest)).rejects.toThrow(httpsError);
    });
  });
});

// Helper function to create a CallableRequest mock
// const mockCallableRequest = <T>(data: T, auth?: {uid: string}): CallableRequest<T> => ({
//   data,
//   auth,
// });

