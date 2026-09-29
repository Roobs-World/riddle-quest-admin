import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {RACE_RULES} from "@qwordly/core/race";
import {migrateRaceArchitecturePage} from "../../race/raceArchitectureMigration";
import {raceChallengeEligibility} from "../../race/raceEligibility";
import {raceDeckContentVersion} from "../../race/raceDeckSnapshot";
import {parseChallengeRecord} from "../../race/raceSetupService";
import {findRecordedRaceMatch} from "../../race/raceMatchmaking";

/** Fixed clock keeps legacy expiration and migration expectations deterministic. */
const NOW = 10_000;
/** Canonical creator and requester from the same authenticated provider pool. */
const CREATOR = `reddit_${"a".repeat(40)}`;
/** Independent requester identity. */
const PLAYER = `reddit_${"b".repeat(40)}`;
/** Archived original content, never loaded from a mutable catalog. */
const RIDDLES = Array.from({length: 15}, (_, position) => ({position, riddleId: `q-${position}`,
  canonicalRiddleId: `canonical-${position}`, text: "Original clue", answer: "test"}));
/** Emulator database shared by fixtures and the production migration interface. */
let db: FirebaseFirestore.Firestore;

/** Legacy publication without an immutable archive or candidate projection. */
const challenge = (id: string) => ({challengeId: id, creatorId: CREATOR, creatorRunId: "recording", locale: "en",
  creatorSnapshot: {displayName: "Creator"}, categoryId: "history", deckId: "deck", canonicalRiddleIds: RIDDLES.map((riddle) => riddle.canonicalRiddleId),
  targetCorrect: 10, creatorWallFinishMs: 20_000, creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0,
  creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 20_000, ghostEvents: [], rules: RACE_RULES,
  contentVersion: "legacy-catalog-version", status: "active", createdAtMs: 1_000, expiresAtMs: 100_000,
  expiresAt: Timestamp.fromMillis(100_000)});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("migration-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceChallenges", "raceRuns", "raceMatchCandidates", "raceMatchOffers", "raceInviteLobbies",
    "raceAttempts", "users", "jestAccountDeletionTombstones"].map((name) => db.recursiveDelete(db.collection(name))));
  await db.doc("raceRuns/recording").set({runId: "recording", userId: CREATOR, locale: "en", riddles: RIDDLES});
});

it("dry-runs legacy archives and projections without changing storage", async () => {
  await db.doc("raceChallenges/public").set(challenge("public"));
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges"}, NOW)).resolves.toMatchObject({changed: 1, scanned: 1, complete: true});
  expect((await db.doc("raceChallenges/public").get()).data()?.riddles).toBeUndefined();
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
});

it("restores discovery from the creator archive and replaying does not change it", async () => {
  await db.doc("raceChallenges/public").set(challenge("public"));
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({changed: 1});
  await expect(findRecordedRaceMatch(PLAYER, {locale: "en", requestId: "backfilled-match"}, {db, nowMs: NOW})).resolves.toMatchObject({status: "matched", challenge: {challengeId: "public"}});
  expect((await db.doc("raceChallenges/public").get()).data()).toMatchObject({riddles: RIDDLES, scope: "public", snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await db.doc("raceRuns/recording").delete();
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({changed: 0, skipped: 1});
});

it("keeps private invitations out of public discovery even when their lobby has disappeared", async () => {
  await db.doc("raceChallenges/jest-invite-legacy").set(challenge("jest-invite-legacy"));
  await db.doc("raceChallenges/private").set({...challenge("private"), scope: "invitation"});
  await db.doc("raceChallenges/opaque-private").set(challenge("opaque-private"));
  await db.doc("raceInviteLobbies/opaque-private").set({creatorId: CREATOR});
  await migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW);
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
  for (const id of ["jest-invite-legacy", "private", "opaque-private"]) {
    expect((await db.doc(`raceChallenges/${id}`).get()).data()?.scope).toBe("invitation");
  }
});

it("reports unavailable original decks and never reconstructs their content", async () => {
  await db.doc("raceChallenges/missing").set({...challenge("missing"), creatorRunId: "missing-run"});
  await expect(migrateRaceArchitecturePage(db, {collection: "challenges", dryRun: false}, NOW)).resolves.toMatchObject({unavailable: 1, changed: 0});
  expect((await db.collection("raceMatchCandidates").get()).empty).toBe(true);
});

it("paginates by stable document ID and safely removes stale projections", async () => {
  await db.doc("raceChallenges/a").set(challenge("a"));
  await db.doc("raceChallenges/b").set({...challenge("b"), status: "revoked"});
  await db.doc("raceMatchCandidates/b").set({status: "active"});
  const first = await migrateRaceArchitecturePage(db, {collection: "challenges", limit: 1, dryRun: false}, NOW);
  expect(first).toMatchObject({nextAfterId: "a", complete: false, changed: 1});
  const second = await migrateRaceArchitecturePage(db, {collection: "challenges", afterId: first.nextAfterId, dryRun: false}, NOW);
  expect(second).toMatchObject({nextAfterId: "b", complete: true, changed: 1});
  expect((await db.doc("raceMatchCandidates/b").get()).exists).toBe(false);
});

it("populates legacy active deadlines and rules snapshots idempotently", async () => {
  await db.doc("raceRuns/active").set({runId: "active", userId: PLAYER, role: "challenger", status: "active", locale: "en",
    categoryId: "history", rulesVersion: RACE_RULES.version, deckId: "deck", riddles: RIDDLES, events: [], startedAtMs: 1_000,
    currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [], hintPenaltyMs: 0, skipPenaltyMs: 0});
  await expect(migrateRaceArchitecturePage(db, {collection: "runs", dryRun: false}, NOW)).resolves.toMatchObject({changed: 1});
  expect((await db.doc("raceRuns/active").get()).data()).toMatchObject({deadlineAtMs: 301_000, rulesSnapshot: RACE_RULES});
  await expect(migrateRaceArchitecturePage(db, {collection: "runs", dryRun: false}, NOW)).resolves.toMatchObject({changed: 0});
});

it.each(["missing", "cancelled", "wrong-creator", "expired", "wrong-recipient"])("rejects private acceptance with a %s lobby", async (reason) => {
  const record = parseChallengeRecord({...challenge("private"), scope: "invitation", riddles: RIDDLES});
  if (reason !== "missing") await db.doc("raceInviteLobbies/private").set({challengeId: "private", creatorId: reason === "wrong-creator" ? PLAYER : CREATOR,
    recipientId: reason === "wrong-recipient" ? CREATOR : PLAYER, locale: "en", expiresAtMs: reason === "expired" ? NOW : 100_000,
    status: reason === "cancelled" ? "cancelled" : "published"});
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER, record, "en", NOW))).resolves.toBe("invitation");
});

it("accepts a valid private seat but rejects a tampered versioned archive", async () => {
  await db.doc("raceInviteLobbies/private").set({challengeId: "private", creatorId: CREATOR, recipientId: PLAYER,
    locale: "en", expiresAtMs: 100_000, status: "published"});
  const record = parseChallengeRecord({...challenge("private"), scope: "invitation", riddles: RIDDLES,
    snapshotVersion: 1, contentVersion: raceDeckContentVersion(RIDDLES)});
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER, record, "en", NOW))).resolves.toBeNull();
  await expect(db.runTransaction((transaction) => raceChallengeEligibility(transaction, db, PLAYER,
    {...record, riddles: RIDDLES.map((riddle) => ({...riddle, answer: "changed"}))}, "en", NOW))).resolves.toBe("content");
});
