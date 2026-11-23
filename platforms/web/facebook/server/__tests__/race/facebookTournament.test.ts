import {
  FACEBOOK_TOURNAMENT_DURATION_MS,
  FACEBOOK_TOURNAMENT_SORT_ORDER,
  assertFacebookTournamentDeck,
  deriveFacebookTournamentEntry,
  facebookTournamentWindow,
  listFacebookTournamentStandings,
  recordFacebookTournamentRun,
  selectBestFacebookTournamentEntry,
} from "../../race/facebookTournament";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/runs/raceEngine";

/** Renders the start interface. */
const START = Date.UTC(2026, 7, 19);
/** Defines the user id value. */
const USER_ID = `facebook_${"a".repeat(40)}`;

/** Completes d run. */
const completedRun = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
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
  hintUsed: true,
  revealedLetters: [],
  startedAtMs: START + 1_000,
  finishedAtMs: START + 31_000,
  wallFinishMs: 30_000,
  hintPenaltyMs: 15_000,
  skipPenaltyMs: 0,
  events: [],
  ...overrides,
});

describe("Facebook tournament authority", () => {
  it("creates exact locale-isolated UTC windows with lower-is-better ordering", () => {
    expect(facebookTournamentWindow("ja", START + 123)).toEqual({
      tournamentId: "facebook-race10-ja-2026-08-19",
      startsAtMs: START,
      endsAtMs: START + FACEBOOK_TOURNAMENT_DURATION_MS,
    });
    expect(facebookTournamentWindow("fr", START + 123).tournamentId).not.toBe(
      facebookTournamentWindow("ja", START + 123).tournamentId,
    );
    expect(FACEBOOK_TOURNAMENT_SORT_ORDER).toBe("LOWER_IS_BETTER");
    expect(() => facebookTournamentWindow("ja", Number.MAX_SAFE_INTEGER)).toThrow(
      "Tournament time must be a non-negative safe integer",
    );
    expect(() => facebookTournamentWindow("ja", 253_402_300_799_999)).toThrow(
      "Tournament time must be a non-negative safe integer",
    );
  });

  it("derives adjusted milliseconds only from an owned authoritative completed run", () => {
    /** Provides entry behavior. */
    const entry = deriveFacebookTournamentEntry(USER_ID, "ja", completedRun(), START + 60_000);
    expect(entry).toMatchObject({adjustedTimeMs: 45_000, locale: "ja", userId: USER_ID, runId: "run-1"});
    expect(Object.keys(entry)).not.toEqual(expect.arrayContaining(["coins", "reward", "grant"]));

    expect(() => deriveFacebookTournamentEntry(USER_ID, "fr", completedRun(), START + 60_000)).toThrow(
      "locales must match",
    );
    expect(() =>
      deriveFacebookTournamentEntry(USER_ID, "ja", completedRun({status: "active"}), START + 60_000),
    ).toThrow("Only completed authoritative");
    expect(() =>
      deriveFacebookTournamentEntry(`facebook_${"b".repeat(40)}`, "ja", completedRun(), START + 60_000),
    ).toThrow("ownership is invalid");
    expect(() =>
      deriveFacebookTournamentEntry(
        "facebook_not-a-provider-uid",
        "ja",
        completedRun({userId: "facebook_not-a-provider-uid"}),
        START + 60_000,
      ),
    ).toThrow("ownership is invalid");
  });

  it("rejects cross-window runs and keeps only a faster server-derived attempt", () => {
    expect(() =>
      deriveFacebookTournamentEntry(USER_ID, "ja", completedRun({finishedAtMs: START - 1}), START + 60_000),
    ).toThrow("outside this tournament window");

    /** Provides current behavior. */
    const current = deriveFacebookTournamentEntry(USER_ID, "ja", completedRun(), START + 60_000);
    /** Provides slower behavior. */
    const slower = {...current, runId: "run-2", adjustedTimeMs: 46_000};
    /** Provides faster behavior. */
    const faster = {...current, runId: "run-3", adjustedTimeMs: 44_000};
    expect(selectBestFacebookTournamentEntry(current, slower)).toBe(current);
    expect(selectBestFacebookTournamentEntry(current, faster)).toBe(faster);
    expect(() => selectBestFacebookTournamentEntry(current, {...faster, locale: "fr"})).toThrow("scopes do not match");
  });

  it("binds the official score to the immutable localized server deck", () => {
    /** Provides run behavior. */
    const run = completedRun();
    /** Provides deck behavior. */
    const deck = {
      deckId: run.deckId,
      locale: run.locale,
      categoryId: run.categoryId,
      rulesVersion: run.rulesVersion,
      canonicalRiddleIds: run.riddles.map(({canonicalRiddleId}) => canonicalRiddleId),
    };
    expect(() => assertFacebookTournamentDeck(run, deck)).not.toThrow();
    expect(() => assertFacebookTournamentDeck(run, {...deck, locale: "fr"})).toThrow("deck binding is invalid");
    expect(() =>
      assertFacebookTournamentDeck(run, {
        ...deck,
        canonicalRiddleIds: [...deck.canonicalRiddleIds.slice(0, 14), "forged"],
      }),
    ).toThrow("deck binding is invalid");
  });

  it("persists concurrent-safe best entries without accepting a client score", async () => {
    /** Provides run behavior. */
    const run = completedRun();
    /** Provides values behavior. */
    const values = new Map<string, Record<string, unknown>>([
      [`raceRuns/${run.runId}`, run],
      [
        `raceDecks/${run.deckId}`,
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
      collection: (name: string) => ({doc: (id: string) => reference(`${name}/${id}`)}),
      doc: reference,
      runTransaction: async <T>(callback: (value: typeof transaction) => Promise<T>) => callback(transaction),
    } as unknown as FirebaseFirestore.Firestore;

    /** Provides first behavior. */
    const first = await recordFacebookTournamentRun(
      USER_ID,
      {runId: run.runId, locale: "ja", score: 1} as {
        /** Stores run id. */
        runId: string; /** Stores locale. */
        /** Stores locale. */
        locale: "ja";
      },
      {db, nowMs: START + 60_000},
    );
    expect(first).toMatchObject({improved: true, entry: {adjustedTimeMs: 45_000}});
    /** Provides entry path behavior. */
    const entryPath = `facebookTournaments/facebook-race10-ja-2026-08-19/entries/${USER_ID}`;
    expect(values.get(entryPath)).toMatchObject({adjustedTimeMs: 45_000});

    await expect(
      recordFacebookTournamentRun(
        USER_ID,
        {runId: run.runId, locale: "ja"},
        {
          db,
          nowMs: Number.NaN,
        },
      ),
    ).rejects.toThrow("Tournament write time");
    /** Provides before future submission behavior. */
    const beforeFutureSubmission = structuredClone([...values.entries()]);
    await expect(
      recordFacebookTournamentRun(
        USER_ID,
        {runId: run.runId, locale: "ja"},
        {
          db,
          nowMs: run.finishedAtMs! - 1,
        },
      ),
    ).rejects.toThrow("predates authoritative completion");
    expect([...values.entries()]).toEqual(beforeFutureSubmission);

    /** Provides recovered after rollover behavior. */
    const recoveredAfterRollover = await recordFacebookTournamentRun(
      USER_ID,
      {runId: run.runId, locale: "ja"},
      {db, nowMs: START + FACEBOOK_TOURNAMENT_DURATION_MS + 60_000},
    );
    expect(recoveredAfterRollover.entry.tournamentId).toBe("facebook-race10-ja-2026-08-19");
    expect(values.has(`facebookTournaments/facebook-race10-ja-2026-08-20/entries/${USER_ID}`)).toBe(false);

    values.set(`raceRuns/${run.runId}`, completedRun({wallFinishMs: 31_000, finishedAtMs: START + 32_000}));
    /** Provides slower behavior. */
    const slower = await recordFacebookTournamentRun(
      USER_ID,
      {runId: run.runId, locale: "ja"},
      {
        db,
        nowMs: START + 60_000,
      },
    );
    expect(slower).toMatchObject({improved: false, entry: {adjustedTimeMs: 45_000}});
    expect(values.get(entryPath)).toMatchObject({adjustedTimeMs: 45_000});
  });

  it("lists bounded competition ranks without leaking provider identities", async () => {
    /** Provides rows behavior. */
    const rows = [
      {id: `facebook_${"b".repeat(40)}`, adjustedTimeMs: 40_000},
      {id: USER_ID, adjustedTimeMs: 45_000},
      {id: `facebook_${"c".repeat(40)}`, adjustedTimeMs: 45_000},
    ];
    /** Provides get behavior. */
    const get = jest.fn(async () => ({
      docs: rows.map((row, index) => ({
        id: row.id,
        data: () => ({
          tournamentId: "facebook-race10-ja-2026-08-19",
          locale: "ja",
          userId: row.id,
          runId: `run-${index}`,
          adjustedTimeMs: row.adjustedTimeMs,
          completedAtMs: START + index,
        }),
      })),
    }));
    /** Provides query behavior. */
    const query = {orderBy: jest.fn(), limit: jest.fn(), get};
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {collection: jest.fn(() => query)} as unknown as FirebaseFirestore.Firestore;
    /** Provides result behavior. */
    const result = await listFacebookTournamentStandings(USER_ID, "ja", {db, nowMs: START + 1});
    expect(result.standings).toEqual([
      {rank: 1, adjustedTimeMs: 40_000, isCurrentPlayer: false},
      {rank: 2, adjustedTimeMs: 45_000, isCurrentPlayer: true},
      {rank: 2, adjustedTimeMs: 45_000, isCurrentPlayer: false},
    ]);
    expect(result.currentPlayer).toEqual({rank: 2, adjustedTimeMs: 45_000, isCurrentPlayer: true});
    expect(JSON.stringify(result)).not.toContain(USER_ID);
    expect(query.limit).toHaveBeenCalledWith(50);
  });

  it("rejects malformed identities and cross-identity stored standings", async () => {
    await expect(
      listFacebookTournamentStandings("facebook_prefix-only", "ja", {
        db: {} as FirebaseFirestore.Firestore,
        nowMs: START,
      }),
    ).rejects.toThrow("Facebook player identity is required");

    /** Provides get behavior. */
    const get = jest.fn(async () => ({
      docs: [
        {
          id: USER_ID,
          data: () => ({
            tournamentId: "facebook-race10-ja-2026-08-19",
            locale: "ja",
            userId: `facebook_${"b".repeat(40)}`,
            runId: "run-1",
            adjustedTimeMs: 45_000,
            completedAtMs: START + 1,
          }),
        },
      ],
    }));
    /** Provides query behavior. */
    const query = {orderBy: jest.fn(), limit: jest.fn(), get};
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {collection: jest.fn(() => query)} as unknown as FirebaseFirestore.Firestore;
    await expect(listFacebookTournamentStandings(USER_ID, "ja", {db, nowMs: START + 1})).rejects.toThrow(
      "Stored tournament entry scope is invalid",
    );
  });

  it("rejects a stored standing whose completion time contradicts its tournament window", async () => {
    /** Provides get behavior. */
    const get = jest.fn(async () => ({
      docs: [
        {
          id: USER_ID,
          data: () => ({
            tournamentId: "facebook-race10-ja-2026-08-19",
            locale: "ja",
            userId: USER_ID,
            runId: "run-1",
            adjustedTimeMs: 45_000,
            completedAtMs: START + FACEBOOK_TOURNAMENT_DURATION_MS,
          }),
        },
      ],
    }));
    /** Provides query behavior. */
    const query = {orderBy: jest.fn(), limit: jest.fn(), get};
    query.orderBy.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    /** Provides db behavior. */
    const db = {collection: jest.fn(() => query)} as unknown as FirebaseFirestore.Firestore;

    await expect(listFacebookTournamentStandings(USER_ID, "ja", {db, nowMs: START + 1})).rejects.toThrow(
      "Stored tournament entry window is invalid",
    );
  });
});
