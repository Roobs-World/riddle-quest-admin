import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {findRedditRaceMatch} from "../reddit/redditMatchmaking";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const NOW = Date.UTC(2026, 7, 20, 12);
const uid = (character: string) => `reddit_${character.repeat(40)}`;
let db: FirebaseFirestore.Firestore;

const challenge = (challengeId: string, creatorId: string, locale: "en" | "ar") => ({
  challengeId, creatorId, creatorRunId: `run-${challengeId}`,
  creatorSnapshot: {displayName: `Rival ${challengeId}`}, categoryId: "history", locale,
  deckId: `deck-${challengeId}`, canonicalRiddleIds: Array.from({length: 15}, (_, index) => `${challengeId}-riddle-${index}`),
  targetCorrect: 10, creatorWallFinishMs: 40_000, creatorHintPenaltyMs: 0,
  creatorSkipPenaltyMs: 0, creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 40_000,
  ghostEvents: [], rules: {
    version: "race10_v1", targetCorrect: 10, deckSize: 15, maxGuessesPerRiddle: 5,
    hintPenaltyMs: 15_000, skipPenaltyMs: 45_000, maxAdjustedTimeMs: 300_000,
  }, contentVersion: "automated_translation_v1", status: "active",
  createdAtMs: NOW - 1_000, expiresAtMs: NOW + 60_000, expiresAt: Timestamp.fromMillis(NOW + 60_000),
});

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

afterAll(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

it("matches concurrent global Reddit callers only to other players in the exact locale", async () => {
  const englishCreator = uid("a");
  const arabicCreator = uid("b");
  const englishPlayer = uid("c");
  const arabicPlayer = uid("d");
  await Promise.all([
    db.collection("raceChallenges").doc("english-match").set(challenge("english-match", englishCreator, "en")),
    db.collection("raceChallenges").doc("arabic-match").set(challenge("arabic-match", arabicCreator, "ar")),
    db.collection("raceChallenges").doc("self-match").set(challenge("self-match", englishPlayer, "en")),
    db.collection("raceChallenges").doc("foreign-provider").set(challenge("foreign-provider", `facebook_${"e".repeat(40)}`, "en")),
  ]);

  const [english, arabic] = await Promise.all([
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(englishPlayer, "en", {db, nowMs: NOW}))),
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(arabicPlayer, "ar", {db, nowMs: NOW}))),
  ]);
  expect(english.every((result) => result.status === "matched" && result.challenge.challengeId === "english-match" && result.challenge.locale === "en")).toBe(true);
  expect(arabic.every((result) => result.status === "matched" && result.challenge.challengeId === "arabic-match" && result.challenge.locale === "ar")).toBe(true);
  expect(JSON.stringify(english)).not.toContain("self-match");
  expect(JSON.stringify(english)).not.toContain("foreign-provider");
});

it("returns empty when only self, cross-locale, expired, or revoked candidates exist", async () => {
  const player = uid("a");
  await Promise.all([
    db.collection("raceChallenges").doc("self").set(challenge("self", player, "en")),
    db.collection("raceChallenges").doc("arabic").set(challenge("arabic", uid("b"), "ar")),
    db.collection("raceChallenges").doc("expired").set({...challenge("expired", uid("c"), "en"), expiresAtMs: NOW - 1, expiresAt: Timestamp.fromMillis(NOW - 1)}),
    db.collection("raceChallenges").doc("revoked").set({...challenge("revoked", uid("d"), "en"), status: "revoked"}),
  ]);
  await expect(findRedditRaceMatch(player, "en", {db, nowMs: NOW})).resolves.toEqual({status: "empty", locale: "en"});
});
