import {RACE_RULES} from "@qwordly/core/race";
import {applyRaceCompletionPrivacy} from "../../race/raceCompletionPrivacy";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Provides run behavior. */
const run = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run-1",
  userId: "player-1",
  challengeId: "challenge-1",
  role: "challenger",
  status: "active",
  categoryId: "history",
  locale: "en",
  rulesVersion: "race10_v1",
  deckId: "deck-1",
  riddles: [],
  currentPosition: 0,
  correctCount: 0,
  guessesUsed: 0,
  hintUsed: false,
  revealedLetters: [],
  startedAtMs: 1_000,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  events: [],
  opponent: {
    subjectUserId: "creator-1",
    displayName: "Creator",
    avatarUrl: "https://example.test/creator.png",
    adjustedFinishMs: 40_000,
    events: [],
  },
  ...overrides,
});

/** Completes d run. */
const completedRun = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord =>
  run({
    status: "completed",
    result: "ghost_win",
    correctCount: 10,
    currentPosition: 10,
    finishedAtMs: 31_000,
    wallFinishMs: 30_000,
    ...overrides,
  });

/** Provides snapshot behavior. */
const snapshot = (exists: boolean, data?: unknown) => ({exists, data: () => data});

/** Provides challenge behavior. */
const challenge = (creatorAdjustedFinishMs: number) => ({
  challengeId: "challenge-1",
  creatorId: "creator-1",
  canonicalRiddleIds: [],
  ghostEvents: [],
  rules: RACE_RULES,
  creatorAdjustedFinishMs,
});

/** Provides fixture behavior. */
const fixture = ({
  creatorAdjustedFinishMs = 40_000,
  creatorDeleted = false,
  creatorExists = false,
  creatorData,
  challengerData = {displayName: "Challenger", avatarUrl: "https://example.test/challenger.png"},
}: {
  /** Stores creator adjusted finish ms. */
  creatorAdjustedFinishMs?: number;
  /** Stores creator deleted. */
  creatorDeleted?: boolean;
  /** Stores creator exists. */
  creatorExists?: boolean;
  /** Stores creator data. */
  creatorData?: unknown;
  /** Stores challenger data. */
  challengerData?: unknown;
} = {}) => {
  /** Provides reference behavior. */
  const reference = (path: string) => ({path});
  /** Provides transaction behavior. */
  const transaction = {
    get: jest.fn(
      async (ref: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => {
        switch (ref.path) {
          case "raceChallenges/challenge-1":
            return snapshot(true, challenge(creatorAdjustedFinishMs));
          case "jestAccountDeletionTombstones/creator-1":
            return snapshot(creatorDeleted);
          case "users/player-1":
            return snapshot(true, challengerData);
          case "users/creator-1":
            return snapshot(creatorExists, creatorData);
          default:
            throw new Error(`Unexpected read: ${ref.path}`);
        }
      },
    ),
    set: jest.fn(),
  };
  /** Provides db behavior. */
  const db = {
    collection: jest.fn((name: string) => ({doc: jest.fn((id: string) => reference(`${name}/${id}`))})),
    doc: jest.fn(reference),
  } as unknown as FirebaseFirestore.Firestore;
  return {db, transaction};
};

describe("race completion privacy", () => {
  it.each([
    {previous: run({status: "completed"}), completed: completedRun(), label: "already-final run"},
    {previous: run(), completed: run(), label: "still-active result"},
    {previous: run(), completed: run({status: "abandoned"}), label: "abandoned result"},
    {previous: run(), completed: completedRun({challengeId: undefined}), label: "solo completion"},
  ])("skips cross-user work for a $label", async ({previous, completed}) => {
    /** Provides result behavior. */
    const result = {run: completed, response: {run: {opponent: {displayName: "Creator"}}}};
    /** Provides db behavior. */
    const db = {} as FirebaseFirestore.Firestore;
    /** Provides transaction behavior. */
    const transaction = {get: jest.fn(), set: jest.fn()};

    await expect(
      applyRaceCompletionPrivacy(transaction as never, db, "player-1", previous, result, 31_000, true),
    ).resolves.toEqual({result, scrubbed: true});
    expect(transaction.get).not.toHaveBeenCalled();
  });

  it("scrubs both the run and receipt response when the creator was deleted", async () => {
    /** Provides {db, transaction} behavior. */
    const {db, transaction} = fixture({creatorDeleted: true});
    /** Provides result behavior. */
    const result = {
      run: completedRun(),
      response: {
        run: {
          opponent: {
            displayName: "Creator",
            avatarUrl: "https://example.test/creator.png",
            adjustedFinishMs: 40_000,
          },
        },
      },
    };

    await expect(
      applyRaceCompletionPrivacy(transaction as never, db, "player-1", run(), result, 31_000, false),
    ).resolves.toMatchObject({
      result: {
        run: {opponent: {displayName: "Riddle Quest player", avatarUrl: undefined, subjectUserId: undefined}},
        response: {run: {opponent: {displayName: "Riddle Quest player"}}},
      },
      scrubbed: true,
    });
    expect(transaction.set).not.toHaveBeenCalled();
  });

  it("records an identity-bounded inbox item, rivalry, and creator achievement", async () => {
    /** Provides long name behavior. */
    const longName = `  ${"A".repeat(90)}  `;
    /** Provides {db, transaction} behavior. */
    const {db, transaction} = fixture({
      creatorExists: true,
      creatorData: undefined,
      challengerData: {displayName: longName, avatarUrl: "https://example.test/challenger.png"},
    });
    /** Provides result behavior. */
    const result = {run: completedRun(), response: {accepted: true}};

    await expect(
      applyRaceCompletionPrivacy(transaction as never, db, "player-1", run(), result, 31_000, false),
    ).resolves.toEqual({result, scrubbed: false});

    /** Provides inbox write behavior. */
    const inboxWrite = transaction.set.mock.calls.find(([ref]) =>
      (
        ref as {
          /** Stores path. */
          path: string;
        }
      ).path.includes("/raceInbox/"),
    );
    expect(inboxWrite?.[1]).toMatchObject({
      challengeId: "challenge-1",
      opponentUserId: "player-1",
      opponentDisplayName: "A".repeat(80),
      opponentAvatarUrl: "https://example.test/challenger.png",
      categoryId: "history",
      result: "loss",
      adjustedDeltaMs: -10_000,
      read: false,
      createdAtMs: 31_000,
    });
    expect(
      (
        inboxWrite?.[1] as {
          /** Stores expires at. */
          expiresAt: {
            /** Provides to millis behavior. */
            toMillis(): number;
          };
        }
      ).expiresAt.toMillis(),
    ).toBeGreaterThan(31_000);
    expect(transaction.set).toHaveBeenCalledWith(
      {path: "users/player-1/knownRivals/creator-1"},
      expect.objectContaining({targetUserId: "creator-1", source: "completed_race"}),
      {merge: true},
    );
    expect(transaction.set).toHaveBeenCalledWith(
      {path: "users/creator-1"},
      expect.objectContaining({stats: expect.objectContaining({multiplayerGamesPlayed: 1})}),
      {merge: true},
    );
  });

  it.each([
    {creatorAdjustedFinishMs: 20_000, expectedResult: "win", adjustedDeltaMs: 10_000},
    {creatorAdjustedFinishMs: 30_000, expectedResult: "tie", adjustedDeltaMs: 0},
  ])(
    "derives the creator's $expectedResult result without an optional profile",
    async ({creatorAdjustedFinishMs, expectedResult, adjustedDeltaMs}) => {
      /** Provides {db, transaction} behavior. */
      const {db, transaction} = fixture({
        creatorAdjustedFinishMs,
        challengerData: {username: "Fallback username", avatarUrl: null},
      });
      /** Provides result behavior. */
      const result = {run: completedRun(), response: {accepted: true}};

      await applyRaceCompletionPrivacy(transaction as never, db, "player-1", run(), result, 31_000, false);

      /** Provides inbox write behavior. */
      const inboxWrite = transaction.set.mock.calls.find(([ref]) =>
        (
          ref as {
            /** Stores path. */
            path: string;
          }
        ).path.includes("/raceInbox/"),
      );
      expect(inboxWrite?.[1]).toMatchObject({
        opponentDisplayName: "Fallback username",
        result: expectedResult,
        adjustedDeltaMs,
      });
      expect(inboxWrite?.[1]).not.toHaveProperty("opponentAvatarUrl");
      expect(transaction.set).toHaveBeenCalledTimes(3);
    },
  );
});
