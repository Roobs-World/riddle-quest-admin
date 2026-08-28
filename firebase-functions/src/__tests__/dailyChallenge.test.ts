// Placed at the VERY TOP of the file, before any imports or other jest.mock calls
/** Provides mock admin firestore get behavior. */
const mockAdminFirestoreGet: jest.Mock<() => Promise<MockDocumentSnapshot<any>>> = jest.fn();
/** Defines the session token value. */
const SESSION_TOKEN = "00000000-0000-4000-8000-000000000001";
/** Defines the rotated session token value. */
const ROTATED_SESSION_TOKEN = "00000000-0000-4000-8000-000000000002";
/** Provides mock ensure authoritative session behavior. */
const mockEnsureAuthoritativeSession = jest.fn().mockResolvedValue(SESSION_TOKEN);
/** Provides mock get issued authoritative session behavior. */
const mockGetIssuedAuthoritativeSession = jest.fn();
/** Provides mock complete authoritative game behavior. */
const mockCompleteAuthoritativeGame = jest.fn();
/** Provides mock recover pending authoritative completion behavior. */
const mockRecoverPendingAuthoritativeCompletion = jest.fn().mockResolvedValue(false);
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

import {afterEach, beforeEach, describe, expect, it, jest, afterAll} from "@jest/globals";

// Store original Date.now
/** Provides original date now behavior. */
const originalDateNow = Date.now;

// --- Mocks Start (must be before imports) ---
/** Provides mock logger behavior. */
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

/** Defines the contract for mock firebase functions. */
interface MockFirebaseFunctions {
  /** Stores logger. */
  logger: typeof mockLogger;
  /** Stores https. */
  https: {
    /** Stores https error. */
    HttpsError: unknown;
  };
  /** Stores config. */
  config: () => Record<string, unknown>;
}

jest.mock("firebase-functions", () => {
  return {
    logger: mockLogger,
    config: () => ({}),
  };
});

jest.mock("../gameplay/firestoreService", () => ({
  // Refine getUser mock return type to match Player | undefined
  getUser: jest.fn<(...args: any[]) => Promise<Player | undefined>>().mockResolvedValue(undefined), // Default to undefined for user not found
  getClassicRiddleByIndex: jest.fn(),
}));

jest.mock("../riddles/riddleGeneration", () => ({
  generateTodaysDailyChallenge: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../gameplay/singlePlayerSession", () => ({
  ensureAuthoritativeSession: (...args: unknown[]) => mockEnsureAuthoritativeSession(...args),
  getIssuedAuthoritativeSession: (...args: unknown[]) => mockGetIssuedAuthoritativeSession(...args),
}));

jest.mock("../gameplay/completeGameLogic", () => ({
  completeAuthoritativeGame: (...args: unknown[]) => mockCompleteAuthoritativeGame(...args),
  isDailyCompletionDateEligible: jest.fn().mockReturnValue(true),
}));

jest.mock("../gameplay/singlePlayerTerminalRecovery", () => ({
  recoverPendingAuthoritativeCompletion: (...args: unknown[]) => mockRecoverPendingAuthoritativeCompletion(...args),
}));

jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual<typeof import("../jest/jestAccountDeletion")>("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

// Define types for mocked Firestore objects to improve type checking
/** Defines the contract for mock document snapshot. */
interface MockDocumentSnapshot<T> {
  /** Stores exists. */
  exists: boolean;
  /** Provides data behavior. */
  data(): T | undefined;
  // Add other DocumentSnapshot properties/methods if needed by tests
}

/** Defines the contract for mock query snapshot. */
interface MockQuerySnapshot<T> {
  /** Stores empty. */
  empty: boolean;
  /** Stores size. */
  size: number;
  /** Stores docs. */
  docs: MockDocumentSnapshot<T>[];
  // Add other QuerySnapshot properties/methods if needed by tests
}

/** Defines the contract for mock document reference. */
interface MockDocumentReference<T> {
  /** Provides get behavior. */
  get(): Promise<MockDocumentSnapshot<T>>;
  /** Provides set behavior. */
  set(data: T): Promise<void>;
  /** Provides update behavior. */
  update(data: Partial<T>): Promise<void>;
  // Add other DocumentReference properties/methods if needed by tests
}

/** Defines the contract for mock collection reference. */
interface MockCollectionReference<T> {
  /** Provides doc behavior. */
  doc(documentPath?: string): MockDocumentReference<T>;
  /** Provides where behavior. */
  where(_fieldPath: string, _opStr: string, _value: any): MockCollectionReference<T>;
  /** Provides get behavior. */
  get(): Promise<MockQuerySnapshot<T>>;
  // Add other CollectionReference properties/methods if needed by tests
}

/** Defines the contract for mock firestore. */
interface MockFirestore {
  /** Provides collection behavior. */
  collection<T>(collectionPath: string): MockCollectionReference<T>;
  // Add other Firestore properties/methods if needed by tests (e.g., FieldValue)
  /** Stores field value. */
  FieldValue: {
    /** Stores server timestamp. */
    serverTimestamp: jest.Mock;
  };
}

// New firebase-admin mock with refined types and structure
jest.mock("firebase-admin", () => {
  /** Provides mock firestore behavior. */
  const mockFirestore = {} as MockFirestore; // Initialize as partial type

  // Mock FieldValue separately
  mockFirestore.FieldValue = {
    serverTimestamp: jest.fn(() => new Date()), // Mock serverTimestamp to return a Date
  };

  /** Provides mock firestore collection behavior. */
  const mockFirestoreCollection = jest.fn(
    <T>(collectionPath: string): MockCollectionReference<T> =>
      ({
        doc: jest.fn(
          (documentPath?: string): MockDocumentReference<T> =>
            ({
              get:
                /^localizedRiddles\/[^/]+\/riddles$/.test(collectionPath) && documentPath === "current"
                  ? mockAdminFirestoreGet
                  : jest
                      .fn<() => Promise<MockDocumentSnapshot<T>>>()
                      .mockResolvedValue({exists: false, data: () => undefined} as MockDocumentSnapshot<T>),
              set: jest.fn((_data: T) => Promise.resolve()),
              update: jest.fn((_data: Partial<T>) => Promise.resolve()),
            }) as MockDocumentReference<T>,
        ),
        where: jest.fn((_fieldPath: string, _opStr: string, _value: any): MockCollectionReference<T> => {
          /** Provides mock where result behavior. */
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

  /** Provides firestore func behavior. */
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

/** Defines the contract for mock on call handler. */
interface MockOnCallHandler {
  /** Defines how mock on call handler is invoked. */
  (options: unknown, handler: unknown): unknown;
}

// Simple mock for firebase-functions/v2/https that returns the handler directly
jest.mock("firebase-functions/v2/https", () => {
  /** Provides actual https behavior. */
  const actualHttps = jest.requireActual("firebase-functions/v2/https") as {
    /** Stores https error. */
    HttpsError: unknown;
  };
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
import type {getUser as originalGetUser} from "../gameplay/firestoreService";
import {PlayerSchema, PlayerStatsSchema, PlayerProgressSchema, Player} from "../validation/firestoreSchemas";

/** Gets default player. */
const getDefaultPlayer = (userId: string, overrides: Partial<Player> = {}): Player => {
  /** Provides now behavior. */
  const now = Date.now();
  return PlayerSchema.parse({
    userId,
    email: `${userId}@example.com`,
    username: userId.slice(0, 24),
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

/** Creates timestamp mock. */
const createTimestampMock = (iso: string) => ({
  toDate: () => new Date(iso),
});

/** Creates current daily riddle doc. */
const createCurrentDailyRiddleDoc = (
  overrides: Partial<{
    /** Stores riddle id. */
    riddleId: string; /** Stores text. */
    /** Stores text. */
    text: string; /** Stores answer. */
    /** Stores answer. */
    answer: string; /** Stores timestamp. */
    /** Stores timestamp. */
    timestamp: unknown;
  }> = {},
) => ({
  riddleId: "current",
  text: "Question 1?",
  answer: "answer",
  timestamp: createTimestampMock("2023-01-01T10:00:00.000Z"),
  ...overrides,
});

describe("Daily Challenge Functions", () => {
  /** Provides mock get user behavior. */
  let mockGetUser: jest.MockedFunction<typeof originalGetUser>;
  /** Provides mock get classic riddle by index behavior. */
  let mockGetClassicRiddleByIndex: jest.Mock;
  /** Provides mock firebase functions v1 behavior. */
  let mockFirebaseFunctionsV1: {
    /** Stores logger. */
    logger: {
      /** Stores error. */
      error: jest.MockedFunction<(message?: any, ...optionalParams: any[]) => void>;
    };
    /** Stores https. */
    https: {
      /** Stores https error. */
      HttpsError: typeof functions.https.HttpsError;
    };
  };
  /** Gets current daily challenge. */
  let getCurrentDailyChallenge: any;
  /** Gets current classic riddle. */
  let getCurrentClassicRiddle: any;

  beforeEach(() => {
    jest.resetModules();
    mockAdminFirestoreGet.mockReset();
    mockEnsureAuthoritativeSession.mockReset().mockResolvedValue(SESSION_TOKEN);
    mockGetIssuedAuthoritativeSession.mockReset();
    mockCompleteAuthoritativeGame.mockReset();
    mockRecoverPendingAuthoritativeCompletion.mockReset().mockResolvedValue(false);

    // Mock Date.now globally and Date constructor
    /** Provides mock date behavior. */
    const mockDate = new Date("2023-01-01T10:00:00.000Z");
    /** Renders the original date interface. */
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
    /** Provides daily challenge module behavior. */
    const dailyChallengeModule = require("../daily/dailyChallenge");
    getCurrentDailyChallenge = dailyChallengeModule.getCurrentDailyChallenge;
    getCurrentClassicRiddle = dailyChallengeModule.getCurrentClassicRiddle;

    /** Provides mock fs service behavior. */
    const mockFsService = jest.requireMock("../gameplay/firestoreService") as {
      /** Stores get user. */
      getUser: jest.MockedFunction<typeof originalGetUser>;
      /** Stores get classic riddle by index. */
      getClassicRiddleByIndex: jest.Mock;
    };
    mockGetUser = mockFsService.getUser;
    mockGetClassicRiddleByIndex = mockFsService.getClassicRiddleByIndex;

    mockFirebaseFunctionsV1 = jest.requireMock("firebase-functions") as {
      /** Stores logger. */
      logger: {
        /** Stores error. */
        error: jest.MockedFunction<(message?: any, ...optionalParams: any[]) => void>;
      };
      /** Stores https. */
      https: {
        /** Stores https error. */
        HttpsError: typeof functions.https.HttpsError;
      };
    };

    jest.clearAllMocks();
    mockEnsureAuthoritativeSession.mockResolvedValue(SESSION_TOKEN);
    mockGetIssuedAuthoritativeSession.mockResolvedValue({
      gameMode: "classic",
      attempts: 0,
      hasUsedContinue: false,
      awaitingContinue: false,
      terminal: false,
      isCorrect: false,
    });
    mockCompleteAuthoritativeGame.mockResolvedValue(undefined);
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
      /** Provides mock user id behavior. */
      const mockUserId = "missingDailyUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);
      expect(result.error).toBe("No daily challenge available at the moment.");
    });

    it("should return challenge and completion status for authenticated user", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUser123";
      /** Provides mock player behavior. */
      const mockPlayer = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});

      mockGetUser.mockResolvedValue(mockPlayer);

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toEqual({
        date: "2023-01-01",
        questions: [
          {
            riddleId: "current",
            text: "Question 1?",
            answerLength: 6,
            sessionToken: SESSION_TOKEN,
            questionNumber: 1,
            attemptsUsed: 0,
            hasUsedContinue: false,
            awaitingContinue: false,
          },
        ],
        totalQuestions: 1,
      });
      expect(result.hasCompletedToday).toBe(false); // Player has no lastDailyChallengeCompletedAt
      expect(result.currentQuestion).toBe(0);
      expect(result.questionsCompleted).toBe(0);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });

    it("should lazily reset stale daily progress without updating every user", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserStaleProgress";
      /** Provides mock player behavior. */
      const mockPlayer = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: new Date("2022-12-31T23:59:59.000Z").getTime(),
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 1,
        },
      });

      mockGetUser.mockResolvedValue(mockPlayer);
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc(),
      } as MockDocumentSnapshot<any>);

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({auth: {uid: mockUserId}} as CallableRequest<unknown>);

      expect(result.hasCompletedToday).toBe(false);
      expect(result.currentQuestion).toBe(0);
      expect(result.questionsCompleted).toBe(0);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });

    it("should reject loading a daily challenge already completed today", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserToday";
      /** Provides today timestamp behavior. */
      const todayTimestamp = Date.now(); // Use the mocked Date.now
      /** Provides mock player behavior. */
      const mockPlayer = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: todayTimestamp,
        progress: {
          classicIndex: 0,
          dailyChallengeIndex: 0,
          dailyChallengeCurrentQuestion: 1, // Completed today's single question
        },
      });

      mockGetUser.mockResolvedValue(mockPlayer);

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toBeUndefined();
      expect(result.error).toBe("Today's daily challenge is already complete.");
      expect(result.hasCompletedToday).toBe(true); // Player completed today
      expect(result.currentQuestion).toBe(1);
      expect(result.questionsCompleted).toBe(1);
    });

    it("should treat Timestamp-like completion values as completed today", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserTimestampGetCurrent";
      /** Provides mock player behavior. */
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

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.hasCompletedToday).toBe(true);
      expect(result.questionsCompleted).toBe(1);
    });

    it("should return challenge and undefined completion if getUser fails for authenticated user", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserError";
      /** Provides db error behavior. */
      const dbError = new Error("DB fetch failed");
      mockGetUser.mockRejectedValue(dbError);

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toBeUndefined();
      // When getUser fails, the function should return an error
      expect(result.error).toBe("An error occurred while fetching the daily challenge.");
    });

    it("should require authentication before returning answer-derived metadata", async () => {
      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: undefined} as CallableRequest<unknown>;
      await expect(getCurrentDailyChallenge(mockRequest)).rejects.toMatchObject({code: "unauthenticated"});
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("should return challenge and false completion if daily challenge date is not today", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserOldChallenge";
      /** Provides mock player behavior. */
      const mockPlayer = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});

      mockGetUser.mockResolvedValue(mockPlayer);

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc({
        timestamp: createTimestampMock("2023-01-02T10:00:00.000Z"),
      });
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.challenge).toBeUndefined();
      expect(result.error).toBe("Today's daily challenge is not available yet.");
    });

    it("should return error if daily challenge document is missing required fields", async () => {
      // Test case where document exists but is missing questions array or has wrong number of questions
      /** Provides mock daily challenge incomplete behavior. */
      const mockDailyChallengeIncomplete = {
        answer: "answer",
        timestamp: createTimestampMock("2023-01-01T10:00:00.000Z"),
      };
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallengeIncomplete,
      } as MockDocumentSnapshot<any>);

      /** Provides mock user id behavior. */
      const mockUserId = "incompleteDailyUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.error).toBe("Daily challenge data is incomplete. Expected 1 question.");
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Daily challenge document is missing required playable question data.",
      );
    });

    it("should return error if daily challenge document data is null", async () => {
      // Test case where document exists but data() returns null/undefined
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => null,
      } as MockDocumentSnapshot<any>);

      /** Provides mock user id behavior. */
      const mockUserId = "nullDailyUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId));
      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge(mockRequest);

      expect(result.error).toBe("Daily challenge data is incomplete. Expected 1 question.");
      expect(mockFirebaseFunctionsV1.logger.error).toHaveBeenCalledWith(
        "Daily challenge document is missing required playable question data.",
      );
    });

    it("fails closed when legacy Daily content reveals its answer in the clue", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "spoiledDailyUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId));
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc({text: "The answer is piano.", answer: "piano"}),
      } as MockDocumentSnapshot<any>);

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({auth: {uid: mockUserId}} as CallableRequest<unknown>);

      expect(result.challenge).toBeUndefined();
      expect(result.error).toBe("Daily challenge data is incomplete. Expected 1 question.");
      expect(mockEnsureAuthoritativeSession).not.toHaveBeenCalled();
    });

    it("should reject when the authenticated user profile is missing", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "testUserNotFound";
      mockGetUser.mockResolvedValue(undefined);

      /** Provides mock daily challenge behavior. */
      const mockDailyChallenge = createCurrentDailyRiddleDoc();
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => mockDailyChallenge,
      } as MockDocumentSnapshot<any>);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}} as CallableRequest<unknown>;
      await expect(getCurrentDailyChallenge(mockRequest)).rejects.toMatchObject({code: "not-found"});
    });

    it("binds a requested non-English locale into the private play session", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "frenchDailyUser";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {preferredLanguage: "en"}));
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc({answer: "piano"}),
      } as MockDocumentSnapshot<any>);

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({
        auth: {uid: mockUserId},
        data: {locale: "fr"},
      } as CallableRequest<{
        /** Stores locale. */
        locale?: string;
      }>);

      expect(result.challenge?.questions[0]).toMatchObject({
        answerLength: 5,
        sessionToken: SESSION_TOKEN,
      });
      expect(mockEnsureAuthoritativeSession).toHaveBeenCalledWith(
        mockUserId,
        "challenge",
        "current",
        "fr",
        expect.any(String),
        "challenge:2023-01-01",
        "piano",
        {challengeDate: "2023-01-01"},
      );
    });

    it("returns authoritative Continue state when the client has no saved session", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "awaitingContinueRecovery";
      mockGetUser.mockResolvedValue(getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined}));
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc({answer: "piano"}),
      } as MockDocumentSnapshot<any>);
      mockGetIssuedAuthoritativeSession.mockResolvedValue({
        gameMode: "challenge",
        attempts: 5,
        hasUsedContinue: false,
        awaitingContinue: true,
        terminal: false,
        isCorrect: false,
      });

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({auth: {uid: mockUserId}} as CallableRequest<unknown>);

      expect(result.challenge?.questions[0]).toMatchObject({
        attemptsUsed: 5,
        hasUsedContinue: false,
        awaitingContinue: true,
      });
    });

    it("reconciles a locale-independent pending terminal before issuing another locale", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "parallelLocaleTerminal";
      /** Provides initial behavior. */
      const initial = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: undefined,
        lastDailyChallengeAttemptedKey: "2023-01-01",
      });
      /** Completes d. */
      const completed = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: Date.now(),
        progress: {classicIndex: 1, dailyChallengeIndex: 1, dailyChallengeCurrentQuestion: 1},
      });
      mockGetUser.mockResolvedValueOnce(initial).mockResolvedValueOnce(completed);
      mockRecoverPendingAuthoritativeCompletion.mockResolvedValueOnce(true);
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc(),
      } as MockDocumentSnapshot<any>);

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({
        auth: {uid: mockUserId},
        data: {locale: "de"},
      } as CallableRequest<{
        /** Stores locale. */
        locale?: string;
      }>);

      expect(mockRecoverPendingAuthoritativeCompletion).toHaveBeenCalledWith(
        mockUserId,
        "challenge",
        "challenge:2023-01-01",
        false,
      );
      expect(result).toMatchObject({hasCompletedToday: true, error: "Today's daily challenge is already complete."});
      expect(mockEnsureAuthoritativeSession).not.toHaveBeenCalled();
    });

    it("auto-reconciles a terminal bound win when no client resume token survived", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "lostTerminalWinResponse";
      /** Provides initial behavior. */
      const initial = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});
      /** Completes d. */
      const completed = getDefaultPlayer(mockUserId, {
        lastDailyChallengeCompletedAt: Date.now(),
        progress: {classicIndex: 1, dailyChallengeIndex: 1, dailyChallengeCurrentQuestion: 1},
      });
      mockGetUser.mockResolvedValueOnce(initial).mockResolvedValueOnce(completed);
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc(),
      } as MockDocumentSnapshot<any>);
      mockGetIssuedAuthoritativeSession.mockResolvedValue({
        gameMode: "challenge",
        attempts: 1,
        hasUsedContinue: false,
        awaitingContinue: false,
        terminal: true,
        isCorrect: true,
        challengeDate: "2023-01-01",
        terminalAt: createTimestampMock("2023-01-01T09:59:00.000Z"),
      });

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({auth: {uid: mockUserId}} as CallableRequest<unknown>);

      expect(mockCompleteAuthoritativeGame).toHaveBeenCalledWith(
        {riddleId: "current", gameMode: "challenge", sessionToken: SESSION_TOKEN},
        expect.objectContaining({uid: mockUserId}),
      );
      expect(result).toMatchObject({hasCompletedToday: true, error: "Today's daily challenge is already complete."});
    });

    it("records and rotates a terminal bound loss when no client resume token survived", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "lostTerminalLossResponse";
      /** Provides player behavior. */
      const player = getDefaultPlayer(mockUserId, {lastDailyChallengeCompletedAt: undefined});
      mockGetUser.mockResolvedValue(player);
      mockAdminFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => createCurrentDailyRiddleDoc(),
      } as MockDocumentSnapshot<any>);
      mockEnsureAuthoritativeSession.mockResolvedValueOnce(SESSION_TOKEN).mockResolvedValueOnce(ROTATED_SESSION_TOKEN);
      mockGetIssuedAuthoritativeSession
        .mockResolvedValueOnce({
          gameMode: "challenge",
          attempts: 5,
          hasUsedContinue: false,
          awaitingContinue: false,
          terminal: true,
          isCorrect: false,
          challengeDate: "2023-01-01",
          terminalAt: createTimestampMock("2023-01-01T09:59:00.000Z"),
        })
        .mockResolvedValueOnce({
          gameMode: "challenge",
          attempts: 0,
          hasUsedContinue: false,
          awaitingContinue: false,
          terminal: false,
          isCorrect: false,
        });

      /** Provides result behavior. */
      const result = await getCurrentDailyChallenge({auth: {uid: mockUserId}} as CallableRequest<unknown>);

      expect(mockCompleteAuthoritativeGame).toHaveBeenCalledTimes(1);
      expect(result.challenge?.questions[0].sessionToken).toBe(ROTATED_SESSION_TOKEN);
      expect(result.hasCompletedToday).toBe(false);
    });
  });

  describe("getCurrentClassicRiddle (v2)", () => {
    it("should throw HttpsError if not authenticated", async () => {
      /** Provides mock request behavior. */
      const mockRequest = {auth: undefined, data: {classicIndex: 4}} as CallableRequest<{
        /** Stores classic index. */
        classicIndex?: number;
        /** Stores locale. */
        locale?: string;
      }>;

      await expect(getCurrentClassicRiddle(mockRequest)).rejects.toMatchObject({
        code: "unauthenticated",
        message: "The user must be authenticated to load a classic riddle.",
      });
      expect(mockGetClassicRiddleByIndex).not.toHaveBeenCalled();
    });

    it("should return classic challenge payload for authenticated user", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "classicUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      mockGetClassicRiddleByIndex.mockResolvedValue({
        riddleId: "classic-10",
        text: "Classic question?",
        answer: "ANSWER",
        locale: "en",
      });

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}, data: {classicIndex: 10}} as CallableRequest<{
        /** Stores classic index. */
        classicIndex?: number;
        /** Stores locale. */
        locale?: string;
      }>;

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle(mockRequest);

      expect(result.challenge).toEqual({
        questions: [
          {
            riddleId: "classic-10",
            text: "Classic question?",
            answerLength: 6,
            sessionToken: SESSION_TOKEN,
            questionNumber: 1,
            attemptsUsed: 0,
            hasUsedContinue: false,
            awaitingContinue: false,
          },
        ],
        totalQuestions: 1,
      });
      expect(mockGetClassicRiddleByIndex).toHaveBeenCalledWith(10, "en");
    });

    it("recovers from malformed optional legacy load hints using server-authoritative state", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "classicLegacyHintUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      mockGetClassicRiddleByIndex.mockResolvedValue({
        riddleId: "classic-10",
        text: "Classic question?",
        answer: "ANSWER",
        locale: "en",
      });

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle({
        auth: {uid: mockUserId},
        data: {locale: "en-GB", sessionToken: "legacy-token-without-riddle"},
      });

      expect(result.challenge?.questions[0]).toMatchObject({
        riddleId: "classic-10",
        answerLength: 6,
        sessionToken: SESSION_TOKEN,
      });
      expect(mockGetClassicRiddleByIndex).toHaveBeenCalledWith(10, "en");
    });

    it("should return error when the requested classic riddle is unavailable", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "classicMissingUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      mockGetClassicRiddleByIndex.mockResolvedValue(undefined);

      /** Provides mock request behavior. */
      const mockRequest = {auth: {uid: mockUserId}, data: {classicIndex: 10}} as CallableRequest<{
        /** Stores classic index. */
        classicIndex?: number;
        /** Stores locale. */
        locale?: string;
      }>;

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle(mockRequest);

      expect(result.error).toBe("No classic riddle available at index 10.");
    });

    it("falls back to the same playable English index for invalid legacy localized content", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "legacyLocalizedClassicUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );
      mockGetClassicRiddleByIndex
        .mockResolvedValueOnce({riddleId: "classic-10", text: "Indice local", answer: "deux mots", locale: "fr"})
        .mockResolvedValueOnce({riddleId: "classic-10", text: "English fallback clue?", answer: "clock", locale: "en"});

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle({
        auth: {uid: mockUserId},
        data: {classicIndex: 10, locale: "fr"},
      });

      expect(result.challenge?.questions[0]).toMatchObject({text: "English fallback clue?", answerLength: 5});
      expect(mockGetClassicRiddleByIndex).toHaveBeenNthCalledWith(1, 10, "fr");
      expect(mockGetClassicRiddleByIndex).toHaveBeenNthCalledWith(2, 10, "en");
      expect(mockEnsureAuthoritativeSession).toHaveBeenCalledWith(
        mockUserId,
        "classic",
        "classic-10",
        "en",
        expect.any(String),
        "classic:10",
        "clock",
        {classicIndex: 10},
      );
    });

    it("rejects loading a Classic riddle out of sequence", async () => {
      /** Provides mock user id behavior. */
      const mockUserId = "classicOutOfOrderUser";
      mockGetUser.mockResolvedValue(
        getDefaultPlayer(mockUserId, {
          progress: {classicIndex: 10, dailyChallengeIndex: 0, dailyChallengeCurrentQuestion: 0},
        }),
      );

      await expect(
        getCurrentClassicRiddle({
          auth: {uid: mockUserId},
          data: {classicIndex: 11, locale: "en"},
        }),
      ).rejects.toMatchObject({code: "permission-denied"});
      expect(mockGetClassicRiddleByIndex).not.toHaveBeenCalled();
    });
  });
});

// Helper function to create a CallableRequest mock
// const mockCallableRequest = <T>(data: T, auth?: {uid: string}): CallableRequest<T> => ({
//   data,
//   auth,
// });
