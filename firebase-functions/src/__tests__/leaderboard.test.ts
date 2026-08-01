/**
 * Unit tests for firebase-functions/src/gameplay/leaderboard.ts
 *
 * Covers:
 *  - updateLeaderboardEntry: writes correct data, omits avatarUrl when absent
 *  - getLeaderboard callable: auth guard, type validation, correct ordering,
 *    limit capping, empty result set
 */

const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {info: mockLoggerInfo, warn: jest.fn(), error: mockLoggerError, debug: jest.fn()},
}));

// â”€â”€ firebase-admin mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockOrderBy = jest.fn();
const mockLeaderboardLimit = jest.fn();
const mockLeaderboardGet = jest.fn();
const mockUsersLimit = jest.fn();
const mockUsersGet = jest.fn();
const mockUsersDoc = jest.fn();
const mockUsersDocGet = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}));

const mockDocRef = {set: mockSet};
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

const mockLeaderboardQuery = {
  orderBy: mockOrderBy,
  limit: mockLeaderboardLimit,
  get: mockLeaderboardGet,
};

const mockUsersQuery = {
  get: mockUsersGet,
};

const mockUsersDocRef = {
  get: mockUsersDocGet,
};

mockOrderBy.mockReturnValue(mockLeaderboardQuery);
mockLeaderboardLimit.mockReturnValue(mockLeaderboardQuery);
mockUsersLimit.mockReturnValue(mockUsersQuery);
mockUsersDoc.mockReturnValue(mockUsersDocRef);

const mockCollection = jest.fn((collectionName: string) => {
  if (collectionName === "leaderboard") {
    return {
      doc: mockDoc,
      orderBy: mockOrderBy,
    };
  }
  if (collectionName === "users") {
    return {
      limit: mockUsersLimit,
      doc: mockUsersDoc,
    };
  }
  return {};
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({collection: mockCollection, batch: mockBatch})),
}));

// â”€â”€ firebase-functions/v2/https mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class MockHttpsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const mockOnCall = jest.fn();

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (optionsOrHandler: unknown, maybeHandler?: (req: unknown) => unknown) => {
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

    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("omits avatarUrl when undefined", async () => {
    await updateLeaderboardEntry("uid-4", "Dave", {level: 1, xp: 50, totalWins: 1, bestStreak: 1});

    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("sets a numeric updatedAt timestamp", async () => {
    const before = Date.now();
    await updateLeaderboardEntry("uid-5", "Eve", {level: 1, xp: 0, totalWins: 0, bestStreak: 0});
    const after = Date.now();

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
    // Re-apply chain because clearAllMocks resets return values
    mockOrderBy.mockReturnValue(mockLeaderboardQuery);
    mockLeaderboardLimit.mockReturnValue(mockLeaderboardQuery);
    mockUsersLimit.mockReturnValue(mockUsersQuery);
    mockUsersDoc.mockReturnValue(mockUsersDocRef);
    mockUsersDocGet.mockResolvedValue({
      exists: false,
      data: () => ({}),
    });
  });

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
    const entries = [makeEntry({xp: 900}), makeEntry({userId: "user-2", xp: 400})];
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot(entries));

    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    const typedResult = result as {entries: LeaderboardEntry[]; requestingUserId: string};

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

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(10);
  });

  it("caps limit at 100", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "xp", limit: 9999});

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(100);
  });

  it("defaults limit to 50 when not provided", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "xp"});

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(50);
  });

  it("returns empty entries array when no data", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([]));
    mockUsersGet.mockResolvedValueOnce(makeSnapshot([]));

    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});

    expect(result).toMatchObject({entries: [], requestingUserId: "u1"});
  });

  it("includes requestingUserId in the response", async () => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    const result = await callGetLeaderboard({uid: "my-uid"}, {type: "totalWins"});

    expect((result as {requestingUserId: string}).requestingUserId).toBe("my-uid");
  });

  it("falls back to users collection when leaderboard docs are empty", async () => {
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

    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp", limit: 10});
    const typedResult = result as {entries: LeaderboardEntry[]; requestingUserId: string};

    expect(typedResult.entries).toHaveLength(2);
    expect(typedResult.entries[0].userId).toBe("u1");
    expect(typedResult.entries[1].userId).toBe("u2");
    expect(mockUsersLimit).toHaveBeenCalledWith(1000);
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("dedupes requesting user when legacy duplicate ids share username", async () => {
    const entries = [
      makeEntry({userId: "u1", username: "Me", xp: 700, progressScore: 2_000_000_700}),
      makeEntry({userId: "legacy-u1", username: "Me", xp: 650, progressScore: 2_000_000_650}),
      makeEntry({userId: "u2", username: "Other", xp: 600, progressScore: 2_000_000_600}),
    ];
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot(entries));

    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    const typedResult = result as {entries: LeaderboardEntry[]};

    expect(typedResult.entries.filter((entry) => entry.username === "Me")).toHaveLength(1);
    expect(typedResult.entries.find((entry) => entry.username === "Me")?.userId).toBe("u1");
  });

  it("dedupes requesting user via users/{uid} fallback when canonical uid row is missing", async () => {
    const entries = [
      makeEntry({userId: "legacy-1", username: "Me", xp: 820, progressScore: 2_000_000_820}),
      makeEntry({userId: "legacy-2", username: "Me", xp: 700, progressScore: 2_000_000_700}),
      makeEntry({userId: "u2", username: "Other", xp: 600, progressScore: 2_000_000_600}),
    ];
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot(entries));
    mockUsersDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({username: "Me"}),
    });

    const result = await callGetLeaderboard({uid: "u1"}, {type: "xp"});
    const typedResult = result as {entries: LeaderboardEntry[]};

    expect(mockUsersDoc).toHaveBeenCalledWith("u1");
    expect(typedResult.entries.filter((entry) => entry.username === "Me")).toHaveLength(1);
    expect(typedResult.entries.find((entry) => entry.username === "Me")?.userId).toBe("u1");
  });
});
