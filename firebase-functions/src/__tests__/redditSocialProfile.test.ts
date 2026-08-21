import {hydrateRedditRaceSocialResult, readRedditSocialProfile} from "../reddit/redditSocialProfile";

const UID = `reddit_${"a".repeat(40)}`;
const timestamp = (value: number) => ({toMillis: () => value});
const db = (documents: Record<string, unknown>[]) => {
  const query = {where: jest.fn(), limit: jest.fn(), get: jest.fn(async () => ({
    size: documents.length, docs: documents.map((value) => ({data: () => value})),
  }))};
  query.where.mockReturnValue(query); query.limit.mockReturnValue(query);
  return {database: {collection: jest.fn(() => query)} as unknown as FirebaseFirestore.Firestore, query};
};

describe("Reddit social profile projection", () => {
  it("returns one active unexpired provider profile without its raw identity", async () => {
    const {database, query} = db([{provider: "reddit", status: "active", uid: UID, providerUserId: "t2_private",
      redditProfile: {username: "RedditSolver", avatarUrl: "https://styles.redditmedia.com/avatar.png",
        refreshedAt: timestamp(1), expiresAt: timestamp(20_000)}}]);
    await expect(readRedditSocialProfile(UID, {db: database, nowMs: 10_000})).resolves.toEqual({
      displayName: "RedditSolver", avatarUrl: "https://styles.redditmedia.com/avatar.png",
    });
    expect(query.where.mock.calls).toEqual([["provider", "==", "reddit"], ["uid", "==", UID]]);
  });

  it.each([
    [{provider: "reddit", status: "deleted", redditProfile: {username: "OldName", expiresAt: timestamp(20_000)}}],
    [{provider: "reddit", status: "active", redditProfile: {username: "OldName", expiresAt: timestamp(10_000)}}],
    [{provider: "reddit", status: "active", redditProfile: {username: "OldName", expiresAt: timestamp(20_000), avatarUrl: "https://evil.example/avatar"}}],
  ])("fails closed for deleted, expired, or invalid provider data", async (document) => {
    const {database} = db(document ? [document] : []);
    const result = await readRedditSocialProfile(UID, {db: database, nowMs: 10_000});
    if ((document.redditProfile as {avatarUrl?: string}).avatarUrl) expect(result).toEqual({displayName: "OldName"});
    else expect(result).toBeUndefined();
  });

  it("rejects non-Reddit IDs and ambiguous provider mappings", async () => {
    const {database} = db([{status: "active"}, {status: "active"}]);
    await expect(readRedditSocialProfile(`facebook_${"a".repeat(40)}`, {db: database})).resolves.toBeUndefined();
    await expect(readRedditSocialProfile(UID, {db: database})).resolves.toBeUndefined();
  });

  it("rehydrates challenge and Activity surfaces without exposing provider IDs", async () => {
    const challenge = {
      challengeId: "challenge-1", creatorId: UID, creatorRunId: "creator-run", creatorSnapshot: {displayName: "Stale"},
      categoryId: "history", locale: "fr", deckId: "deck-1",
      canonicalRiddleIds: Array.from({length: 15}, (_, index) => `history:${index}`), targetCorrect: 10,
      creatorWallFinishMs: 40_000, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0,
      creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 40_000, ghostEvents: [],
      rules: {version: "race10_v1", targetCorrect: 10, deckSize: 15, maxGuessesPerRiddle: 5,
        hintPenaltyMs: 15_000, skipPenaltyMs: 45_000, maxAdjustedTimeMs: 300_000},
      contentVersion: "automated_translation_v1", status: "active", createdAtMs: 1,
      expiresAtMs: 20_000, expiresAt: timestamp(20_000),
    };
    const profile = {provider: "reddit", status: "active", uid: UID,
      redditProfile: {username: "FreshSolver", avatarUrl: "https://styles.redditmedia.com/avatar.png",
        refreshedAt: timestamp(1), expiresAt: timestamp(20_000)}};
    const providerQuery = {where: jest.fn(), limit: jest.fn(), get: jest.fn(async () => ({size: 1, docs: [{data: () => profile}]}))};
    providerQuery.where.mockReturnValue(providerQuery); providerQuery.limit.mockReturnValue(providerQuery);
    const database = {collection: jest.fn((name: string) => name === "providerIdentities" ? providerQuery : ({
      doc: () => ({get: async () => ({exists: true, data: () => challenge})}),
    }))} as unknown as FirebaseFirestore.Firestore;
    const preview = {challengeId: "challenge-1", creator: {displayName: "Stale"}, categoryId: "history",
      locale: "fr", targetCorrect: 10, adjustedTimeToBeatMs: 40_000, rulesVersion: "race10_v1",
      expiresAtMs: 20_000, status: "active"};
    const hydrated = await hydrateRedditRaceSocialResult("gameplay.race.challenge", {challengeId: "challenge-1"},
      preview, {db: database, nowMs: 10_000});
    expect(hydrated).toMatchObject({creator: {displayName: "FreshSolver",
      avatarUrl: "https://styles.redditmedia.com/avatar.png"}});
    expect(JSON.stringify(hydrated)).not.toContain("t2_");

    const inbox = await hydrateRedditRaceSocialResult("gameplay.race.inbox", {}, {items: [{
      itemId: "item-1", challengeId: "challenge-1", opponentUserId: UID, opponentDisplayName: "Stale",
      categoryId: "history", result: "win", adjustedDeltaMs: 1, read: false, createdAtMs: 1,
    }]}, {db: database, nowMs: 10_000});
    expect(inbox).toMatchObject({items: [{opponentDisplayName: "FreshSolver",
      opponentAvatarUrl: "https://styles.redditmedia.com/avatar.png"}]});
  });
});
