import {hydrateRedditLiveRaceProfile} from "../redditLiveRaceProfile";

/** Private viewer ids used only to recover the matched seats. */
const OWN = `reddit_${"a".repeat(40)}`, RIVAL = `reddit_${"b".repeat(40)}`;
/** Answer-free live response before provider identity projection. */
const view = {ticketId: "a".repeat(64), phase: "countdown", serverNowMs: 10000, searchEndsAtMs: 60000,
  startsAtMs: 15000, player: {displayName: "GameAlias", avatarUrl: null, bot: false, correctCount: 0},
  opponent: {displayName: "OtherAlias", avatarUrl: null, bot: false, correctCount: 0},
  run: null, result: null, rewardCoins: 0};
/** Minimal storage seam distinguishes native profiles from canonical game account aliases. */
function database(blocked = false, expired = false): FirebaseFirestore.Firestore {
  return {
    doc: (path: string) => ({path, get: async () => ({data: () => path.startsWith("liveRaceTickets/")
      ? {userId: OWN, matchId: "match"} : {tickets: [view.ticketId, "b".repeat(64)], runs: [{userId: OWN}, {userId: RIVAL}]}})}),
    getAll: async () => [{exists: blocked}, {exists: false}, {exists: false}],
    collection: (collectionName: string) => {
      /** The provider query's authenticated owner filter. */
      let owner = "";
      /** Each profile query retains its own filter during concurrent calls. */
      const query = {doc: (id: string) => ({path: `${collectionName}/${id}`}),
        where: (field: string, _operation: string, value: string) => {if (field === "uid") owner = value; return query;},
        limit: () => query, get: async () => ({size: 1, docs: [{data: () => ({status: "active", redditProfile: {
          username: owner === OWN ? "RedditAlice" : "RedditBob", avatarUrl: "https://styles.redditmedia.com/avatar.png",
          expiresAt: {toMillis: () => expired ? 9999 : 20000},
        }})}]})};
      return query;
    },
  } as unknown as FirebaseFirestore.Firestore;
}

it("renders both live seats using fresh Reddit usernames and avatars", async () => {
  /** Both public identities are recovered from server-owned match subjects. */
  const result = await hydrateRedditLiveRaceProfile(view, database(), 10000);
  expect(result.player).toMatchObject({displayName: "RedditAlice", avatarUrl: "https://styles.redditmedia.com/avatar.png"});
  expect(result.opponent).toMatchObject({displayName: "RedditBob", avatarUrl: "https://styles.redditmedia.com/avatar.png"});
  expect(JSON.stringify(result)).not.toContain(OWN); expect(JSON.stringify(result)).not.toContain(RIVAL);
});
it("hides blocked rivals and expires temporary provider profiles", async () => {
  expect((await hydrateRedditLiveRaceProfile(view, database(true), 10000)).opponent)
    .toMatchObject({displayName: "Riddle Quest player", avatarUrl: null});
  expect((await hydrateRedditLiveRaceProfile(view, database(false, true), 10000)).opponent?.avatarUrl).toBeNull();
});
