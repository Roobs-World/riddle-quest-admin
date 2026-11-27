/**
 * Unit tests for firebase-functions/src/gameplay/leaderboard.ts
 *
 * Covers:
 *  - updateLeaderboardEntry: projects current authority atomically and removes absent avatars
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

jest.mock("../shared/accountDeletion", () => ({
  ...jest.requireActual<typeof import("../shared/accountDeletion")>("../shared/accountDeletion"),
  runWithJestAccountOperationLease: mockRunWithJestAccountOperationLease,
}));

// â”€â”€ firebase-admin mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Provides mock set behavior. */
const mockSet = jest.fn().mockResolvedValue(undefined);
/** Each writer attempt gets a fresh canonical profile. */
const mockTransactionGet = jest.fn();
/** Models one masked SDK account read while retaining the canonical snapshot/error injector. */
const mockTransactionGetAll = jest.fn(async (ref: unknown, _options: unknown) => [await mockTransactionGet(ref)]);
/** Public rows are replaced atomically, including removal of obsolete identity fields. */
const mockTransactionSet = jest.fn();
/** Transaction callback seam exercises retry reads without caching account snapshots. */
const mockRunTransaction = jest.fn(async (operation: (transaction: {
  /** Reads authority on each attempt. */
  get: typeof mockTransactionGet;
  /** Reads one canonical document with the public field mask. */
  getAll: typeof mockTransactionGetAll;
  /** Replaces the public row. */
  set: typeof mockTransactionSet;
}) => Promise<unknown>) =>
  operation({get: mockTransactionGet, getAll: mockTransactionGetAll, set: mockTransactionSet}));
/** Provides mock order by behavior. */
const mockOrderBy = jest.fn();
/** Provides mock leaderboard limit behavior. */
const mockLeaderboardLimit = jest.fn();
/** Provides mock leaderboard get behavior. */
const mockLeaderboardGet = jest.fn();
const mockLeaderboardStartAfter = jest.fn();
/** Provides mock users limit behavior. */
const mockUsersLimit = jest.fn();
/** Indexed canonical account query seams. */
const mockUsersWhere = jest.fn();
/** Orders authoritative account statistics. */
const mockUsersOrderBy = jest.fn();
/** Selects only public fields required by canonical rankings. */
const mockUsersSelect = jest.fn();
/** Provides mock users get behavior. */
const mockUsersGet = jest.fn();
const mockUsersStartAfter = jest.fn();
/** Provides mock users doc behavior. */
const mockUsersDoc = jest.fn();
/** Provides mock users doc get behavior. */
const mockUsersDocGet = jest.fn();
/** Canonical display snapshots are independent from copied leaderboard rows in regressions. */
const mockProfileDocs = new Map<string, Record<string, unknown>>();
/** Mirrors the SDK's argument order while ignoring the trailing read-options object. */
const mockReadProfiles = async (...refs: Array<{
  /** A document argument has an ID; a read-options argument does not. */
  id?: string;
}>) => refs.flatMap(ref => ref.id === undefined ? [] : [{exists: true, id: ref.id, data: () => mockProfileDocs.get(ref.id!)}]);
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
  startAfter: mockLeaderboardStartAfter,
  get: mockLeaderboardGet,
};

/** Provides mock users query behavior. */
const mockUsersQuery = {
  where: mockUsersWhere,
  orderBy: mockUsersOrderBy,
  limit: mockUsersLimit,
  select: mockUsersSelect,
  startAfter: mockUsersStartAfter,
  get: mockUsersGet,
};

/** Dedicated bot rankings remain empty unless a case supplies confirmed wins. */
const mockRaceBotGet = jest.fn();
/** The real bot projection parses these query results before the callable merges them. */
const mockRaceBotQuery = {
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  get: mockRaceBotGet,
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
      select: mockUsersSelect,
      doc: mockUsersDoc,
    };
  }
  if (collectionName === "raceBotLeaderboard") return mockRaceBotQuery;
  return {};
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
  firestore: Object.assign(
    jest.fn(() => ({collection: mockCollection, batch: mockBatch, getAll: mockGetAll, runTransaction: mockRunTransaction})),
    {FieldPath: {documentId: () => "__name__"}},
  ),
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

import {createHash} from "node:crypto";
import {updateLeaderboardEntry, getLeaderboard} from "../gameplay/leaderboard";
import type {LeaderboardEntry} from "../../../src/platform/contracts/requestSchemas";

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
    docs: entries.map((e) => {
      mockProfileDocs.set(e.userId, {username: e.username, avatarUrl: e.avatarUrl});
      return {id: e.userId, data: () => e};
    }),
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// updateLeaderboardEntry
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("updateLeaderboardEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionGet.mockReset().mockResolvedValue({exists: true, data: () => ({username: "Alice", stats: {level: 2, xp: 300, totalWins: 6, bestStreak: 3}})});
  });

  it("writes a complete canonical row in the account transaction", async () => {
    await updateLeaderboardEntry("uid-1");
    expect(mockTransactionGet).toHaveBeenCalledWith(expect.objectContaining({path: "users/uid-1"}));
    expect(mockTransactionGetAll).toHaveBeenCalledWith(expect.objectContaining({path: "users/uid-1"}),
      {fieldMask: ["username", "displayName", "avatarUrl", "stats.level", "stats.xp", "stats.totalWins", "stats.bestStreak", "stats.multiplayerWins"]});
    expect(mockTransactionSet).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({
      userId: "uid-1", subjectUserId: "uid-1", username: "Alice", level: 2, xp: 300,
      progressScore: 2_000_000_300, totalWins: 6, bestStreak: 3,
    }));
    // A replacement clears absent avatars instead of retaining them through merge.
    expect(mockTransactionSet.mock.calls[0]).toHaveLength(2);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("includes the current canonical avatar", async () => {
    mockTransactionGet.mockResolvedValueOnce({exists: true, data: () => ({username: "Bob", avatarUrl: "https://example.com/avatar.jpg"})});
    await updateLeaderboardEntry("uid-2");
    expect(mockTransactionSet).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({avatarUrl: "https://example.com/avatar.jpg"}));
  });

  it.each([null, undefined])("omits removed canonical avatar %s from its replacement", async avatarUrl => {
    mockTransactionGet.mockResolvedValueOnce({exists: true, data: () => ({username: "Carol", avatarUrl})});
    await updateLeaderboardEntry("uid-3");
    expect(mockTransactionSet.mock.calls[0][1]).not.toHaveProperty("avatarUrl");
  });

  it("does not write or log a successful update when the canonical account is missing", async () => {
    mockTransactionGet.mockResolvedValueOnce({exists: false});
    await updateLeaderboardEntry("uid-4");
    expect(mockTransactionSet).not.toHaveBeenCalled();
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("sets a numeric updatedAt timestamp and logs only after commit", async () => {
    /** The committed row records a timestamp inside the observed call interval. */
    const before = Date.now();
    await updateLeaderboardEntry("uid-5");
    expect(mockTransactionSet.mock.calls[0][1].updatedAt).toBeGreaterThanOrEqual(before);
    expect(mockTransactionSet.mock.calls[0][1].updatedAt).toBeLessThanOrEqual(Date.now());
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
  });

  it("reads changed canonical fields again on a transaction retry", async () => {
    mockTransactionGet.mockResolvedValueOnce({exists: true, data: () => ({username: "Old", stats: {level: 1, totalWins: 2}})})
      .mockResolvedValueOnce({exists: true, data: () => ({username: "Current", stats: {level: 3, totalWins: 8}})});
    mockRunTransaction.mockImplementationOnce(async operation => {
      await operation({get: mockTransactionGet, getAll: mockTransactionGetAll, set: mockTransactionSet});
      return operation({get: mockTransactionGet, getAll: mockTransactionGetAll, set: mockTransactionSet});
    });
    await updateLeaderboardEntry("uid-6");
    expect(mockTransactionGet).toHaveBeenCalledTimes(2);
    expect(mockTransactionSet).toHaveBeenLastCalledWith(mockDocRef, expect.objectContaining({username: "Current", level: 3, totalWins: 8}));
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
  });

  it("keeps a fieldless canonical account live and publishes existing public defaults", async () => {
    mockTransactionGet.mockResolvedValueOnce({exists: true, data: () => ({coins: 550})});
    await updateLeaderboardEntry("uid-empty");
    expect(mockTransactionGetAll).toHaveBeenCalledTimes(1);
    expect(mockTransactionSet).toHaveBeenCalledWith(mockDocRef, expect.objectContaining({userId: "uid-empty", subjectUserId: "uid-empty",
      username: "Player", level: 1, xp: 0, totalWins: 0, bestStreak: 0, multiplayerWins: 0}));
  });

  it("does not reuse first-attempt membership when the account is gone on retry", async () => {
    mockTransactionGet.mockResolvedValueOnce({exists: true, data: () => ({username: "First attempt"})}).mockResolvedValueOnce({exists: false});
    mockRunTransaction.mockImplementationOnce(async operation => {
      await operation({get: mockTransactionGet, getAll: mockTransactionGetAll, set: mockTransactionSet});
      return operation({get: mockTransactionGet, getAll: mockTransactionGetAll, set: mockTransactionSet});
    });
    await updateLeaderboardEntry("uid-deleted");
    expect(mockTransactionGetAll).toHaveBeenCalledTimes(2);
    // One queued first-attempt write is discarded by the transaction boundary, with no second write or success log.
    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("propagates a canonical read failure without publishing a partial row", async () => {
    mockTransactionGet.mockRejectedValueOnce(new Error("account unavailable"));
    await expect(updateLeaderboardEntry("uid-7")).rejects.toThrow("account unavailable");
    expect(mockTransactionSet).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
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
    mockRaceBotGet.mockReset().mockResolvedValue({docs: []});
    mockUsersDocGet.mockReset();
    mockGetAll.mockReset();
    mockProfileDocs.clear();
    // Re-apply chain because clearAllMocks resets return values
    mockOrderBy.mockReturnValue(mockLeaderboardQuery);
    mockLeaderboardLimit.mockReturnValue(mockLeaderboardQuery);
    mockLeaderboardStartAfter.mockReturnValue(mockLeaderboardQuery);
    mockUsersLimit.mockReturnValue(mockUsersQuery);
    mockUsersSelect.mockReturnValue(mockUsersQuery);
    mockUsersWhere.mockReturnValue(mockUsersQuery);
    mockUsersOrderBy.mockReturnValue(mockUsersQuery);
    mockUsersStartAfter.mockReturnValue(mockUsersQuery);
    mockRaceBotQuery.where.mockReturnValue(mockRaceBotQuery);
    mockRaceBotQuery.orderBy.mockReturnValue(mockRaceBotQuery);
    mockRaceBotQuery.limit.mockReturnValue(mockRaceBotQuery);
    mockRaceBotQuery.startAfter.mockReturnValue(mockRaceBotQuery);
    mockUsersDoc.mockImplementation((id: string) => ({id, path: `users/${id}`, get: mockUsersDocGet}));
    mockGetAll.mockImplementation(mockReadProfiles);
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

  it.each(["xp", "totalWins", "bestStreak"] as const)("uses current display fields for %s with one existing batch read", async type => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([
      makeEntry({userId: "u1", username: "Old name", avatarUrl: "https://example.com/old.png", level: 3, xp: 50}),
      makeEntry({userId: "u2", username: "Other", level: 2}),
    ]));
    mockProfileDocs.set("u1", {username: "Current name", avatarUrl: "https://example.com/current.png", stats: {level: 99}});
    /** Existing score order and values remain projection-owned; only current public identity is hydrated. */
    const result = await callGetLeaderboard({uid: "viewer"}, {type});
    expect(result.entries).toMatchObject([
      {userId: "u1", username: "Current name", avatarUrl: "https://example.com/current.png", level: 3, xp: 50},
      {userId: "u2", username: "Other", level: 2},
    ]);
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({id: "u1"}), expect.objectContaining({id: "u2"}),
      {fieldMask: ["username", "displayName", "avatarUrl"]});
    expect(mockUsersDocGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "   "])("never reuses a copied avatar when current avatar is %s", async avatarUrl => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry({avatarUrl: "https://example.com/old.png"})]));
    mockProfileDocs.set("user-1", {username: "Current name", avatarUrl});
    expect((await callGetLeaderboard({uid: "viewer"}, {type: "xp"})).entries[0]).not.toHaveProperty("avatarUrl");
  });

  it.each([
    {profile: {username: "  ", displayName: "Current display name"}, expected: "Current display name"},
    {profile: {username: "", displayName: "  "}, expected: "Player"},
    {profile: {username: " Current username ", displayName: "Other display name"}, expected: "Current username"},
  ])("uses canonical name fallback $expected without restoring a copied name", async ({profile, expected}) => {
    mockLeaderboardGet.mockResolvedValueOnce(makeSnapshot([makeEntry({username: "Earlier name"})]));
    mockProfileDocs.set("user-1", profile);
    expect((await callGetLeaderboard({uid: "viewer"}, {type: "xp"})).entries[0]?.username).toBe(expected);
  });

  it("rejects mismatched subjects before reading canonical display data", async () => {
    /** Canonical ownership is proven by document IDs and embedded subject IDs, never matching display fields. */
    const valid = makeSnapshot([makeEntry({userId: "u2", username: "Other"})]).docs;
    mockLeaderboardGet.mockResolvedValueOnce({docs: [{id: "u1", data: () => ({...makeEntry({userId: "u1"}), subjectUserId: "u2"})}, ...valid]});
    expect((await callGetLeaderboard({uid: "viewer"}, {type: "xp"})).entries).toEqual([expect.objectContaining({userId: "u2"})]);
    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({id: "u2"}), {fieldMask: ["username", "displayName", "avatarUrl"]});
  });

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
    expect(mockUsersSelect).toHaveBeenCalledWith("username", "displayName", "avatarUrl", "stats.level", "stats.xp", "stats.totalWins", "stats.bestStreak", "stats.multiplayerWins");
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

  it("ranks bot wins together with human wins and applies one combined limit", async () => {
    mockUsersGet.mockResolvedValue({docs: [
      {id: "alice", data: () => ({username: "Alice", stats: {multiplayerWins: 12}})},
      {id: "bob", data: () => ({username: "Bob", stats: {multiplayerWins: 7}})},
    ]});
    mockRaceBotGet.mockResolvedValue({docs: [
      {username: "DashFox", multiplayerWins: 15, updatedAt: 1_800_000_000_000},
      {username: "HopOwl", multiplayerWins: 9, updatedAt: 1_800_000_000_000},
      {username: "JumpCat", multiplayerWins: 1, updatedAt: 1_800_000_000_000},
    ].map(record => ({
      id: `race-bot-${createHash("sha256").update(record.username).digest("hex")}`,
      data: () => record,
    }))});

    const result = await callGetLeaderboard({uid: "viewer"}, {type: "multiplayerWins", limit: 3});
    expect(result.requestingUserId).toBe("viewer");
    expect(result.entries.map((entry: LeaderboardEntry) => ({username: entry.username, wins: entry.multiplayerWins}))).toEqual([
      {username: "DashFox", wins: 15},
      {username: "Alice", wins: 12},
      {username: "HopOwl", wins: 9},
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

    expect(mockLeaderboardLimit).toHaveBeenCalledWith(50);
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
          id: "u1",
          data: () => ({
            username: "Alice",
            stats: {level: 2, xp: 100, totalWins: 10, bestStreak: 7},
          }),
        },
        {
          id: "u2",
          data: () => ({
            username: "Bob",
            stats: {level: 1, xp: 300, totalWins: 4, bestStreak: 2},
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
    expect(mockUsersLimit).toHaveBeenCalledWith(10);
    expect(mockUsersOrderBy).toHaveBeenCalledWith("stats.level", "desc");
    expect(mockUsersOrderBy).toHaveBeenCalledWith("stats.xp", "desc");
    expect(mockUsersSelect).toHaveBeenCalledWith("username", "displayName", "avatarUrl", "stats.level", "stats.xp", "stats.totalWins", "stats.bestStreak", "stats.multiplayerWins");
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
    mockGetAll.mockImplementationOnce(async (...refs: Parameters<typeof mockReadProfiles>) =>
      (await mockReadProfiles(...refs)).map(document => ({...document, exists: document.id !== "legacy-u1"})));

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
    mockProfileDocs.set("u2", {username: "Other"});
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
    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({id: "u2"}), {fieldMask: ["username", "displayName", "avatarUrl"]});
  });
});
