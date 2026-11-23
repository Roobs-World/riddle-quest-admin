import {
  REDDIT_TOURNAMENT_DURATION_MS,
  REDDIT_TOURNAMENT_SORT_ORDER,
  assertRedditTournamentDeck,
  deriveRedditTournamentEntry,
  listRedditTournamentStandings,
  recordRedditTournamentRun,
  redditTournamentWindow,
  selectBestRedditTournamentEntry,
} from "../../race/redditTournament";
import type {RaceRunRecord} from "../../../../../../firebase-functions/src/race/runs/raceEngine";

/** Renders the start interface. */
const START = Date.UTC(2026, 7, 20);
/** Defines the user id value. */
const USER_ID = `reddit_${"a".repeat(40)}`;
/** Provides run behavior. */
const run = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
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
    riddleId: `r-${position}`,
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

describe("Reddit tournament authority", () => {
  it("creates exact locale-isolated 24-hour lower-is-better boards", () => {
    expect(redditTournamentWindow("ja", START + 1)).toEqual({
      tournamentId: "reddit-race10-ja-2026-08-20",
      startsAtMs: START,
      endsAtMs: START + REDDIT_TOURNAMENT_DURATION_MS,
    });
    expect(redditTournamentWindow("ar", START + 1).tournamentId).not.toBe(
      redditTournamentWindow("ja", START + 1).tournamentId,
    );
    expect(REDDIT_TOURNAMENT_SORT_ORDER).toBe("LOWER_IS_BETTER");
  });

  it("derives scores only from owned completed Reddit runs and immutable decks", () => {
    /** Provides value behavior. */
    const value = run();
    /** Provides deck behavior. */
    const deck = {
      deckId: value.deckId,
      locale: value.locale,
      categoryId: value.categoryId,
      rulesVersion: value.rulesVersion,
      canonicalRiddleIds: value.riddles.map((item) => item.canonicalRiddleId),
    };
    expect(deriveRedditTournamentEntry(USER_ID, "ja", value, value.finishedAtMs!)).toMatchObject({
      adjustedTimeMs: 45_000,
    });
    expect(() =>
      deriveRedditTournamentEntry(
        `facebook_${"a".repeat(40)}`,
        "ja",
        run({userId: `facebook_${"a".repeat(40)}`}),
        value.finishedAtMs!,
      ),
    ).toThrow("ownership is invalid");
    expect(() => deriveRedditTournamentEntry(USER_ID, "ar", value, value.finishedAtMs!)).toThrow("locales must match");
    expect(() => assertRedditTournamentDeck(value, deck)).not.toThrow();
    expect(() =>
      assertRedditTournamentDeck(value, {
        ...deck,
        canonicalRiddleIds: [...deck.canonicalRiddleIds.slice(0, 14), "forged"],
      }),
    ).toThrow("deck binding is invalid");
  });

  it("ignores forged client scores and keeps only the fastest server-derived attempt", async () => {
    /** Provides value behavior. */
    const value = run();
    /** Provides values behavior. */
    const values = new Map<string, Record<string, unknown>>([
      [`raceRuns/${value.runId}`, value],
      [
        `raceDecks/${value.deckId}`,
        {
          deckId: value.deckId,
          locale: value.locale,
          categoryId: value.categoryId,
          rulesVersion: value.rulesVersion,
          canonicalRiddleIds: value.riddles.map((item) => item.canonicalRiddleId),
        },
      ],
    ]);
    /** Provides ref behavior. */
    const ref = (path: string) => ({path});
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
          data: Record<string, unknown>,
        ) => values.set(path, data),
      ),
    };
    /** Provides db behavior. */
    const db = {
      collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
      doc: ref,
      runTransaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction),
    } as unknown as FirebaseFirestore.Firestore;
    /** Provides first behavior. */
    const first = await recordRedditTournamentRun(
      USER_ID,
      {runId: "run-1", locale: "ja", score: 1} as {
        /** Stores run id. */
        runId: string; /** Stores locale. */
        /** Stores locale. */
        locale: "ja";
      },
      {db, nowMs: START + 60_000},
    );
    expect(first.entry.adjustedTimeMs).toBe(45_000);
    expect(Object.keys(first.entry)).not.toEqual(expect.arrayContaining(["coins", "reward", "grant"]));
    values.set("raceRuns/run-1", run({wallFinishMs: 31_000, finishedAtMs: START + 32_000}));
    await expect(
      recordRedditTournamentRun(USER_ID, {runId: "run-1", locale: "ja"}, {db, nowMs: START + 60_000}),
    ).resolves.toMatchObject({improved: false, entry: {adjustedTimeMs: 45_000}});
    /** Provides current behavior. */
    const current = first.entry;
    expect(selectBestRedditTournamentEntry(current, {...current, adjustedTimeMs: 44_000})).toMatchObject({
      adjustedTimeMs: 44_000,
    });
  });

  it("lists bounded identity-free competition ranks", async () => {
    /** Provides rows behavior. */
    const rows = [
      {id: `reddit_${"b".repeat(40)}`, time: 40_000},
      {id: USER_ID, time: 45_000},
      {id: `reddit_${"c".repeat(40)}`, time: 45_000},
    ];
    /** Provides query behavior. */
    const query = {
      orderBy: jest.fn(),
      limit: jest.fn(),
      get: jest.fn(async () => ({
        docs: rows.map((row, index) => ({
          id: row.id,
          data: () => ({
            tournamentId: "reddit-race10-ja-2026-08-20",
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
    /** Provides result behavior. */
    const result = await listRedditTournamentStandings(USER_ID, "ja", {
      db: {collection: jest.fn(() => query)} as unknown as FirebaseFirestore.Firestore,
      nowMs: START + 1,
    });
    expect(result.standings.map(({rank}) => rank)).toEqual([1, 2, 2]);
    expect(JSON.stringify(result)).not.toContain(USER_ID);
    expect(result.rewardsEnabled).toBe(false);
    expect(query.limit).toHaveBeenCalledWith(50);
  });
});
