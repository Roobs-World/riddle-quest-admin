import {findRedditRaceMatch} from "../redditMatchmaking";
import {findRecordedRaceMatch} from "../../../../../firebase-functions/src/race/matchmaking/raceMatchmaking";

jest.mock("../../../../../firebase-functions/src/race/matchmaking/raceMatchmaking", () => ({findRecordedRaceMatch: jest.fn()}));

/** Authenticated Reddit identity fixture. */
const uid = (value: string) => `reddit_${value.repeat(40)}`;
/** Authoritative matched response fixture. */
const matched = {
  status: "matched", challenge: {challengeId: "challenge", creator: {displayName: "Game name"},
    categoryId: "history", locale: "fr", targetCorrect: 10, adjustedTimeToBeatMs: 40_000,
    rulesVersion: "race10_v1", expiresAtMs: 20_000, status: "active"},
};
/** Provider presentation storage fixture; no installation state is involved. */
const db = {doc: jest.fn(() => ({get: jest.fn(async () => ({data: () => ({creatorId: uid("b")})}))}))} as unknown as FirebaseFirestore.Firestore;

beforeEach(() => {jest.clearAllMocks();});

it("rejects a non-Reddit identity before invoking shared selection", async () => {
  await expect(findRedditRaceMatch(`facebook_${"a".repeat(40)}`, "fr")).rejects.toThrow("reddit-matchmaking-identity-required");
  expect(findRecordedRaceMatch).not.toHaveBeenCalled();
});

it("passes category and stable retry preferences to shared selection and hydrates only the chosen rival", async () => {
  (findRecordedRaceMatch as jest.Mock).mockResolvedValue(matched);
  /** Provides social profile behavior. */
  const socialProfile = jest.fn(async () => ({displayName: "FreshRival", avatarUrl: "https://styles.redditmedia.com/avatar.png"}));
  /** Provides input behavior. */
  const input = {locale: "fr" as const, categoryId: "history" as const, requestId: "match-request-1"};
  await expect(findRedditRaceMatch(uid("a"), input, {db, nowMs: 10_000, socialProfile})).resolves.toMatchObject({
    status: "matched", challenge: {creator: {displayName: "FreshRival"}},
  });
  expect(findRecordedRaceMatch).toHaveBeenCalledWith(uid("a"), input, expect.objectContaining({db, nowMs: 10_000}));
  expect(socialProfile).toHaveBeenCalledTimes(1);
});

it("returns an empty pool without looking up provider profile data", async () => {
  (findRecordedRaceMatch as jest.Mock).mockResolvedValue({status: "empty", locale: "fr"});
  /** Provides social profile behavior. */
  const socialProfile = jest.fn();
  await expect(findRedditRaceMatch(uid("a"), "fr", {db, socialProfile})).resolves.toEqual({status: "empty", locale: "fr"});
  expect(socialProfile).not.toHaveBeenCalled();
});

it("propagates infrastructure failures rather than disguising them as an empty pool", async () => {
  (findRecordedRaceMatch as jest.Mock).mockRejectedValue(new Error("storage-unavailable"));
  await expect(findRedditRaceMatch(uid("a"), "fr", {db})).rejects.toThrow("storage-unavailable");
});
