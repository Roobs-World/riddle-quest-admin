import {facebookContextKey} from "../../race/facebookContextCompetition";
import {listFacebookContextBoard, recordFacebookContextBoardRun} from "../../race/facebookContextBoard";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/runs/raceEngine";

/** Renders the start interface. */
const START = Date.UTC(2026, 7, 19);
/** Defines the user id value. */
const USER_ID = `facebook_${"a".repeat(40)}`;
/** Defines the context id value. */
const CONTEXT_ID = "thread-1";
/** Defines the context key value. */
const CONTEXT_KEY = facebookContextKey(CONTEXT_ID);

/** Provides run behavior. */
const run: RaceRunRecord = {
  runId: "run-1",
  userId: USER_ID,
  role: "creator",
  status: "completed",
  result: "recorded",
  categoryId: "history",
  locale: "ja",
  rulesVersion: "race10_v1",
  deckId: "deck-1",
  riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `riddle-${position}`,
    canonicalRiddleId: `history:${position}`,
    text: `Clue ${position}`,
    answer: "answer",
    position,
  })),
  currentPosition: 10,
  correctCount: 10,
  guessesUsed: 1,
  hintUsed: false,
  revealedLetters: [],
  startedAtMs: START + 1_000,
  finishedAtMs: START + 31_000,
  wallFinishMs: 30_000,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  events: [],
};

/** Provides context behavior. */
const context = (overrides: Record<string, unknown> = {}) => ({
  contextKey: CONTEXT_KEY,
  contextType: "THREAD",
  locale: "ja",
  hostUserId: USER_ID,
  members: [{userId: USER_ID, joinedAtMs: START, active: true}],
  createdAtMs: START,
  expiresAtMs: START + 7 * 24 * 60 * 60 * 1_000,
  ...overrides,
});

describe("Facebook context board authority", () => {
  it("records only a member-owned authoritative run and keeps the faster attempt", async () => {
    /** Provides values behavior. */
    const values = new Map<string, Record<string, unknown>>([
      [`facebookContextCompetitions/${CONTEXT_KEY}`, context()],
      ["raceRuns/run-1", run],
      [
        "raceDecks/deck-1",
        {
          deckId: run.deckId,
          locale: run.locale,
          categoryId: run.categoryId,
          rulesVersion: run.rulesVersion,
          canonicalRiddleIds: run.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
        },
      ],
    ]);
    /** Provides reference behavior. */
    const reference = (path: string) => ({path});
    /** Provides transaction behavior. */
    const transaction = {
      get: jest.fn(
        async ({
          path,
        }: {
          /** Stores path. */ /** Stores path. */ /** Stores path. */
          /** Stores path. */
          path: string;
        }) => ({
          exists: values.has(path),
          data: () => values.get(path),
        }),
      ),
      set: jest.fn(
        (
          {
            path,
          }: {
            /** Stores path. */
            path: string;
          },
          value: Record<string, unknown>,
        ) => values.set(path, value),
      ),
    };
    /** Provides db behavior. */
    const db = {
      doc: reference,
      runTransaction: async <T>(callback: (value: typeof transaction) => Promise<T>) => callback(transaction),
    } as unknown as FirebaseFirestore.Firestore;
    /** Provides result behavior. */
    const result = await recordFacebookContextBoardRun(
      USER_ID,
      {contextId: CONTEXT_ID, locale: "ja", runId: "run-1"},
      {db, nowMs: START + 60_000},
    );
    expect(result).toMatchObject({improved: true, entry: {adjustedTimeMs: 30_000}});
    expect(values.get(`facebookContextCompetitions/${CONTEXT_KEY}/entries/${USER_ID}`)).toMatchObject({
      runId: "run-1",
      adjustedTimeMs: 30_000,
    });
    expect(JSON.stringify(result)).not.toContain("coins");

    values.set(
      `facebookContextCompetitions/${CONTEXT_KEY}`,
      context({
        hostUserId: `facebook_${"b".repeat(40)}`,
        members: [
          {userId: USER_ID, joinedAtMs: START, active: false},
          {userId: `facebook_${"b".repeat(40)}`, joinedAtMs: START + 1, active: true},
        ],
      }),
    );
    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja", runId: "run-1"},
        {db, nowMs: START + 60_000},
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
  });

  it("lists competition ranks without returning game or provider identities", async () => {
    /** Provides rows behavior. */
    const rows = [
      {id: `facebook_${"b".repeat(40)}`, time: 20_000},
      {id: USER_ID, time: 30_000},
      {id: `facebook_${"c".repeat(40)}`, time: 30_000},
    ];
    /** Provides query behavior. */
    const query = {
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(async () => ({
        docs: rows.map((row, index) => ({
          id: row.id,
          data: () => ({
            contextKey: CONTEXT_KEY,
            locale: "ja",
            userId: row.id,
            runId: `run-${index}`,
            adjustedTimeMs: row.time,
            completedAtMs: START + index,
          }),
        })),
      })),
    };
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () =>
            context({
              members: rows.map(({id}) => ({userId: id, joinedAtMs: START, active: true})),
            }),
        }),
      }),
      collection: () => query,
    } as unknown as FirebaseFirestore.Firestore;
    /** Provides result behavior. */
    const result = await listFacebookContextBoard(
      USER_ID,
      {contextId: CONTEXT_ID, locale: "ja"},
      {db, nowMs: START + 1},
    );
    expect(result.standings).toEqual([
      {rank: 1, adjustedTimeMs: 20_000, isCurrentPlayer: false},
      {rank: 2, adjustedTimeMs: 30_000, isCurrentPlayer: true},
      {rank: 2, adjustedTimeMs: 30_000, isCurrentPlayer: false},
    ]);
    expect(result.currentPlayer).toEqual({rank: 2, adjustedTimeMs: 30_000, isCurrentPlayer: true});
    expect(JSON.stringify(result)).not.toMatch(/facebook_|userId|runId/);
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it("rejects locale mismatch, expiry, and races outside the context window", async () => {
    /** Provides db for behavior. */
    const dbFor = (contextValue: Record<string, unknown>, runValue = run) => {
      /** Provides values behavior. */
      const values = new Map<string, Record<string, unknown>>([
        [`facebookContextCompetitions/${CONTEXT_KEY}`, contextValue],
        ["raceRuns/run-1", runValue],
        [
          "raceDecks/deck-1",
          {
            deckId: run.deckId,
            locale: run.locale,
            categoryId: run.categoryId,
            rulesVersion: run.rulesVersion,
            canonicalRiddleIds: run.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
          },
        ],
      ]);
      /** Provides transaction behavior. */
      const transaction = {
        get: async ({
          path,
        }: {
          /** Stores path. */ /** Stores path. */ /** Stores path. */
          /** Stores path. */
          path: string;
        }) => ({
          exists: values.has(path),
          data: () => values.get(path),
        }),
        set: jest.fn(),
      };
      return {
        doc: (path: string) => ({path}),
        runTransaction: async <T>(cb: (tx: typeof transaction) => Promise<T>) => cb(transaction),
      } as unknown as FirebaseFirestore.Firestore;
    };
    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "fr", runId: "run-1"},
        {db: dbFor(context()), nowMs: START + 1},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja", runId: "run-1"},
        {db: dbFor(context()), nowMs: START + 8 * 24 * 60 * 60 * 1_000},
      ),
    ).rejects.toMatchObject({code: "failed-precondition"});
    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja", runId: "run-1"},
        {
          db: dbFor(
            context({
              createdAtMs: START + 40_000,
              expiresAtMs: START + 40_000 + 7 * 24 * 60 * 60 * 1_000,
              members: [{userId: USER_ID, joinedAtMs: START + 40_000, active: true}],
            }),
          ),
          nowMs: START + 50_000,
        },
      ),
    ).rejects.toThrow("outside this context board window");

    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja", runId: "run-1"},
        {
          db: dbFor(
            context({
              members: [{userId: USER_ID, joinedAtMs: START + 40_000, active: true}],
            }),
          ),
          nowMs: START + 50_000,
        },
      ),
    ).rejects.toThrow("outside this context board window");
  });

  it("rejects malformed clocks, run IDs, and cross-identity stored rows", async () => {
    await expect(
      recordFacebookContextBoardRun(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja", runId: "invalid/run"},
        {db: {} as FirebaseFirestore.Firestore, nowMs: START},
      ),
    ).rejects.toThrow("run ID is invalid");
    await expect(
      listFacebookContextBoard(
        USER_ID,
        {contextId: CONTEXT_ID, locale: "ja"},
        {db: {} as FirebaseFirestore.Firestore, nowMs: Number.NaN},
      ),
    ).rejects.toThrow("board time is invalid");

    /** Provides query behavior. */
    const query = {
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(async () => ({
        docs: [
          {
            id: USER_ID,
            data: () => ({
              contextKey: CONTEXT_KEY,
              locale: "ja",
              userId: `facebook_${"b".repeat(40)}`,
              runId: "run-1",
              adjustedTimeMs: 30_000,
              completedAtMs: START + 1,
            }),
          },
        ],
      })),
    };
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {
      doc: () => ({get: async () => ({exists: true, data: () => context()})}),
      collection: () => query,
    } as unknown as FirebaseFirestore.Firestore;
    await expect(
      listFacebookContextBoard(USER_ID, {contextId: CONTEXT_ID, locale: "ja"}, {db, nowMs: START + 1}),
    ).rejects.toThrow("Stored Facebook context board scope is invalid");
  });

  it("rejects stored scores completed before that player joined the context", async () => {
    /** Provides late join behavior. */
    const lateJoin = START + 40_000;
    /** Provides query behavior. */
    const query = {
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(async () => ({
        docs: [
          {
            id: USER_ID,
            data: () => ({
              contextKey: CONTEXT_KEY,
              locale: "ja",
              userId: USER_ID,
              runId: "run-1",
              adjustedTimeMs: 30_000,
              completedAtMs: lateJoin - 1,
            }),
          },
        ],
      })),
    };
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () =>
            context({
              members: [{userId: USER_ID, joinedAtMs: lateJoin, active: true}],
            }),
        }),
      }),
      collection: () => query,
    } as unknown as FirebaseFirestore.Firestore;

    await expect(
      listFacebookContextBoard(USER_ID, {contextId: CONTEXT_ID, locale: "ja"}, {db, nowMs: lateJoin}),
    ).rejects.toThrow("Stored Facebook context board entry window is invalid");
  });
});
