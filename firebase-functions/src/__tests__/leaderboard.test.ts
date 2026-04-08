/**
 * Unit tests for firebase-functions/src/leaderboard.ts
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

// ── firebase-admin mock ──────────────────────────────────────────────────────

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockGet = jest.fn();

const mockDocRef = {set: mockSet};
const mockDoc = jest.fn().mockReturnValue(mockDocRef);

const mockQuery = {
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockGet,
};

mockOrderBy.mockReturnValue(mockQuery);
mockLimit.mockReturnValue(mockQuery);

const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
  orderBy: mockOrderBy,
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: jest.fn(() => ({collection: mockCollection})),
}));

// ── firebase-functions/v2/https mock ────────────────────────────────────────

class MockHttpsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const mockOnCall = jest.fn();

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (handler: (req: unknown) => unknown) => {
    mockOnCall.mockImplementation(handler);
    return mockOnCall;
  },
  HttpsError: MockHttpsError,
}));

// ── Import under test (after mocks) ─────────────────────────────────────────

import {updateLeaderboardEntry, getLeaderboard, LeaderboardEntry} from "../leaderboard";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: "user-1",
    username: "TestUser",
    totalScore: 500,
    totalWins: 10,
    bestStreak: 5,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

function makeSnapshot(entries: LeaderboardEntry[]) {
  return {
    docs: entries.map((e) => ({data: () => e})),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// updateLeaderboardEntry
// ────────────────────────────────────────────────────────────────────────────

describe("updateLeaderboardEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes the correct entry document", async () => {
    await updateLeaderboardEntry("uid-1", "Alice", {totalScore: 300, totalWins: 6, bestStreak: 3});

    expect(mockDoc).toHaveBeenCalledWith("uid-1");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid-1",
        username: "Alice",
        totalScore: 300,
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
      {totalScore: 100, totalWins: 2, bestStreak: 1},
      "https://example.com/avatar.jpg",
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({avatarUrl: "https://example.com/avatar.jpg"}),
      {merge: true},
    );
  });

  it("omits avatarUrl when null", async () => {
    await updateLeaderboardEntry("uid-3", "Carol", {totalScore: 50, totalWins: 1, bestStreak: 1}, null);

    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("omits avatarUrl when undefined", async () => {
    await updateLeaderboardEntry("uid-4", "Dave", {totalScore: 50, totalWins: 1, bestStreak: 1});

    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.avatarUrl).toBeUndefined();
  });

  it("sets a numeric updatedAt timestamp", async () => {
    const before = Date.now();
    await updateLeaderboardEntry("uid-5", "Eve", {totalScore: 0, totalWins: 0, bestStreak: 0});
    const after = Date.now();

    const callArg = mockSet.mock.calls[0][0] as LeaderboardEntry;
    expect(callArg.updatedAt).toBeGreaterThanOrEqual(before);
    expect(callArg.updatedAt).toBeLessThanOrEqual(after);
  });

  it("logs an info message after writing", async () => {
    await updateLeaderboardEntry("uid-6", "Frank", {totalScore: 0, totalWins: 0, bestStreak: 0});

    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("uid-6"));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getLeaderboard callable
// ────────────────────────────────────────────────────────────────────────────

describe("getLeaderboard callable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply chain because clearAllMocks resets return values
    mockOrderBy.mockReturnValue(mockQuery);
    mockLimit.mockReturnValue(mockQuery);
  });

  function callGetLeaderboard(auth: unknown, data: unknown) {
    // getLeaderboard is assigned by onCall mock — call the registered handler
    return mockOnCall({auth, data});
  }

  it("throws unauthenticated when auth is missing", async () => {
    await expect(callGetLeaderboard(null, {type: "totalScore"})).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws invalid-argument for an unknown type", async () => {
    await expect(
      callGetLeaderboard({uid: "u1"}, {type: "unknown"}),
    ).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("returns entries sorted by totalScore", async () => {
    const entries = [makeEntry({totalScore: 900}), makeEntry({userId: "user-2", totalScore: 400})];
    mockGet.mockResolvedValueOnce(makeSnapshot(entries));

    const result = await callGetLeaderboard({uid: "u1"}, {type: "totalScore"});

    expect(mockOrderBy).toHaveBeenCalledWith("totalScore", "desc");
    expect(result).toMatchObject({entries, requestingUserId: "u1"});
  });

  it("returns entries sorted by totalWins", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {type: "totalWins"});

    expect(mockOrderBy).toHaveBeenCalledWith("totalWins", "desc");
  });

  it("returns entries sorted by bestStreak", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {type: "bestStreak"});

    expect(mockOrderBy).toHaveBeenCalledWith("bestStreak", "desc");
  });

  it("defaults to totalScore when type is omitted", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    await callGetLeaderboard({uid: "u1"}, {});

    expect(mockOrderBy).toHaveBeenCalledWith("totalScore", "desc");
  });

  it("applies the requested limit", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "totalScore", limit: 10});

    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it("caps limit at 100", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "totalScore", limit: 9999});

    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it("defaults limit to 50 when not provided", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    await callGetLeaderboard({uid: "u1"}, {type: "totalScore"});

    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it("returns empty entries array when no data", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([]));

    const result = await callGetLeaderboard({uid: "u1"}, {type: "totalScore"});

    expect(result).toMatchObject({entries: [], requestingUserId: "u1"});
  });

  it("includes requestingUserId in the response", async () => {
    mockGet.mockResolvedValueOnce(makeSnapshot([makeEntry()]));

    const result = await callGetLeaderboard({uid: "my-uid"}, {type: "totalWins"});

    expect((result as {requestingUserId: string}).requestingUserId).toBe("my-uid");
  });
});
