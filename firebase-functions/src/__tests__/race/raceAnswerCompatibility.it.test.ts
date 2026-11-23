import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RaceRunViewSchema} from "../../../../src/races/contracts/index.js";
import {buildDeterministicRaceDeck, loadEligibleContent, listRaceCategoriesForLocale} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";
import {toRaceRunView} from "../../race/runs/raceEngine";
import type {LiveMatch} from "../../race/live/raceLiveState";

/** Every fixture mutation is confined to a dedicated private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual SDK queries and transaction commits exercise the catalog-to-match boundary. */
let db: FirebaseFirestore.Firestore;
/** Authored pools make an unaffected category and both competitive difficulty bands available. */
const data = (category: "history" | "music", index: number) => ({riddleId: `answer-${category}-${index}`, canonicalRiddleId: `${category}:${index}`,
  text: `Unique ${category} question ${index} follows a separate trail`, answer: `${category === "history" ? "a" : "b"}${String(index).padStart(6, "0")}`,
  categoryId: category, difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
/** Cleanup targets only named catalog and account fixtures; private live collections belong to the demo. */
const path = (category: "history" | "music", index: number) => `localizedRiddles/en/riddles/answer-${category}-${index}`;
/** The dedicated emulator never shares these collections with production or browser sessions. */
const clear = async () => {
  await Promise.all((["history", "music"] as const).flatMap(category => Array.from({length: 30}, (_, index) => db.doc(path(category, index)).delete())));
  for (const owner of [A, B]) {await db.recursiveDelete(db.doc(`users/${owner}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${owner}`));}
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceQueues", "liveRaceSignals", "liveRaceMatches"]) await db.recursiveDelete(db.collection(collection));
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Both owners retain their canonical balances when content is rejected or seats are published. */
  const batch = db.batch();
  for (const category of ["history", "music"] as const) for (let index = 0; index < 30; index++) batch.set(db.doc(path(category, index)), data(category, index));
  for (const owner of [A, B]) batch.set(db.doc(`users/${owner}`), {username: owner === A ? "Answer Alice" : "Answer Bob", coins: 550});
  await batch.commit();
});
afterAll(clear);

it.each([" cat", "cat ", " cat ", "\tcat\n", "\u00a0cat\u00a0", "a"+"\u0301".repeat(128), "abcdefgh", null])("hides an incompatible answer before exposing a category or deck", async answer => {
  await db.doc(path("history", 0)).update({answer});
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["music"]);
  /** Projected query records retain the offending answer so deck selection rejects the same pool. */
  const records = await loadEligibleContent(db, "en", "history");
  expect(() => buildDeterministicRaceDeck(records, {locale: "en", categoryId: "history", seed: "incompatible-answer"})).toThrow("Race category is not ready");
});

it.each([{createChallenge: false, answer: " cat "}, {createChallenge: true, answer: " cat "},
  {createChallenge: false, answer: "a"+"\u0301".repeat(128)}, {createChallenge: true, answer: "a"+"\u0301".repeat(128)}])(
  "rejects an unplayable answer before committing a live seat, private=$createChallenge", async ({createChallenge, answer}) => {
  await db.doc(path("history", 0)).update({answer});
  /** The real matchmaking transaction must not publish pointers, queues, seats or signals for an invalid pool. */
  const before = (await db.doc(`users/${A}`).get()).data();
  await expect(joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "invalid-live-answer", createChallenge}, {db, nowMs: NOW})).rejects.toThrow("Race category is not ready");
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceQueues", "liveRaceSignals", "liveRaceMatches"]) expect((await db.collection(collection).get()).empty).toBe(true);
  expect((await db.doc(`users/${A}`).get()).data()).toEqual(before);
});

it.each(["élément".normalize("NFD"), "ABCDEFG"])("plays canonical Unicode and uppercase answers without changing immutable text", async answer => {
  await db.doc(path("history", 0)).update({answer});
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["history", "music"]);
  /** Actual commits pair two owners and the following poll crosses the authoritative countdown boundary. */
  const a = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "canonical-alice-join"}, {db, nowMs: NOW});
  /** The rival consumes the same prepared immutable deck from the first seat. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "canonical-bob-join"}, {db, nowMs: NOW});
  /** This real observation validates the first playable response. */
  const active = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "canonical-start-poll"}, {db, nowMs: NOW+6000});
  expect(b.phase).toBe("countdown"); expect(active.phase).toBe("racing");
  /** The committed ticket identifies its canonical match rather than relying on an inferred queue ID. */
  const ticket = (await db.doc(`liveRaceTickets/${a.ticketId}`).get()).data()!;
  /** Both private frozen decks must retain the exact authored answer. */
  const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data() as LiveMatch;
  for (const run of match.runs) {
    expect(run.riddles).toHaveLength(15);
    expect(run.riddles.find(riddle => riddle.riddleId === "answer-history-0")?.answer).toBe(answer);
    for (let currentPosition = 0; currentPosition < run.riddles.length; currentPosition++)
      expect(RaceRunViewSchema.safeParse(toRaceRunView({...run, currentPosition, evaluationPolicy: "preloaded"}, NOW+6000, true)).success).toBe(true);
  }
  /** Real guessing uses the original current answer and retains canonical advancement on duplicate delivery. */
  const command = {ticketId: a.ticketId, riddleId: active.run!.currentRiddle!.riddleId, guess: match.runs[0].riddles[0]!.answer,
    action: "guess" as const, requestId: "canonical-first-answer"};
  expect((await updateLiveRaceForUser(A, command, {db, nowMs: NOW+7000})).run?.correctCount).toBe(1);
  expect((await updateLiveRaceForUser(A, command, {db, nowMs: NOW+8000})).run?.correctCount).toBe(1);
  expect((await db.doc(`users/${A}`).get()).data()?.coins).toBe(550);
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(550);
});
