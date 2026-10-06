/**
 * Unit tests for firebase-functions/src/gameplay/leaderboard.ts
 *
 * Covers:
 *  - updateLeaderboardEntry: writes correct data, omits avatarUrl when absent
 *  - getLeaderboard callable: auth guard, type validation, correct ordering,
 *    limit capping, empty result set
 */

const mockLoggerInfo = jest.fn();
/** Provides mock logger error behavior. */
const mockLoggerError = jest.fn();
/** Provides mock run with jest account operation lease behavior. */
const mockRunWithJestAccountOperationLease = jest.fn(
  async (_userId: string, _timeoutSeconds: number, operation: () => Promise<unknown>) => operation(),
);

jest.mock("firebase-functions", () => ({
  logger: {info: mockLoggerInfo, warn: jest.fn(), error: mockLoggerError, debug: jest.fn()},
}));

jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual<typeof import("../jest/jestAccountDeletion")>("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

// â”€â”€ firebase-admin mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Provides mock set behavior. */
const mockSet = jest.fn().mockResolvedValue(undefined);
/** Provides mock order by behavior. */
const mockOrderBy = jest.fn();
/** Provides mock leaderboard limit behavior. */
const mockLeaderboardLimit = jest.fn();
/** Provides mock leaderboard get behavior. */
const mockLeaderboardGet = jest.fn();
/** Provides mock users limit behavior. */
const mockUsersLimit = jest.fn();
/** Indexed canonical account query seams. */
const mockUsersWhere = jest.fn();
/** Orders authoritative account statistics. */
const mockUsersOrderBy = jest.fn();
/** Provides mock users get behavior. */
const mockUsersGet = jest.fn();
/** Provides mock users doc behavior. */
const mockUsersDoc = jest.fn();
/** Provides mock users doc get behavior. */
const mockUsersDocGet = jest.fn();
/** Provides mock get all behavior. */
const mockGetAll = jest.fn();
/** Provides mock batch set behavior. */
const mockBatchSet = jest.fn();
/** Provides mock batch commit behavior. */
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
/** Provides mock batch behavior. */
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}));

/** Provides mock doc ref behavior. */
const mockDocRef = {set: mockSet};
/** Provides mock doc behavior. */
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

/** Provides mock leaderboard query behavior. */
const mockLeaderboardQuery = {
  orderBy: mockOrderBy,
  limit: mockLeaderboardLimit,
  get: mockLeaderboardGet,
};

/** Provides mock users query behavior. */
const mockUsersQuery = {
  where: mockUsersWhere,
  orderBy: mockUsersOrderBy,
  limit: mockUsersLimit,
  get: mockUsersGet,
};

mockOrderBy.mockReturnValue(mockLeaderboardQuery);
mockLeaderboardLimit.mockReturnValue(mockLeaderboardQuery);
mockUsersLimit.mockReturnValue(mockUsersQuery);
mockUsersDoc.mockImplementation((id: string) => ({id, path: `users/${id}`, get: mockUsersDocGet}));

/** Provides mock collection behavior. */
const mockCollection = jest.fn((collectionName: string) => {
  if (collectionName === "leaderboard") {
    return {
      doc: mockDoc,
      orderBy: mockOrderBy,
    };
  }
  if (collectionName === "users") {
    return {
      where: mockUsersWhere,
      orderBy: mockUsersOrderBy,
      limit: mockUsersLimit,
      doc: mockUsersDoc,
    };
  }
  return {};
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({collection: mockCollection, batch: mockBatch, getAll: mockGetAll})),
}));

// â”€â”€ firebase-functions/v2/https mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Provides mock https error behavior. */
class MockHttpsError extends Error {
  /** Stores code. */
  code: string;
  /** Creates a mock https error instance. */
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Provides mock on call behavior. */
const mockOnCall = jest.fn();

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (optionsOrHandler: unknown, maybeHandler?: (req: unknown) => unknown) => {
    /** Handles r. */
    const handler = typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler;
    if (!handler) {
      throw new Error("onCall mock requires a handler");
    }
    mockOnCall.mockImplementation(handler);
    return mockOnCall;
  },
  HttpsError: MockHttpsError,
}));

// â”€â”€ Import under test (after mocks) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import {updateLeaderboardEntry, getLeaderboard, LeaderboardEntry} from "../gameplay/leaderboard";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Creates entry. */
function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: "user-1",
    username: "TestUser",
    level: 2,
    xp: 500,
    progressScore: 2_000_000_500,
    totalWins: 10,
    bestStreak: 5,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

/** Creates snapshot. */
function makeSnapshot(entries: LeaderboardEntry[]) {
  return {
    docs: entries.map((e) => ({id: e.userId, data: () => e})),
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// updateLeaderboardEntry
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("updateLeaderboardEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes the correct entry document", async () => {
    await updateLeaderboardEntry("uid-1", "Alice", {level: 2, xp: 300, totalWins: 6, bestStreak: 3});

    expect(mockDoc).toHaveBeenCalledWith("uid-1");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-1",
        subjectUserId: "uid-1",
        username: "Alice",
        level: 2,
        xp: 300,
        progressScore: 2_000_000_300,
        totalWins: 6,
        bestStreak: 3,
      }),
      {merge: true},
    );
  });

  it("includes avatarUrl when provided", async () => {
    await updateLeaderboardEntry(
      "uid-2",
      "Bob",
      {level: 1, xp: 100, totalWins: 2, bestStreak: 1},
      "https://example.com/avatar.jpg",
    );

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({avatarUrl: "https://example.com/avatar.jpg"}), {
      merge: true,
    });
  });

  it("omits avatarUrl when null", async () => {
    await updateLeaderboardEntry("uid-3", "Carol", {level: 1, xp: 50, totalWins: 1, bestStreak: 1}, null);

    /** Provides call arg behavior. */
    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("omits avatarUrl when undefined", async () => {
    await updateLeaderboardEntry("uid-4", "Dave", {level: 1, xp: 50, totalWins: 1, bestStreak: 1});

    /** Provides call arg behavior. */
    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("sets a numeric updatedAt timestamp", async () => {
    /** Provides before behavior. */
    const before = Date.now();
    await updateLeaderboardEntry("uid-5", "Eve", {level: 1, xp: 0, totalWins: 0, bestStreak: 0});
    /** Provides after behavior. */
    const after = Date.now();

    /** Provides call arg behavior. */
    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.updatedAt).toBeGreaterThanOrEqual(before);
    expect(callArg.updatedAt).toBeLessThanOrEqual(after);
  });

  it("logs an info message after writing", async () => {
    await updateLeaderboardEntry("uid-6", "Frank", {level: 1, xp: 0, totalWins: 0, bestStreak: 0});

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("uid-6"));
  });
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// getLeaderboard callable
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("getLeaderboard callable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLeaderboardGet.mockReset();
    mockUsersGet.mockReset();
    mockUsersDocGet.mockReset();
    mockGetAll.mockReset();
    // Re-apply chain because clearAllMocks resets return values
    mockOrderBy.mockReturnValue(mockLeaderboardQuery);
    mockLeaderboardLimit.mockReturnValue(mockLeaderboardQuery);
    mockUsersLimit.mockReturnValue(mockUsersQuery);
    mockUsersWhere.mockReturnValue(mockUsersQuery);
    mockUsersOrderBy.mockReturnValue(mockUsersQuery);
    mockUsersDoc.mockImplementation((id: string) => ({id, path: `users/${id}`, get: mockUsersDocGet}));
    mockGetAll.mockImplementation(
      async (
        ...refs: Array<{
          /** Stores id. */
          id: string;
        }>
      ) => refs.map((ref) => ({exists: true, id: ref.id})),
    );
    mockUsersDocGet.mockResolvedValue({
      exists: false,
      data: () => ({}),
    });
  });

  /** Provides call get leaderboard behavior. */
  function callGetLeaderboard(auth: unknown, data: unknown) {
    // getLeaderboard is assigned by onCall mock â€” call the registered handler
    return mockOnCall({auth, data});
  }

  it("throws unauthenticated when auth is missing", async () => {
    await expect(callGetLeaderboard(null, {type: "xp"})).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws invalid-argument for an unknown type", async () => {
    await expect(callGetLeaderboard({uid: "u1"}, {type: "unknown"})).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("returns entries sorted by level + xp progression score", async () => {
    /** Provides entries behavior. */
    const entries = [makeEntry({xp: 900}), makeEntry({userId: "user-2", xp: 400})];
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot(entries));

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    /** Provides typed result behavior. */
    const typedResult = result as {
      /** Stores entries. */
      entries: LeaderboardEntry[]; /** Stores requesting user id. */
      /** Stores requesting user id. */
      requestingUserId: string;
    };

    expect(mockOrderBy).toHaveBeenCalledWith("progressScore", "desc");
    expect(typedResult.requestingUserId).toBe("u1");
    expect(typedResult.entries).toMatchObject([
      expect.objectContaining({
        userId: "user-1",
        xp: 900,
        progressScore: 2_000_000_900,
      }),
      expect.objectContaining({
        userId: "user-2",
        xp: 400,
        progressScore: 2_000_000_400,
      }),
    ]);
  });

  it("ranks existing canonical multiplayer totals without reading stale leaderboard projections", async () => {
    mockUsersGet.mockResolvedValue({docs: [
      {id: "multiplayer-champion", data: () => ({username: "Champion", avatarUrl: "https://example.com/a.png", stats: {level: 3, xp: 50, multiplayerWins: 42, totalWins: 2}})},
      {id: "runner-up", data: () => ({displayName: "Runner", stats: {multiplayerWins: 8, totalWins: 100}})},
    ]});
    /** Indexed account rankings returned by the callable. */
    const result = await callGetLeaderboard({uid: "viewer"}, {type: "multiplayerWins", limit: 25});
    expect(mockUsersWhere).toHaveBeenCalledWith("stats.multiplayerWins", ">", 0);
    expect(mockUsersOrderBy).toHaveBeenCalledWith("stats.multiplayerWins", "desc");
    expect(mockUsersLimit).toHaveBeenCalledWith(25);
    expect(mockLeaderboardGet).not.toHaveBeenCalled();
    expect(result).toMatchObject({requestingUserId: "viewer", entries: [
      {userId: "multiplayer-champion", username: "Champion", multiplayerWins: 42, totalWins: 2},
      {userId: "runner-up", username: "Runner", multiplayerWins: 8, totalWins: 100},
    ]});
  });

  it("returns an empty multiplayer board without falling back to solo scores", async () => {
    mockUsersGet.mockResolvedValue({docs: []});
    expect(await callGetLeaderboard({uid: "viewer"}, {type: "multiplayerWins"})).toEqual({entries: [], requestingUserId: "viewer"});
    expect(mockUsersLimit).toHaveBeenCalledWith(50);
    expect(mockLeaderboardGet).not.toHaveBeenCalled();
  });

  it("returns entries sorted by totalWins", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {type: "totalWins"});

    expect(mockOrderBy).toHaveBeenCalledWith("totalWins", "desc");
  });

  it("returns entries sorted by bestStreak", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {type: "bestStreak"});

    expect(mockOrderBy).toHaveBeenCalledWith("bestStreak", "desc");
  });

  it("defaults to xp when type is omitted", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {});

    expect(mockOrderBy).toHaveBeenCalledWith("progressScore", "desc");
  });

  it("applies the requested limit", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "xp", limit: 10});

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(20);
  });

  it("rejects limits above 100 before querying Firestore", async () => {
    await expect(callGetLeaderboard({uid: "u1"}, {type: "xp", limit: 101})).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(mockLeaderboardGet).not.toHaveBeenCalled();
    expect(mockUsersGet).not.toHaveBeenCalled();
  });

  it("defaults limit to 50 when not provided", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "xp"});

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(100);
  });

  it("returns empty entries array when no data", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});

    expect(result).toMatchObject({entries: [], requestingUserId: "u1"});
  });

  it("includes requestingUserId in the response", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "my-uid"}, {type: "totalWins"});

    expect(
      (
        result as {
          /** Stores requesting user id. */
          requestingUserId: string;
        }
      ).requestingUserId,
    ).toBe("my-uid");
  });

  it("derives from live users without backfilling a snapshot that could race deletion", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce({
      docs: [
        {
          id: "u2",
          data: () => ({
            username: "Bob",
            stats: {level: 1, xp: 300, totalWins: 4, bestStreak: 2},
          }),
        },
        {
          id: "u1",
          data: () => ({
            username: "Alice",
            stats: {level: 2, xp: 100, totalWins: 10, bestStreak: 7},
          }),
        },
      ],
    });

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp", limit: 10});
    /** Provides typed result behavior. */
    const typedResult = result as {
      /** Stores entries. */
      entries: LeaderboardEntry[]; /** Stores requesting user id. */
      /** Stores requesting user id. */
      requestingUserId: string;
    };

    expect(typedResult.entries).toHaveLength(2);
    expect(typedResult.entries[0].userId).toBe("u1");
    expect(typedResult.entries[1].userId).toBe("u2");
    expect(mockUsersLimit).toHaveBeenCalledWith(1000);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("suppresses orphan legacy rows without matching on username or avatar", async () => {
    /** Provides entries behavior. */
    const entries = [
      makeEntry({userId: "u1", username: "Me", xp: 700, progressScore: 2_000_000_700}),
      makeEntry({userId: "legacy-u1", username: "Me", xp: 650, progressScore: 2_000_000_650}),
      makeEntry({userId: "u2", username: "Other", xp: 600, progressScore: 2_000_000_600}),
    ];
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot(entries));
    mockGetAll.mockImplementationOnce(
      async (
        ...refs: Array<{
          /** Stores id. */
          id: string;
        }>
      ) => refs.map((ref) => ({exists: ref.id !== "legacy-u1", id: ref.id})),
    );

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    /** Provides typed result behavior. */
    const typedResult = result as {
      /** Stores entries. */
      entries: LeaderboardEntry[];
    };

    expect(typedResult.entries.filter((entry) => entry.username === "Me")).toHaveLength(1);
    expect(typedResult.entries.find((entry) => entry.username === "Me")?.userId).toBe("u1");
  });

  it("suppresses a noncanonical row even when its embedded user is live", async () => {
    mockLeaderboardGet.mockResolvedValueOnce({
      docs: [
        {
          id: "legacy-u1",
          data: () => makeEntry({userId: "u1", username: "Me"}),
        },
        {
          id: "u2",
          data: () => makeEntry({userId: "u2", username: "Other"}),
        },
      ],
    });

    /** Provides result behavior. */
    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    /** Provides typed result behavior. */
    const typedResult = result as {
      /** Stores entries. */
      entries: LeaderboardEntry[];
    };

    expect(typedResult.entries).toEqual([expect.objectContaining({userId: "u2", username: "Other"})]);
    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({id: "u2"}));
  });
});
