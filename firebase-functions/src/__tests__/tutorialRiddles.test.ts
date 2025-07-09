import {beforeEach, describe, expect, it, jest, beforeAll} from "@jest/globals";
import {HttpsError as HttpsErrorV2, CallableRequest as CallableRequestV2} from "firebase-functions/v2/https";
import {
  getCurrentTutorialRiddle as getCurrentTutorialRiddleOriginal,
  advanceTutorialProgress as advanceTutorialProgressOriginal,
} from "../tutorialRiddles";
import {getUser} from "../firestoreService";
import {DecodedIdToken} from "firebase-admin/auth";

// Mock document snapshot interface
interface MockDocumentSnapshot {
  exists: boolean;
  data: () => unknown;
}

// --- Mocks Start ---
jest.mock("../firestoreService", () => ({
  getUser: jest.fn(),
}));

const mockFirestoreGet = jest.fn();
const mockFirestoreSet = jest.fn();
const mockFirestoreAdd = jest.fn();
const mockFirestoreUpdate = jest.fn();
const mockFirestoreCount = jest.fn();

// Create a chainable mock that can handle nested collection/doc calls
interface MockFirestoreRef {
  get: jest.MockedFunction<() => Promise<MockDocumentSnapshot>>;
  set: jest.MockedFunction<(data: unknown, options?: unknown) => Promise<void>>;
  update: jest.MockedFunction<(data: unknown) => Promise<void>>;
  collection: jest.MockedFunction<(name: string) => MockFirestoreRef>;
  doc: jest.MockedFunction<(id: string) => MockFirestoreRef>;
  where: jest.MockedFunction<(field: string, op: unknown, value: unknown) => MockFirestoreRef>;
  limit: jest.MockedFunction<(count: number) => MockFirestoreRef>;
  add: jest.MockedFunction<(data: unknown) => Promise<unknown>>;
  count: jest.MockedFunction<() => MockFirestoreRef>;
}

const createMockFirestoreRef = (): MockFirestoreRef => ({
  get: mockFirestoreGet,
  set: mockFirestoreSet,
  update: mockFirestoreUpdate,
  collection: jest.fn(() => createMockFirestoreRef()),
  doc: jest.fn(() => createMockFirestoreRef()),
  where: jest.fn(() => createMockFirestoreRef()),
  limit: jest.fn(() => createMockFirestoreRef()),
  add: mockFirestoreAdd,
  count: jest.fn(() => createMockFirestoreRef()),
});

const mockFirestoreRoot = createMockFirestoreRef();

jest.mock("firebase-admin", () => {
  return {
    initializeApp: jest.fn(),
    firestore: () => mockFirestoreRoot,
  };
});

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

// Cast the imported functions to their handler types
const getCurrentTutorialRiddle = getCurrentTutorialRiddleOriginal as unknown as (
  request: CallableRequestV2<unknown>,
) => Promise<unknown>;

const advanceTutorialProgress = advanceTutorialProgressOriginal as unknown as (
  request: CallableRequestV2<unknown>,
) => Promise<unknown>;

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

describe("Tutorial Riddles Functions", () => {
  const mockUserId = "testUser123";

  const mockUser = {
    userId: mockUserId,
    email: "test@example.com",
    username: "TestUser",
    xp: 0,
    coins: 100,
    hasPurchasedApp: false,
    progress: {
      classicIndex: 1,
      dailyChallengeIndex: 1,
      tutorialIndex: 0,
    },
    stats: {
      gamesPlayed: 0,
      wins: 0,
      totalWins: 0,
      winStreak: 0,
      bestStreak: 0,
      averageGuesses: 0,
      winRate: 0,
      challengeWins: 0,
      totalGuessesInWins: 0,
      dailyPuzzlesCompleted: 0,
      totalWordsGuessed: 0,
      totalScore: 0,
      highestLevelClassic: 0,
    },
    registeredAt: Date.now(),
    lastLogin: Date.now(),
  };

  const mockTutorialRiddle = {
    riddleId: "tutorial_1",
    text: "This is a tutorial riddle",
    answer: "TUTORIAL",
    tutorialIndex: 0,
    difficulty: "easy",
  };

  beforeAll(() => {
    (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(mockUser);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestoreGet.mockReset();
    mockFirestoreSet.mockReset();
    mockFirestoreAdd.mockReset();
    mockFirestoreUpdate.mockReset();
    mockFirestoreCount.mockReset();

    // Set up admin.firestore mocking
    const mockCollection = jest.fn();
    const mockDoc = jest.fn();
    const mockWhere = jest.fn();
    const mockLimit = jest.fn();
    const mockOrderBy = jest.fn();

    const mockQueryRef = {
      get: mockFirestoreGet,
      limit: mockLimit,
      where: mockWhere,
      orderBy: mockOrderBy,
    };

    const mockDocRef = {
      get: mockFirestoreGet,
      set: mockFirestoreSet,
      update: mockFirestoreUpdate,
      collection: mockCollection,
    };

    const mockCountRef = {
      get: jest.fn().mockResolvedValue({data: () => ({count: 5})}),
    };

    const mockCollectionRef = {
      doc: mockDoc,
      get: mockFirestoreGet,
      add: mockFirestoreAdd,
      where: mockWhere,
      limit: mockLimit,
      orderBy: mockOrderBy,
      count: jest.fn().mockReturnValue(mockCountRef),
    };

    mockCollection.mockReturnValue(mockCollectionRef);
    mockDoc.mockReturnValue(mockDocRef);
    mockWhere.mockReturnValue(mockQueryRef);
    mockLimit.mockReturnValue(mockQueryRef);
    mockOrderBy.mockReturnValue(mockQueryRef);

    // The firebase-admin mock is already set up at the top of the file

    (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(mockUser);
  });

  describe("getCurrentTutorialRiddle", () => {
    it("should return the current tutorial riddle for authenticated user", async () => {
      const mockAuth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({}, mockAuth);

      // Mock Firestore to return a tutorial riddle
      mockFirestoreGet.mockImplementation(() =>
        Promise.resolve({
          exists: true,
          data: () => mockTutorialRiddle,
        }),
      );

      // Mock count query
      mockFirestoreCount.mockImplementation(() => ({
        get: () => Promise.resolve({data: () => ({count: 5})}),
      }));

      const result = await getCurrentTutorialRiddle(request);

      expect(result).toMatchObject({
        riddle: {
          riddleId: mockTutorialRiddle.riddleId,
          text: mockTutorialRiddle.text,
          tutorialIndex: mockTutorialRiddle.tutorialIndex,
          difficulty: mockTutorialRiddle.difficulty,
        },
      });
      expect(getUser).toHaveBeenCalledWith(mockUserId);
    });

    it("should throw HttpsError when user is not authenticated", async () => {
      const request = createMockCallableRequest({}, undefined);

      await expect(getCurrentTutorialRiddle(request)).rejects.toThrow(HttpsErrorV2);
    });

    it("should handle user not found", async () => {
      const mockAuth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({}, mockAuth);

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      await expect(getCurrentTutorialRiddle(request)).rejects.toThrow(HttpsErrorV2);
    });
  });

  describe("advanceTutorialProgress", () => {
    it("should advance tutorial progress for authenticated user", async () => {
      const mockAuth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({}, mockAuth);

      // Mock count query
      mockFirestoreCount.mockImplementation(() => ({
        get: () => Promise.resolve({data: () => ({count: 5})}),
      }));

      // Mock user update
      mockFirestoreUpdate.mockResolvedValue();

      const result = await advanceTutorialProgress(request);

      expect(result).toMatchObject({
        newTutorialIndex: 1,
        isCompleted: false,
      });
      expect(getUser).toHaveBeenCalledWith(mockUserId);
      expect(mockFirestoreUpdate).toHaveBeenCalledWith({
        "progress.tutorialIndex": 1,
      });
    });

    it("should throw HttpsError when user is not authenticated", async () => {
      const request = createMockCallableRequest({}, undefined);

      await expect(advanceTutorialProgress(request)).rejects.toThrow(HttpsErrorV2);
    });

    it("should handle user not found", async () => {
      const mockAuth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({}, mockAuth);

      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(null);

      await expect(advanceTutorialProgress(request)).rejects.toThrow(HttpsErrorV2);
    });

    it("should mark tutorial as completed when reaching the end", async () => {
      const mockAuth = createMockAuth(mockUserId);
      const request = createMockCallableRequest({}, mockAuth);

      // User at tutorial index 4, with 5 total riddles (0-4)
      const userAtEnd = {
        ...mockUser,
        progress: {...mockUser.progress, tutorialIndex: 4},
      };
      (getUser as ReturnType<typeof jest.fn>).mockResolvedValue(userAtEnd);

      // Mock count query - 5 total riddles
      mockFirestoreCount.mockImplementation(() => ({
        get: () => Promise.resolve({data: () => ({count: 5})}),
      }));

      mockFirestoreUpdate.mockResolvedValue();

      const result = await advanceTutorialProgress(request);

      expect(result).toMatchObject({
        newTutorialIndex: 5,
        isCompleted: true,
      });
    });
  });
});
