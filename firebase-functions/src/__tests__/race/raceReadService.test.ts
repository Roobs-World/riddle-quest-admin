import {beforeEach, describe, expect, it, jest} from "@jest/globals";

let mockDefaultDb: unknown;
const mockChallengePreview = jest.fn();
const mockParseChallengeRecord = jest.fn();
const mockParseRunRecord = jest.fn();
const mockPersistRaceAchievementEvent = jest.fn();
const mockRaceOutcome = jest.fn();
const mockValidateCallableResponse = jest.fn((_schema: unknown, value: unknown) => value);

jest.mock("../../shared/firebaseAdmin", () => ({
  admin: {
    firestore: {
      FieldPath: {documentId: jest.fn(() => "__name__")},
    },
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class MockHttpsError extends Error {
    code: string;

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

jest.mock("../../race/raceEngine", () => ({
  raceOutcome: mockRaceOutcome,
}));

jest.mock("../../race/raceSetupService", () => ({
  challengePreview: mockChallengePreview,
  dbOrDefault: jest.fn((db?: unknown) => db ?? mockDefaultDb),
  parseChallengeRecord: mockParseChallengeRecord,
  parseRunRecord: mockParseRunRecord,
  persistRaceAchievementEvent: mockPersistRaceAchievementEvent,
}));

import {
  getRaceChallengePreview,
  getRaceOutcomeForUser,
  listRaceInboxForUser,
} from "../../race/raceReadService";

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

const documentSnapshot = (exists: boolean, data?: unknown) => ({
  exists,
  data: () => data,
});

const createChallengeDb = (snapshot: ReturnType<typeof documentSnapshot>) => {
  const get = jest.fn(async () => snapshot);
  const doc = jest.fn(() => ({get}));
  const collection = jest.fn(() => ({doc}));
  return {db: {collection}, collection, doc, get};
};

const createOutcomeDb = (
  runSnapshot: ReturnType<typeof documentSnapshot>,
  userSnapshot: ReturnType<typeof documentSnapshot>,
) => {
  const runRef = {path: "raceRuns/run-1"};
  const userRef = {path: "users/player-1"};
  const transaction = {
    get: jest.fn(async (ref: {path: string}) => ref.path === runRef.path ? runSnapshot : userSnapshot),
    set: jest.fn(),
  };
  const db = {
    collection: jest.fn((name: string) => ({
      doc: jest.fn(() => name === "raceRuns" ? runRef : userRef),
    })),
    runTransaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  return {db, runRef, userRef, transaction};
};

const inboxItem = (itemId: string, createdAtMs: number, read: boolean) => ({
  itemId,
  challengeId: `challenge-${itemId}`,
  opponentDisplayName: `Opponent ${itemId}`,
  opponentAvatarUrl: null,
  categoryId: "history",
  result: "win",
  adjustedDeltaMs: 1_000,
  read,
  createdAtMs,
});

const inboxDocument = (itemId: string, createdAtMs: number, read: boolean) => {
  const data = inboxItem(itemId, createdAtMs, read);
  return {id: itemId, ref: {path: `inbox/${itemId}`}, data: () => data};
};

const createInboxDb = (documents: ReturnType<typeof inboxDocument>[]) => {
  const query = {
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    get: jest.fn(async () => ({docs: documents})),
  };
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.startAfter.mockReturnValue(query);
  const batch = {update: jest.fn(), commit: jest.fn(async () => undefined)};
  const db = {
    collection: jest.fn(() => query),
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
    const {db} = createChallengeDb(documentSnapshot(false));

    await expect(getRaceChallengePreview("missing", {db: db as never, nowMs: 10}))
      .rejects.toMatchObject({code: "not-found"});
    expect(mockParseChallengeRecord).not.toHaveBeenCalled();
  });

  it("parses and projects an existing challenge using the requested clock", async () => {
    const stored = {challengeId: "challenge-1"};
    const parsed = {...stored, parsed: true};
    const preview = {challengeId: "challenge-1", status: "active"};
    const {db, collection, doc} = createChallengeDb(documentSnapshot(true, stored));
    mockParseChallengeRecord.mockReturnValue(parsed);
    mockChallengePreview.mockReturnValue(preview);

    await expect(getRaceChallengePreview("challenge-1", {db: db as never, nowMs: 123}))
      .resolves.toBe(preview);
    expect(collection).toHaveBeenCalledWith("raceChallenges");
    expect(doc).toHaveBeenCalledWith("challenge-1");
    expect(mockParseChallengeRecord).toHaveBeenCalledWith(stored);
    expect(mockChallengePreview).toHaveBeenCalledWith(parsed, 123);
  });

  it("uses the default database and current clock when options are omitted", async () => {
    const {db} = createChallengeDb(documentSnapshot(true, {}));
    mockDefaultDb = db;
    mockParseChallengeRecord.mockReturnValue({challengeId: "challenge-1"});
    mockChallengePreview.mockReturnValue({challengeId: "challenge-1"});

    await getRaceChallengePreview("challenge-1");

    expect(mockChallengePreview).toHaveBeenCalledWith({challengeId: "challenge-1"}, expect.any(Number));
  });
});

describe("getRaceOutcomeForUser", () => {
  it("rejects missing runs and runs belonging to another player", async () => {
    const missing = createOutcomeDb(documentSnapshot(false), documentSnapshot(true, {}));
    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: missing.db as never, nowMs: 10}))
      .rejects.toMatchObject({code: "not-found"});

    const foreign = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {}));
    mockParseRunRecord.mockReturnValue({userId: "player-2"});
    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: foreign.db as never, nowMs: 10}))
      .rejects.toMatchObject({code: "permission-denied"});
  });

  it("returns an already-recorded outcome without granting achievements twice", async () => {
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {coins: 250}));
    mockParseRunRecord.mockReturnValue({userId: "player-1", achievementProgressRecordedAtMs: 5});

    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: fixture.db as never, nowMs: 10}))
      .resolves.toEqual(baseOutcome);
    expect(mockPersistRaceAchievementEvent).not.toHaveBeenCalled();
    expect(fixture.transaction.set).not.toHaveBeenCalled();
  });

  it("uses the default database and current clock when outcome options are omitted", async () => {
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {}));
    mockDefaultDb = fixture.db;
    const run = {userId: "player-1", achievementProgressRecordedAtMs: 5};
    mockParseRunRecord.mockReturnValue(run);

    await getRaceOutcomeForUser("player-1", "run-1");

    expect(mockRaceOutcome).toHaveBeenCalledWith(run, expect.any(Number));
  });

  it("requires player progress before recording the achievement event", async () => {
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(false));
    mockParseRunRecord.mockReturnValue({userId: "player-1"});

    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: fixture.db as never, nowMs: 10}))
      .rejects.toMatchObject({code: "internal"});
    expect(mockPersistRaceAchievementEvent).not.toHaveBeenCalled();
  });

  it("records a clean win and returns the authoritative achievement grant", async () => {
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, undefined));
    mockParseRunRecord.mockReturnValue({userId: "player-1"});

    await expect(getRaceOutcomeForUser("player-1", "run-1", {db: fixture.db as never, nowMs: 50}))
      .resolves.toEqual({
        ...baseOutcome,
        newlyUnlockedAchievementIds: ["race_first_finish"],
        achievementCoinsAwarded: 100,
        newCoins: 350,
      });
    expect(mockPersistRaceAchievementEvent).toHaveBeenCalledWith(
      fixture.transaction,
      fixture.userRef,
      {},
      {kind: "completed", won: true, cleanRun: true},
      50,
    );
    expect(fixture.transaction.set).toHaveBeenCalledWith(
      fixture.runRef,
      {achievementProgressRecordedAtMs: 50},
      {merge: true},
    );
    expect(mockValidateCallableResponse).toHaveBeenCalledWith(expect.anything(), expect.anything(), "getRaceOutcome");
  });

  it("records losses and penalized wins without a clean-run achievement", async () => {
    const fixture = createOutcomeDb(documentSnapshot(true, {}), documentSnapshot(true, {coins: 1}));
    mockParseRunRecord.mockReturnValue({userId: "player-1"});
    mockRaceOutcome.mockReturnValue({...baseOutcome, result: "player_loss", correctCount: 9, totalPenaltyMs: 1});

    await getRaceOutcomeForUser("player-1", "run-1", {db: fixture.db as never, nowMs: 60});

    expect(mockPersistRaceAchievementEvent).toHaveBeenCalledWith(
      fixture.transaction,
      fixture.userRef,
      {coins: 1},
      {kind: "completed", won: false, cleanRun: false},
      60,
    );
  });
});

describe("listRaceInboxForUser", () => {
  it("rejects malformed and structurally invalid cursors", async () => {
    const {db} = createInboxDb([]);
    await expect(listRaceInboxForUser("player-1", {limit: 1, cursor: "not-json"}, db as never))
      .rejects.toMatchObject({code: "invalid-argument"});

    const wrongShape = Buffer.from(JSON.stringify({createdAtMs: "yesterday"})).toString("base64url");
    await expect(listRaceInboxForUser("player-1", {limit: 1, cursor: wrongShape}, db as never))
      .rejects.toMatchObject({code: "invalid-argument"});
  });

  it("returns a cursor page and marks only visible unread items", async () => {
    const first = inboxDocument("item-1", 200, false);
    const second = inboxDocument("item-2", 100, false);
    const {db, query, batch} = createInboxDb([first, second]);

    const response = await listRaceInboxForUser("player-1", {limit: 1}, db as never);

    expect(response.items).toEqual([inboxItem("item-1", 200, false)]);
    expect(response.nextCursor).toBeDefined();
    expect(query.orderBy).toHaveBeenNthCalledWith(1, "createdAtMs", "desc");
    expect(query.orderBy).toHaveBeenNthCalledWith(2, "__name__", "desc");
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(batch.update).toHaveBeenCalledWith(first.ref, {read: true});
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("decodes cursors and avoids writes for an already-read final page", async () => {
    const document = inboxDocument("item-2", 100, true);
    const {db, query, batch} = createInboxDb([document]);
    const cursor = Buffer.from(JSON.stringify({createdAtMs: 200, itemId: "item-1"})).toString("base64url");

    const response = await listRaceInboxForUser("player-1", {limit: 2, cursor}, db as never);

    expect(query.startAfter).toHaveBeenCalledWith(200, "item-1");
    expect(response).toEqual({items: [inboxItem("item-2", 100, true)]});
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});
