import {beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Provides mock default db behavior. */
let mockDefaultDb: unknown;
/** Provides mock challenge preview behavior. */
const mockChallengePreview = jest.fn();
/** Provides mock parse challenge record behavior. */
const mockParseChallengeRecord = jest.fn();
/** Provides mock parse run record behavior. */
const mockParseRunRecord = jest.fn();
/** Provides mock persist race achievement event behavior. */
const mockPersistRaceAchievementEvent = jest.fn();
/** Provides mock race outcome behavior. */
const mockRaceOutcome = jest.fn();
/** Settlement behaviour is verified through the real emulator interface. */
const mockReadSettledRaceOutcome = jest.fn();
/** Provides mock validate callable response behavior. */
const mockValidateCallableResponse = jest.fn((_schema: unknown, value: unknown) => value);

jest.mock("../../shared/firebaseAdmin", () => ({
  admin: {
    firestore: {
      FieldPath: {documentId: jest.fn(() => "__name__")},
      FieldValue: {delete: jest.fn(() => "field-delete")},
    },
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class MockHttpsError extends Error {
    /** Stores code. */
    code: string;

    /** Creates a class instance. */
    constructor(code: string, message: string) {
      super(message);
      this.name = "HttpsError";
      this.code = code;
    }
  },
}));

jest.mock("../../validation/callableValidation", () => ({
  validateCallableResponse: mockValidateCallableResponse,
}));

jest.mock("../../race/settlement/raceSettlement", () => ({readSettledRaceOutcome: mockReadSettledRaceOutcome}));

jest.mock("../../race/runs/raceEngine", () => ({
  raceOutcome: mockRaceOutcome,
}));

jest.mock("../../race/raceSetupService", () => ({
  challengePreview: mockChallengePreview,
  dbOrDefault: jest.fn((db?: unknown) => db ?? mockDefaultDb),
  parseChallengeRecord: mockParseChallengeRecord,
  parseRunRecord: mockParseRunRecord,
  persistRaceAchievementEvent: mockPersistRaceAchievementEvent,
}));

import {getRaceChallengePreview, getRaceOutcomeForUser, listRaceInboxForUser} from "../../race/raceReadService";

/** Provides base outcome behavior. */
const baseOutcome = {
  runId: "run-1",
  result: "player_win",
  correctCount: 10,
  wallFinishMs: 60_000,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  totalPenaltyMs: 0,
  adjustedFinishMs: 60_000,
  publishable: true,
  rematchEligible: true,
};

/** Provides document snapshot behavior. */
const documentSnapshot = (exists: boolean, data?: unknown) => ({
  exists,
  data: () => data,
});

/** Creates challenge db. */
const createChallengeDb = (snapshot: ReturnType<typeof documentSnapshot>, creatorDeleted = false) => {
  /** Provides challenge ref behavior. */
  const challengeRef = {path: "raceChallenges/challenge-1"};
  /** Provides doc behavior. */
  const doc = jest.fn((id: string) => ({
    path: id === "challenge-1" ? challengeRef.path : `jestAccountDeletionTombstones/${id}`,
    id,
  }));
  /** Provides collection behavior. */
  const collection = jest.fn(() => ({doc}));
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async (ref: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => (ref.path === challengeRef.path ? snapshot : documentSnapshot(creatorDeleted)),
    ),
    update: jest.fn(),
  };
  /** Provides run transaction behavior. */
  const runTransaction = jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
    callback(transaction),
  );
  return {db: {collection, runTransaction}, collection, doc, transaction};
};

/** Creates outcome db. */
const createOutcomeDb = (
  runSnapshot: ReturnType<typeof documentSnapshot>,
  userSnapshot: ReturnType<typeof documentSnapshot>,
) => {
  /** Provides run ref behavior. */
  const runRef = {path: "raceRuns/run-1"};
  /** Provides r ref. */
  const userRef = {path: "users/player-1"};
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async (ref: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => (ref.path === runRef.path ? runSnapshot : userSnapshot),
    ),
    set: jest.fn(),
  };
  /** Provides db behavior. */
  const db = {
    collection: jest.fn((name: string) => ({
      doc: jest.fn(() => (name === "raceRuns" ? runRef : userRef)),
    })),
    runTransaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return {db, runRef, userRef, transaction};
};

/** Provides inbox item behavior. */
const inboxItem = (itemId: string, createdAtMs: number, read: boolean) => ({
  itemId,
  challengeId: `challenge-${itemId}`,
  opponentDisplayName: `Opponent ${itemId}`,
  opponentAvatarUrl: null,
  opponentLevel: 15,
  categoryId: "history",
  result: "win",
  adjustedDeltaMs: 1_000,
  read,
  createdAtMs,
});

/** Provides inbox document behavior. */
const inboxDocument = (itemId: string, createdAtMs: number, read: boolean) => {
  /** Provides data behavior. */
  const data = {
    ...inboxItem(itemId, createdAtMs, read),
    opponentUserId: "server-only-opponent",
    expiresAt: {toMillis: () => createdAtMs + 1_000},
  };
  return {id: itemId, ref: {path: `inbox/${itemId}`}, data: () => data};
};

/** Creates inbox db. */
const createInboxDb = (
  documents: Array<
    | ReturnType<typeof inboxDocument>
    | {
        /** Stores id. */
        id: string; /** Stores ref. */
        /** Stores ref. */
        ref: {
          /** Stores path. */
          path: string;
        }; /** Provides data behavior. */
        /** Provides data behavior. */
        data(): unknown;
      }
  >,
  deletedOpponentIds: string[] = [],
) => {
  /** Provides query behavior. */
  const query = {
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    get: jest.fn(async () => ({docs: documents})),
  };
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.startAfter.mockReturnValue(query);
  /** Provides batch behavior. */
  const batch = {update: jest.fn(), commit: jest.fn(async () => undefined)};
  /** Provides deletion ids behavior. */
  const deletionIds = new Set(deletedOpponentIds);
  /** Provides db behavior. */
  const db = {
    collection: jest.fn((name: string) =>
      name === "jestAccountDeletionTombstones" ? {doc: (id: string) => ({id, path: `${name}/${id}`})} : query,
    ),
    getAll: jest.fn(
      async (
        ...refs: Array<{
          /** Stores id. */
          id: string;
        }>
      ) => refs.map((ref) => ({id: ref.id, exists: deletionIds.has(ref.id)})),
    ),
    batch: jest.fn(() => batch),
  };
  return {db, query, batch};
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDefaultDb = undefined;
  mockRaceOutcome.mockReturnValue(baseOutcome);
  mockValidateCallableResponse.mockImplementation((_schema: unknown, value: unknown) => value);
  mockPersistRaceAchievementEvent.mockReturnValue({
    newlyUnlockedAchievementIds: ["race_first_finish"],
    achievementCoinsAwarded: 100,
    newCoins: 350,
  });
});

describe("getRaceChallengePreview", () => {
  it("rejects a missing challenge without attempting to parse it", async () => {
    /** Provides {db} behavior. */
    const {db} = createChallengeDb(documentSnapshot(false));

    await expect(getRaceChallengePreview("missing", "en", {db: db as never, nowMs: 10})).rejects.toMatchObject({
      code: "not-found",
    });
    expect(mockParseChallengeRecord).not.toHaveBeenCalled();
  });

  it("parses and projects an existing challenge using the requested clock", async () => {
    /** Stores d. */
    const stored = {challengeId: "challenge-1"};
    /** Parses d. */
    const parsed = {...stored, creatorId: "creator-1", locale: "en", parsed: true};
    /** Provides preview behavior. */
    const preview = {challengeId: "challenge-1", status: "active"};
    /** Provides {db, collection, doc} behavior. */
    const {db, collection, doc} = createChallengeDb({...documentSnapshot(true, stored), id: "challenge-1"});
    mockParseChallengeRecord.mockReturnValue(parsed);
    mockChallengePreview.mockReturnValue(preview);

    await expect(getRaceChallengePreview("challenge-1", "en", {db: db as never, nowMs: 123})).resolves.toBe(preview);
    expect(collection).toHaveBeenCalledWith("raceChallenges");
    expect(doc).toHaveBeenCalledWith("challenge-1");
    expect(mockParseChallengeRecord).toHaveBeenCalledWith(stored, "challenge-1");
    expect(mockChallengePreview).toHaveBeenCalledWith(parsed, 123);
  });

  it("scrubs a tombstoned creator before projecting or retaining a challenge snapshot", async () => {
    /** Stores d. */
    const stored = {challengeId: "challenge-1"};
    /** Parses d. */
    const parsed = {
      ...stored,
      creatorId: "creator-1",
      locale: "en",
      creatorSnapshot: {displayName: "Ada", avatarUrl: "https://example.test/ada.png"},
    };
    /** Provides fixture behavior. */
    const fixture = createChallengeDb(documentSnapshot(true, stored), true);
    mockParseChallengeRecord.mockReturnValue(parsed);
    mockChallengePreview.mockImplementation((challenge: unknown) => challenge);

    await expect(getRaceChallengePreview("challenge-1", "en", {db: fixture.db as never})).resolves.toMatchObject({
      creatorSnapshot: {displayName: "Riddle Quest player"},
    });
    expect(mockChallengePreview).toHaveBeenCalledWith(
      expect.objectContaining({creatorSnapshot: {displayName: "Riddle Quest player"}}),
      expect.any(Number),
    );
    expect(fixture.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({path: "raceChallenges/challenge-1"}),
      {creatorSnapshot: {displayName: "Riddle Quest player"}},
    );
  });

  it("uses the default database and current clock when options are omitted", async () => {
    /** Provides {db} behavior. */
    const {db} = createChallengeDb(documentSnapshot(true, {}));
    mockDefaultDb = db;
    mockParseChallengeRecord.mockReturnValue({challengeId: "challenge-1", creatorId: "creator-1", locale: "en"});
    mockChallengePreview.mockReturnValue({challengeId: "challenge-1"});

    await getRaceChallengePreview("challenge-1", "en");

    expect(mockChallengePreview).toHaveBeenCalledWith(
      {challengeId: "challenge-1", creatorId: "creator-1", locale: "en"},
      expect.any(Number),
    );
  });

  it("rejects a cross-locale preview before returning sender identity", async () => {
    /** Stores d. */
    const stored = {challengeId: "challenge-1"};
    /** Provides fixture behavior. */
    const fixture = createChallengeDb(documentSnapshot(true, stored));
    mockParseChallengeRecord.mockReturnValue({
      challengeId: "challenge-1",
      creatorId: "creator-1",
      locale: "ja",
      creatorSnapshot: {displayName: "Sender identity"},
    });

    await expect(getRaceChallengePreview("challenge-1", "fr", {db: fixture.db as never})).rejects.toMatchObject({
      code: "failed-precondition",
      message: "RaceTo10.ERROR_LOCALE_MISMATCH",
    });
    expect(mockChallengePreview).not.toHaveBeenCalled();
  });
});

describe("getRaceOutcomeForUser", () => {
  it("rejects missing runs and runs belonging to another player", async () => {
    /** Provides missing behavior. */
    const missing = createOutcomeDb(documentSnapshot(false), documentSnapshot(true, {}));
    await expect(
      getRaceOutcomeForUser("player-1", "run-1", {db: missing.db as never, nowMs: 10}),
    ).rejects.toMatchObject({code: "not-found"});

    /** Provides foreign behavior. */
    const foreign = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {}));
    mockParseRunRecord.mockReturnValue({userId: "player-2"});
    await expect(
      getRaceOutcomeForUser("player-1", "run-1", {db: foreign.db as never, nowMs: 10}),
    ).rejects.toMatchObject({code: "permission-denied"});
  });

  it("validates the canonical settled outcome returned through the settlement module", async () => {
    /** Provides fixture behavior. */
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {}));
    mockParseRunRecord.mockReturnValue({userId: "player-1"});
    mockReadSettledRaceOutcome.mockResolvedValue(baseOutcome);
    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: fixture.db as never, nowMs: 10})).resolves.toEqual(baseOutcome);
    expect(mockValidateCallableResponse).toHaveBeenCalledWith(expect.anything(), baseOutcome, "getRaceOutcome");
  });

  it("uses the default database and current clock when outcome options are omitted", async () => {
    /** Provides fixture behavior. */
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {}));
    mockDefaultDb = fixture.db;
    /** Provides run behavior. */
    const run = {userId: "player-1"};
    mockParseRunRecord.mockReturnValue(run);
    mockReadSettledRaceOutcome.mockResolvedValue(baseOutcome);
    await getRaceOutcomeForUser("player-1", "run-1");
    expect(mockReadSettledRaceOutcome).toHaveBeenCalledWith(fixture.transaction, fixture.db, run, expect.any(Number));
  });
});

describe("listRaceInboxForUser", () => {
  it("rejects malformed and structurally invalid cursors", async () => {
    /** Provides {db} behavior. */
    const {db} = createInboxDb([]);
    await expect(listRaceInboxForUser("player-1", {limit: 1, cursor: "not-json"}, db as never)).rejects.toMatchObject({
      code: "invalid-argument",
    });

    /** Provides wrong shape behavior. */
    const wrongShape = Buffer.from(JSON.stringify({createdAtMs: "yesterday"})).toString("base64url");
    await expect(listRaceInboxForUser("player-1", {limit: 1, cursor: wrongShape}, db as never)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("returns a cursor page and marks only visible unread items", async () => {
    /** Provides first behavior. */
    const first = inboxDocument("item-1", 200, false);
    /** Provides second behavior. */
    const second = inboxDocument("item-2", 100, false);
    /** Provides {db, query, batch} behavior. */
    const {db, query, batch} = createInboxDb([first, second]);

    /** Provides response behavior. */
    const response = await listRaceInboxForUser("player-1", {limit: 1}, db as never);

    expect(response.items).toEqual([
      {
        ...inboxItem("item-1", 200, false),
        opponentUserId: "server-only-opponent",
      },
    ]);
    expect(response.items[0]).not.toHaveProperty("expiresAt");
    expect(response.nextCursor).toBeDefined();
    expect(query.orderBy).toHaveBeenNthCalledWith(1, "createdAtMs", "desc");
    expect(query.orderBy).toHaveBeenNthCalledWith(2, "__name__", "desc");
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(batch.update).toHaveBeenCalledWith(first.ref, {read: true});
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("decodes cursors and avoids writes for an already-read final page", async () => {
    /** Provides document behavior. */
    const document = inboxDocument("item-2", 100, true);
    /** Provides {db, query, batch} behavior. */
    const {db, query, batch} = createInboxDb([document]);
    /** Provides cursor behavior. */
    const cursor = Buffer.from(JSON.stringify({createdAtMs: 200, itemId: "item-1"})).toString("base64url");

    /** Provides response behavior. */
    const response = await listRaceInboxForUser("player-1", {limit: 2, cursor}, db as never);

    expect(query.startAfter).toHaveBeenCalledWith(200, "item-1");
    expect(response).toEqual({
      items: [{...inboxItem("item-2", 100, true), opponentUserId: "server-only-opponent"}],
      nextCursor: undefined,
    });
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("suppresses identity in legacy inbox records that lack a server-only subject link", async () => {
    /** Provides legacy data behavior. */
    const legacyData = {
      ...inboxItem("legacy-item", 100, true),
      opponentDisplayName: "Legacy player name",
      opponentAvatarUrl: "https://example.test/legacy-avatar.png",
    };
    /** Provides legacy document behavior. */
    const legacyDocument = {
      id: "legacy-item",
      ref: {path: "inbox/legacy-item"},
      data: () => legacyData,
    };
    /** Provides {db} behavior. */
    const {db} = createInboxDb([legacyDocument]);

    /** Provides response behavior. */
    const response = await listRaceInboxForUser("player-1", {limit: 2}, db as never);

    expect(response.items[0]).toMatchObject({
      itemId: "legacy-item",
      opponentDisplayName: "Riddle Quest player",
      createdAtMs: 100,
      read: true,
    });
    expect(response.items[0]).not.toHaveProperty("opponentAvatarUrl");
    expect(response.items[0]).not.toHaveProperty("opponentLevel");
  });

  it("scrubs a tombstoned linked opponent in the response and stored inbox row", async () => {
    /** Provides document behavior. */
    const document = inboxDocument("item-1", 200, true);
    /** Provides {db, batch} behavior. */
    const {db, batch} = createInboxDb([document], ["server-only-opponent"]);

    /** Provides response behavior. */
    const response = await listRaceInboxForUser("player-1", {limit: 1}, db as never);

    expect(response.items[0]).toMatchObject({opponentDisplayName: "Riddle Quest player"});
    expect(response.items[0]).not.toHaveProperty("opponentAvatarUrl");
    expect(response.items[0]).not.toHaveProperty("opponentLevel");
    expect(batch.update).toHaveBeenCalledWith(document.ref, {
      opponentDisplayName: "Riddle Quest player",
      opponentAvatarUrl: "field-delete",
      opponentLevel: "field-delete",
    });
  });
});
