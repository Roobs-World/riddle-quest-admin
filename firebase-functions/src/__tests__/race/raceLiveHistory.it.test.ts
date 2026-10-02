import {initializeApp, deleteApp, type App} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {listLiveRaceHistoryForUser} from "../../race/raceLiveHistory";
import {getJestAccountDeletionRef, JEST_ACCOUNT_DELETION_COLLECTION} from "../../jest/jestAccountDeletion";
import {LIVE_RACE_HISTORY_MS} from "@qwordly/core/race";

/** Local demo project is mandatory before any fixture cleanup. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Stable authority clock bounds ticket and match retention. */
const NOW = 1_800_000_000_000;
/** Every fixture has its own explicitly configured application. */
let app: App;
/** Real loopback Firestore stores game authority. */
let db: FirebaseFirestore.Firestore;
/** Delete only synthesized demo collections after validating the environment. */
async function clear() {
  for (const collection of ["users", "localizedRiddles", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers",
    "racePerformanceOutbox", JEST_ACCOUNT_DELETION_COLLECTION]) await db.recursiveDelete(db.collection(collection));
}
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Owned loopback demo Firestore required");
  app = initializeApp({projectId: PROJECT}, "live-history-fixture"); db = getFirestore(app);
});
beforeEach(clear);
afterAll(async () => {if (db) await clear(); if (app) await deleteApp(app);});

/** A real match settles a forfeit once; history observes rather than reproducing its grant. */
async function completed(provider: "facebook" | "reddit", suffix = "first", nowMs = NOW, locale: "en" | "fr" = "en") {
  /** Canonical private account identities never appear in the returned history. */
  const ids = [`${provider}_${"a".repeat(40)}`, `${provider}_${"b".repeat(40)}`];
  /** Eligible catalog and current profiles are synthesized without provider information. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/${locale}/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history", text: `Unique history question ${index} has an independent trail`,
    answer: `a${String(index).padStart(6, "0")}`, difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
  for (const [index, id] of ids.entries()) batch.set(db.doc(`users/${id}`), {username: `History player ${index}`, coins: 100}, {merge: true});
  await batch.commit();
  /** Shared source and two seats are created by the production engine. */
  const a = await joinLiveRaceForUser(ids[0], {locale, categoryId: "history", requestId: `history-a-${suffix}`}, {db, nowMs});
  /** Real matching selects the already waiting creator. */
  const b = await joinLiveRaceForUser(ids[1], {locale, categoryId: "history", requestId: `history-b-${suffix}`}, {db, nowMs: nowMs + 1000});
  await updateLiveRaceForUser(ids[1], {ticketId: b.ticketId, action: "leave", requestId: `history-leave-${suffix}`}, {db, nowMs: nowMs + 8000});
  return {ids, seats: [a, b]};
}

it.each(["facebook", "reddit"] as const)("projects both %s terminal seats without answers, identities or another grant", async provider => {
  /** Winning and losing viewers receive their own seat projection. */
  const {ids, seats} = await completed(provider);
  for (const index of [0, 1]) {
    /** The result contains only the locale, server time and exact public row vocabulary. */
    const value = await listLiveRaceHistoryForUser(ids[index], {locale: "en", limit: 20}, {db, nowMs: NOW + 9000});
    expect(value.entries).toHaveLength(1);
    expect(value.entries[0]).toMatchObject({ticketId: seats[index].ticketId, result: index === 0 ? "win" : "loss",
      rewardCoins: index === 0 ? 50 : 0, opponentAvailable: true, opponent: {displayName: `History player ${1 - index}`, bot: false}});
    expect(Object.keys(value.entries[0]).sort()).toEqual(["ticketId", "categoryId", "createdAtMs", "result", "correctCount", "opponent", "opponentAvailable", "rewardCoins"].sort());
    expect(JSON.stringify(value)).not.toMatch(/facebook_|reddit_|userId|participantIds|riddles|guessHistory|answer|matchId/);
    for (let repeat = 0; repeat < 3; repeat++) expect(await listLiveRaceHistoryForUser(ids[index], {locale: "en", limit: 20}, {db, nowMs: NOW + 9000})).toEqual(value);
  }
  expect((await db.doc(`users/${ids[0]}`).get()).data()!.coins).toBe(150);
  expect((await db.doc(`users/${ids[1]}`).get()).data()!.coins).toBe(100);
});

it.each(["blocked", "reverse-blocked", "deleted", "missing", "expired-peer"] as const)("anonymizes a %s human before projecting retained history", async kind => {
  /** A committed result remains readable while its private human identity can be retired independently. */
  const {ids, seats} = await completed("facebook");
  if (kind === "blocked") await db.doc(`users/${ids[0]}/blockedRivals/${ids[1]}`).set({targetUserId: ids[1]});
  if (kind === "reverse-blocked") await db.doc(`users/${ids[1]}/blockedRivals/${ids[0]}`).set({targetUserId: ids[0]});
  if (kind === "deleted") await getJestAccountDeletionRef(db, ids[1]).set({deletedAtMs: NOW + 9000});
  if (kind === "missing") await db.doc(`users/${ids[1]}`).delete();
  if (kind === "expired-peer") await db.doc(`liveRaceTickets/${seats[1].ticketId}`).update({expiresAt: Timestamp.fromMillis(NOW + 8999)});
  /** Previous copied profile, score and ability to target the rival are all suppressed. */
  const value = await listLiveRaceHistoryForUser(ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW + 9000});
  expect(value.entries[0]).toMatchObject({result: "win", rewardCoins: 50, opponentAvailable: false,
    opponent: {displayName: "Riddle Quest player", avatarUrl: null, level: 1, correctCount: 0, bot: false}});
  expect(JSON.stringify(value)).not.toContain("History player 1");
});

it("omits active, unsettled, future, expired and foreign-locale tickets with a bounded newest-first result", async () => {
  /** Separate real matches retain distinct content languages and original creation clocks. */
  const first = await completed("reddit", "first", NOW);
  const french = await completed("reddit", "french", NOW + 20_000, "fr");
  const newest = await completed("reddit", "newest", NOW + 40_000);
  /** A later unpaired live search has no terminal receipt and must not become history. */
  await joinLiveRaceForUser(first.ids[0], {locale: "en", categoryId: "history", requestId: "history-searching"}, {db, nowMs: NOW + 60_000});
  expect((await listLiveRaceHistoryForUser(first.ids[0], {locale: "en", limit: 1}, {db, nowMs: NOW + 70_000})).entries.map(row => row.ticketId))
    .toEqual([newest.seats[0].ticketId]);
  expect((await listLiveRaceHistoryForUser(first.ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW + 70_000})).entries.map(row => row.ticketId))
    .toEqual([newest.seats[0].ticketId, first.seats[0].ticketId]);
  expect((await listLiveRaceHistoryForUser(first.ids[0], {locale: "fr", limit: 20}, {db, nowMs: NOW + 70_000})).entries.map(row => row.ticketId))
    .toEqual([french.seats[0].ticketId]);
  expect((await listLiveRaceHistoryForUser(first.ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW - 1})).entries).toEqual([]);
  expect((await listLiveRaceHistoryForUser(first.ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW + LIVE_RACE_HISTORY_MS + 100_000})).entries).toEqual([]);
});

it.each(["foreign-owner", "corrupt-run", "missing-grant", "expired-match", "deleted-owner"] as const)("rejects or omits %s authority without private disclosure", async kind => {
  /** Private authority is mutated only inside the guarded demo project. */
  const {ids, seats} = await completed("facebook");
  if (kind === "foreign-owner") await db.doc(`liveRaceTickets/${seats[0].ticketId}`).update({"run.userId": ids[1]});
  if (kind === "corrupt-run") await db.doc(`liveRaceTickets/${seats[0].ticketId}`).update({"run.runId": seats[1].ticketId});
  if (kind === "missing-grant") await db.doc(`liveRaceMatches/${seats[0].ticketId}`).update({rewardCoins: -1});
  if (kind === "expired-match") await db.doc(`liveRaceMatches/${seats[0].ticketId}`).update({expiresAt: Timestamp.fromMillis(NOW + 8999)});
  if (kind === "deleted-owner") {
    await getJestAccountDeletionRef(db, ids[0]).set({deletedAtMs: NOW + 9000});
    await expect(listLiveRaceHistoryForUser(ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW + 9000})).rejects.toThrow("account-deleted");
  } else expect((await listLiveRaceHistoryForUser(ids[0], {locale: "en", limit: 20}, {db, nowMs: NOW + 9000})).entries).toEqual([]);
});
