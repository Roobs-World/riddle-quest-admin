import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {projectRaceMatchCandidate} from "../race/raceMatchCandidates";
import {parseChallengeRecord, requestDocumentId} from "../race/raceSetupService";
import {findRedditRaceMatch} from "../reddit/redditMatchmaking";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the now interface. */
const NOW = Date.UTC(2026, 7, 20, 12);
/** Provides uid behavior. */
const uid = (character: string) => `reddit_${character.repeat(40)}`;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

/** Provides challenge behavior. */
const challenge = (challengeId: string, creatorId: string, locale: "en" | "ar") => ({
  challengeId,
  creatorId,
  creatorRunId: `run-${challengeId}`,
  creatorSnapshot: {displayName: `Rival ${challengeId}`},
  categoryId: "history",
  locale,
  deckId: `deck-${challengeId}`,
  canonicalRiddleIds: Array.from({length: 15}, (_, index) => `${challengeId}-riddle-${index}`),
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `${challengeId}-riddle-${position}`, text: "Archived clue", answer: "test", position})),
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
  createdAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
  expiresAt: Timestamp.fromMillis(NOW + 60_000),
});

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("raceMatchCandidates")),
    db.recursiveDelete(db.collection("raceMatchOffers")),
    db.recursiveDelete(db.collection("raceAttempts")),
    db.recursiveDelete(db.collection("users")),
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

afterAll(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("raceMatchCandidates")),
    db.recursiveDelete(db.collection("raceMatchOffers")),
    db.recursiveDelete(db.collection("raceAttempts")),
    db.recursiveDelete(db.collection("users")),
    db.recursiveDelete(db.collection("raceChallenges")),
    db.recursiveDelete(db.collection("jestAccountDeletionTombstones")),
  ]);
});

/** Projects the canonical fixtures using the same publication projection as production. */
async function projectCandidates(): Promise<void> {
  const challenges = await db.collection("raceChallenges").get();
  const batch = db.batch();
  for (const document of challenges.docs) {
    const candidate = projectRaceMatchCandidate(parseChallengeRecord(document.data()));
    if (candidate) batch.set(db.doc(`raceMatchCandidates/${document.id}`), candidate);
  }
  await batch.commit();
}

it("matches concurrent global Reddit callers only to other players in the exact locale", async () => {
  /** Provides english creator behavior. */
  const englishCreator = uid("a");
  /** Provides arabic creator behavior. */
  const arabicCreator = uid("b");
  /** Provides english player behavior. */
  const englishPlayer = uid("c");
  /** Provides arabic player behavior. */
  const arabicPlayer = uid("d");
  await Promise.all([
    db
      .collection("raceChallenges")
      .doc("english-match")
      .set(challenge("english-match", englishCreator, "en")),
    db
      .collection("raceChallenges")
      .doc("arabic-match")
      .set(challenge("arabic-match", arabicCreator, "ar")),
    db
      .collection("raceChallenges")
      .doc("self-match")
      .set(challenge("self-match", englishPlayer, "en")),
    db
      .collection("raceChallenges")
      .doc("foreign-provider")
      .set(challenge("foreign-provider", `facebook_${"e".repeat(40)}`, "en")),
  ]);

  await projectCandidates();
  /** Provides [english, arabic] behavior. */
  const [english, arabic] = await Promise.all([
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(englishPlayer, "en", {db, nowMs: NOW}))),
    Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(arabicPlayer, "ar", {db, nowMs: NOW}))),
  ]);
  expect(
    english.every(
      (result) =>
        result.status === "matched" &&
        result.challenge.challengeId === "english-match" &&
        result.challenge.locale === "en",
    ),
  ).toBe(true);
  expect(
    arabic.every(
      (result) =>
        result.status === "matched" &&
        result.challenge.challengeId === "arabic-match" &&
        result.challenge.locale === "ar",
    ),
  ).toBe(true);
  expect(JSON.stringify(english)).not.toContain("self-match");
  expect(JSON.stringify(english)).not.toContain("foreign-provider");
});

it("returns empty when only self, cross-locale, expired, or revoked candidates exist", async () => {
  /** Provides player behavior. */
  const player = uid("a");
  await Promise.all([
    db
      .collection("raceChallenges")
      .doc("self")
      .set(challenge("self", player, "en")),
    db
      .collection("raceChallenges")
      .doc("arabic")
      .set(challenge("arabic", uid("b"), "ar")),
    db
      .collection("raceChallenges")
      .doc("expired")
      .set({...challenge("expired", uid("c"), "en"), expiresAtMs: NOW - 1, expiresAt: Timestamp.fromMillis(NOW - 1)}),
    db
      .collection("raceChallenges")
      .doc("revoked")
      .set({...challenge("revoked", uid("d"), "en"), status: "revoked"}),
  ]);
  await projectCandidates();
  await expect(findRedditRaceMatch(player, "en", {db, nowMs: NOW})).resolves.toEqual({status: "empty", locale: "en"});
});


it("skips attempted and bidirectionally blocked recordings before offering a match", async () => {
  const player = uid("a");
  for (const [id, creator] of [["attempted", uid("b")], ["blocked", uid("c")], ["ready", uid("d")]]) {
    await db.doc(`raceChallenges/${id}`).set(challenge(id, creator, "en"));
  }
  await projectCandidates();
  await db.doc(`raceAttempts/${requestDocumentId("attempted", player)}`).set({playerId: player});
  await db.doc(`users/${uid("c")}/blockedRivals/${player}`).set({blocked: true});
  const result = await findRedditRaceMatch(player, {locale: "en", requestId: "eligibility-request"}, {db, nowMs: NOW});
  expect(result).toMatchObject({status: "matched", challenge: {challengeId: "ready"}});
});

it("finds a playable recording beyond a full first page of attempted candidates", async () => {
  const player = uid("a");
  const batch = db.batch();
  for (let index = 0; index < 55; index += 1) {
    const id = `attempted-${index}`;
    batch.set(db.doc(`raceChallenges/${id}`), {...challenge(id, uid("b"), "en"), expiresAtMs: NOW + 30_000});
    batch.set(db.doc(`raceAttempts/${requestDocumentId(id, player)}`), {playerId: player});
  }
  batch.set(db.doc("raceChallenges/ready"), challenge("ready", uid("c"), "en"));
  await batch.commit();
  await projectCandidates();
  await expect(findRedditRaceMatch(player, {locale: "en", requestId: "second-page-request"}, {db, nowMs: NOW})).resolves.toMatchObject({
    status: "matched", challenge: {challengeId: "ready"},
  });
});

it("returns a stable offer for concurrent retries and rejects reusing its request for another language", async () => {
  await db.doc("raceChallenges/first").set(challenge("first", uid("b"), "en"));
  await db.doc("raceChallenges/second").set(challenge("second", uid("c"), "en"));
  await projectCandidates();
  const input = {locale: "en" as const, requestId: "stable-match-request"};
  const results = await Promise.all(Array.from({length: 8}, () => findRedditRaceMatch(uid("a"), input, {db, nowMs: NOW})));
  expect(new Set(results.map((result) => result.status === "matched" ? result.challenge.challengeId : "empty")).size).toBe(1);
  await expect(findRedditRaceMatch(uid("a"), {...input, locale: "ar"}, {db, nowMs: NOW})).rejects.toMatchObject({code: "invalid-argument"});
});
