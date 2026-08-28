import {findRedditRaceMatch} from "../reddit/redditMatchmaking";

/** Provides reddit uid behavior. */
const redditUid = (character: string) => `reddit_${character.repeat(40)}`;
/** Provides now ms behavior. */
const nowMs = 10_000;
/** Provides record behavior. */
const record = (challengeId: string, creatorId: string, locale = "fr") => ({
  challengeId,
  creatorId,
  creatorRunId: `run-${challengeId}`,
  creatorSnapshot: {displayName: "Rival"},
  categoryId: "history",
  locale,
  deckId: `deck-${challengeId}`,
  canonicalRiddleIds: Array.from({length: 15}, (_, index) => `riddle-${index}`),
  targetCorrect: 10,
  creatorWallFinishMs: 40_000,
  creatorHintPenaltyMs: 0,
  creatorSkipPenaltyMs: 0,
  creatorTotalPenaltyMs: 0,
  creatorAdjustedFinishMs: 40_000,
  ghostEvents: [],
  rules: {
    version: "race10_v1",
    targetCorrect: 10,
    deckSize: 15,
    maxGuessesPerRiddle: 5,
    hintPenaltyMs: 15_000,
    skipPenaltyMs: 45_000,
    maxAdjustedTimeMs: 300_000,
  },
  contentVersion: "automated_translation_v1",
  status: "active",
  createdAtMs: 1,
  expiresAtMs: 20_000,
  expiresAt: {toMillis: () => 20_000},
});

/** Provides database behavior. */
const database = (documents: unknown[]) => {
  /** Provides get behavior. */
  const get = jest.fn(async () => ({docs: documents.map((value) => ({data: () => value}))}));
  /** Provides query behavior. */
  const query = {where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), get};
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return {db: {collection: jest.fn(() => query)}, query};
};

/** Provides preview behavior. */
const preview = (challengeId: string, locale = "fr") => ({
  challengeId,
  creator: {displayName: "Rival"},
  categoryId: "history" as const,
  locale: locale as "fr",
  targetCorrect: 10 as const,
  adjustedTimeToBeatMs: 40_000,
  rulesVersion: "race10_v1" as const,
  expiresAtMs: 20_000,
  status: "active" as const,
});

describe("Reddit global offline matchmaking", () => {
  it("selects only another Reddit player's exact-locale active challenge", async () => {
    /** Provides player behavior. */
    const player = redditUid("a");
    /** Provides rival behavior. */
    const rival = redditUid("b");
    /** Provides {db, query} behavior. */
    const {db, query} = database([
      record("self-challenge", player),
      record("jest-challenge", `jest_${"c".repeat(40)}`),
      record("rival-challenge", rival),
    ]);
    /** Resolves preview. */
    const resolvePreview = jest.fn(async (challengeId: string) => preview(challengeId));
    await expect(
      findRedditRaceMatch(player, "fr", {
        db: db as never,
        nowMs,
        preview: resolvePreview as never,
        socialProfile: async () => ({displayName: "Rival"}),
      }),
    ).resolves.toEqual({status: "matched", challenge: preview("rival-challenge")});
    expect(query.where.mock.calls).toEqual([
      ["locale", "==", "fr"],
      ["status", "==", "active"],
      ["expiresAtMs", ">", nowMs],
    ]);
    expect(query.orderBy).toHaveBeenCalledWith("expiresAtMs", "asc");
    expect(query.limit).toHaveBeenCalledWith(50);
    expect(resolvePreview).toHaveBeenCalledTimes(1);
  });

  it("returns an exact-locale empty result and rejects non-Reddit callers", async () => {
    /** Provides {db} behavior. */
    const {db} = database([]);
    await expect(findRedditRaceMatch(redditUid("a"), "ar", {db: db as never, nowMs})).resolves.toEqual({
      status: "empty",
      locale: "ar",
    });
    await expect(findRedditRaceMatch(`facebook_${"a".repeat(40)}`, "ar", {db: db as never, nowMs})).rejects.toThrow(
      "reddit-matchmaking-identity-required",
    );
  });

  it("skips corrupt and concurrently unavailable candidates", async () => {
    /** Provides rival behavior. */
    const rival = redditUid("b");
    /** Provides {db} behavior. */
    const {db} = database([{challengeId: "corrupt"}, record("gone", rival), record("ready", rival)]);
    /** Resolves preview. */
    const resolvePreview = jest.fn(async (challengeId: string) => {
      if (challengeId === "gone") throw new Error("revoked");
      return preview(challengeId);
    });
    await expect(
      findRedditRaceMatch(redditUid("a"), "fr", {
        db: db as never,
        nowMs,
        preview: resolvePreview as never,
        socialProfile: async () => ({displayName: "Rival"}),
      }),
    ).resolves.toEqual({status: "matched", challenge: preview("ready")});
  });

  it("uses only a refreshed provider profile on the returned Reddit social surface", async () => {
    /** Provides {db} behavior. */
    const {db} = database([record("ready", redditUid("b"))]);
    await expect(
      findRedditRaceMatch(redditUid("a"), "fr", {
        db: db as never,
        nowMs,
        preview: async () => preview("ready"),
        socialProfile: async () => ({
          displayName: "FreshRival",
          avatarUrl: "https://styles.redditmedia.com/avatar.png",
        }),
      }),
    ).resolves.toMatchObject({
      status: "matched",
      challenge: {
        creator: {
          displayName: "FreshRival",
          avatarUrl: "https://styles.redditmedia.com/avatar.png",
        },
      },
    });
  });
});
