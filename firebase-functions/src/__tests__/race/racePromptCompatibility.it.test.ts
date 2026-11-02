import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {RaceRunViewSchema} from "@riddle-quest/core/race";
import {buildDeterministicRaceDeck, loadEligibleContent, listRaceCategoriesForLocale} from "../../race/raceSetupService";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {toRaceRunView} from "../../race/raceEngine";
import type {LiveMatch} from "../../race/raceLiveState";

/** Every fixture mutation is confined to a dedicated private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "", A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`, NOW = 1_800_000_000_000;
/** Actual SDK queries and transaction commits exercise the catalog-to-match boundary. */
let db: FirebaseFirestore.Firestore;
/** Authored pools make an unaffected category and both competitive difficulty bands available. */
const data = (category: "history" | "music", index: number) => ({riddleId: `prompt-${category}-${index}`, canonicalRiddleId: `${category}:${index}`,
  text: `Unique ${category} question ${index} follows a separate trail`, answer: `${category === "history" ? "a" : "b"}${String(index).padStart(6, "0")}`,
  categoryId: category, difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
/** Cleanup targets only named catalog and account fixtures; private live collections belong to the demo. */
const path = (category: "history" | "music", index: number) => `localizedRiddles/en/riddles/prompt-${category}-${index}`;
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
  for (const owner of [A, B]) batch.set(db.doc(`users/${owner}`), {username: owner === A ? "Prompt Alice" : "Prompt Bob", coins: 550});
  await batch.commit();
});
afterAll(clear);

it.each(["Q".repeat(2001), " "+"Q".repeat(2001)+" ", "   ", undefined, null, 42])("hides an incompatible clue before exposing a category or deck", async text => {
  await db.doc(path("history", 0)).update({text: text === undefined ? FieldValue.delete() : text});
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["music"]);
  /** The production loader retains invalid eligible content so deck selection rejects the same category. */
  const records = await loadEligibleContent(db, "en", "history");
  expect(() => buildDeterministicRaceDeck(records, {locale: "en", categoryId: "history", seed: "incompatible-prompt"})).toThrow("missing_metadata");
});

it.each([false, true])("rejects an oversized clue before committing a live seat with private lobby %s", async createChallenge => {
  await db.doc(path("history", 0)).update({text: "Q".repeat(2001)});
  /** Real matchmaking must abort all pending writes when the pool cannot produce a public prompt. */
  const before = (await db.doc(`users/${A}`).get()).data();
  await expect(joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "oversized-live-clue", createChallenge}, {db, nowMs: NOW})).rejects.toThrow("missing_metadata");
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceQueues", "liveRaceSignals", "liveRaceMatches"]) expect((await db.collection(collection).get()).empty).toBe(true);
  expect((await db.doc(`users/${A}`).get()).data()).toEqual(before);
});

it.each([false, true])("plays boundary clues through real matchmaking and retains trimmed response semantics with padding %s", async padded => {
  /** Every clue has exactly 2000 characters after trimming and remains unique within the authored pool. */
  const batch = db.batch();
  for (let index = 0; index < 30; index++) {
    /** Padding is legal because the shared public prompt schema trims before checking its bound. */
    const text = "Q".repeat(1994)+String(index).padStart(6, "0");
    batch.update(db.doc(path("history", index)), {text: padded ? ` ${text} ` : text});
  }
  await batch.commit();
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["history", "music"]);
  /** Actual commits pair both owners and the subsequent poll crosses the shared start boundary. */
  const a = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "boundary-alice-join"}, {db, nowMs: NOW});
  /** The rival joins the first owner's committed queue seat. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "boundary-bob-join"}, {db, nowMs: NOW});
  /** This real poll validates the first playable prompt after countdown. */
  const active = await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "boundary-start-poll"}, {db, nowMs: NOW+6000});
  expect(b.phase).toBe("countdown"); expect(active.phase).toBe("racing"); expect(active.run?.currentRiddle?.text).toHaveLength(2000);
  /** Persisted immutable decks retain the original authored bytes rather than rewriting private content. */
  const ticket = (await db.doc(`liveRaceTickets/${a.ticketId}`).get()).data()!;
  /** Private match snapshots supply both frozen authoritative decks. */
  const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data() as LiveMatch;
  for (const run of match.runs) {
    expect(run.riddles).toHaveLength(15);
    expect(run.riddles.every(riddle => riddle.text.length === (padded ? 2002 : 2000))).toBe(true);
    for (let currentPosition = 0; currentPosition < run.riddles.length; currentPosition++) {
      /** The same canonical deck also satisfies the published complete-evaluation response contract. */
      const projected = RaceRunViewSchema.parse(toRaceRunView({...run, currentPosition, evaluationPolicy: "preloaded"}, NOW+6000, true));
      expect(projected.currentRiddle?.text).toHaveLength(2000);
      expect(projected.preloadedRiddles?.every(riddle => riddle.text.length === 2000)).toBe(true);
    }
  }
  expect((await db.doc(`users/${A}`).get()).data()?.coins).toBe(550);
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(550);
});
