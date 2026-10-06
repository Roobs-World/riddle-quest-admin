import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {buildDeterministicRaceDeck, loadEligibleContent, listRaceCategoriesForLocale} from "../../race/raceSetupService";
import {joinLiveRaceForUser} from "../../race/raceLiveService";
import type {ExistingRaceContentRecord} from "../../race/raceContentMigration";

/** Fixture mutations are restricted to one private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Only this provider-owned account may publish live fixture seats. */
const OWNER = `jest_${"a".repeat(40)}`;
/** Real SDK implements query projection, snapshot paths and canonical commits. */
let db: FirebaseFirestore.Firestore;
/** Authored metadata supplies both category readiness and deterministic deck construction. */
const data = (category: "history" | "music", index: number) => ({riddleId: `payload-${category}-${index}`, canonicalRiddleId: `${category}:${index}`,
  text: `Unique ${category} question ${index} follows its own trail`, answer: `${category === "history" ? "a" : "b"}${String(index).padStart(6, "0")}`,
  categoryId: category, difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"});
/** Owned document paths permit bounded catalog cleanup, including the oversized-pool control. */
const path = (category: "history" | "music", index: number) => `localizedRiddles/en/riddles/payload-${category}-${index}`;
/** Fixtures include another category, another locale and an ineligible record to exercise query boundaries. */
const catalogPaths = [...Array.from({length: 31}, (_, index) => path("history", index)), ...Array.from({length: 30}, (_, index) => path("music", index)),
  "localizedRiddles/en/riddles/payload-ineligible", "localizedRiddles/fr/riddles/payload-other-locale"];
/** Live records are restricted by the demo guard, while catalog cleanup removes only named fixture documents. */
const clear = async () => {
  await Promise.all(catalogPaths.map(id => db.doc(id).delete()));
  await db.recursiveDelete(db.doc(`users/${OWNER}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${OWNER}`));
  for (const collection of ["liveRaceTickets", "liveRacePlayers", "liveRaceQueues", "liveRaceSignals", "liveRaceMatches"])
    await db.recursiveDelete(db.collection(collection));
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Every selected record contains a deliberately large unused catalog field. */
  const batch = db.batch();
  for (const category of ["history", "music"] as const) for (let index = 0; index < 30; index++)
    batch.set(db.doc(path(category, index)), {...data(category, index), privateBlob: "x".repeat(100_000)});
  batch.set(db.doc(catalogPaths[catalogPaths.length - 2]!), {...data("history", 40), raceEligible: false});
  batch.set(db.doc(catalogPaths[catalogPaths.length - 1]!), data("history", 41));
  batch.set(db.doc(`users/${OWNER}`), {username: "Catalog player", coins: 550});
  await batch.commit();
});
afterAll(clear);
/** Sorted retained fields match all current validation, deck and category consumers. */
const fields = ["answer", "canonicalRiddleId", "categoryId", "difficultyBand", "qualityVersion", "raceEligible", "riddleId", "text"];
/** Builds a real unprojected baseline without using the production loader being changed. */
const fullRecords = async (): Promise<ExistingRaceContentRecord[]> => (await db.collection("localizedRiddles/en/riddles")
  .where("raceEligible", "==", true).where("categoryId", "==", "history").get()).docs.map(document => ({locale: "en", documentPath: document.ref.path, data: document.data()}));

it.each([false, true])("loads only required content fields with category scoping %s", async scoped => {
  /** Existing Query prototype method is forwarded so masks are implemented by the SDK/emulator. */
  const prototype = Object.getPrototypeOf(db.collection("localizedRiddles/en/riddles").where("raceEligible", "==", true)), original = prototype.get;
  /** Only actual query snapshots contribute to the measured payload. */
  let calls = 0, bytes = 0;
  /** Each observed document's loaded fields are independent of the loader's record mapping. */
  const loadedFields: string[][] = [];
  /** Query options, filters, projection, path metadata and original execution remain intact. */
  const spy = jest.spyOn(prototype, "get").mockImplementation(async function(this: FirebaseFirestore.Query, ...args: unknown[]) {
    /** Actual returned SDK snapshot supplies the measurement. */
    const snapshot = await original.apply(this, args); calls++;
    bytes += Buffer.byteLength(JSON.stringify(snapshot.docs.map((document: FirebaseFirestore.QueryDocumentSnapshot) => document.data())));
    loadedFields.push(...snapshot.docs.map((document: FirebaseFirestore.QueryDocumentSnapshot) => Object.keys(document.data()).sort()));
    return snapshot;
  });
  try {
    /** Production query and real mapping preserve every eligible ID and document path. */
    const records = await loadEligibleContent(db, "en", scoped ? "history" : undefined);
    if (process.env.RACE_CONTENT_PAYLOAD_TRACE) console.info(JSON.stringify({scoped, calls, bytes, count: records.length, loadedFields}));
    expect(calls).toBe(1); expect(records).toHaveLength(scoped ? 30 : 60);
    expect(loadedFields.every(actual => JSON.stringify(actual) === JSON.stringify(fields))).toBe(true);
    expect(records.every(record => record.documentPath.startsWith("localizedRiddles/en/riddles/payload-") && record.data.raceEligible === true)).toBe(true);
    if (scoped) expect(records.every(record => record.data.categoryId === "history")).toBe(true);
  } finally {spy.mockRestore();}
});

it("preserves the exact deterministic deck and content version from the unprojected catalog", async () => {
  /** Independently loaded full records establish the expected order, answers, difficulty and content version. */
  const expected = buildDeterministicRaceDeck(await fullRecords(), {locale: "en", categoryId: "history", seed: "projection-parity"});
  expect(buildDeterministicRaceDeck(await loadEligibleContent(db, "en", "history"), {locale: "en", categoryId: "history", seed: "projection-parity"})).toEqual(expected);
  expect(expected.riddles).toHaveLength(15);
  expect(expected.riddles.filter(riddle => riddle.difficultyBand === "easy")).toHaveLength(10);
  expect(expected.riddles.filter(riddle => riddle.difficultyBand === "medium")).toHaveLength(5);
});

it("preserves category availability and locale boundaries", async () => {
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["history", "music"]);
  expect((await listRaceCategoriesForLocale("fr", db)).categories).toEqual([]);
});

it.each(["missing-quality", "duplicate-clue", "duplicate-answer", "duplicate-canonical", "clue-leak", "long-answer", "undersized", "oversized", "difficulty"] as const)(
  "keeps %s validation after projected query reads", async kind => {
  if (kind === "missing-quality") await db.doc(path("history", 0)).update({qualityVersion: FieldValue.delete()});
  if (kind === "duplicate-clue") await db.doc(path("history", 1)).update({text: data("history", 0).text});
  if (kind === "duplicate-answer") await db.doc(path("history", 1)).update({answer: data("history", 0).answer});
  if (kind === "duplicate-canonical") await db.doc(path("history", 1)).update({canonicalRiddleId: data("history", 0).canonicalRiddleId});
  if (kind === "clue-leak") await db.doc(path("history", 0)).update({text: "The literal answer is a000000 here"});
  if (kind === "long-answer") await db.doc(path("history", 0)).update({answer: "longanswer"});
  if (kind === "undersized") await db.doc(path("history", 29)).delete();
  if (kind === "oversized") await db.doc(path("history", 30)).set(data("history", 30));
  if (kind === "difficulty") {
    /** All-hard metadata remains authored but cannot yield the required easier deck. */
    const batch = db.batch(); for (let index = 0; index < 30; index++) batch.update(db.doc(path("history", index)), {difficultyBand: "hard"}); await batch.commit();
  }
  /** Invalid eligible documents must remain visible to validation rather than disappearing behind projection. */
  const records = await loadEligibleContent(db, "en", "history");
  expect(() => buildDeterministicRaceDeck(records, {locale: "en", categoryId: "history", seed: "invalid-content"})).toThrow("Race category is not ready");
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["music"]);
});

it.each([undefined, "", "   ", " padded-id ", "r".repeat(161), 42])("does not offer an unplayable category with riddle identity %s", async identity => {
  await db.doc(path("history", 0)).update({riddleId: identity === undefined ? FieldValue.delete() : identity});
  expect((await listRaceCategoriesForLocale("en", db)).categories.map(category => category.categoryId)).toEqual(["music"]);
  /** Both availability and deck construction must reject the same unusable pool. */
  const records = await loadEligibleContent(db, "en", "history");
  expect(() => buildDeterministicRaceDeck(records, {locale: "en", categoryId: "history", seed: "bad-identity"})).toThrow("missing_metadata");
});

it("creates a live seat from the projected canonical deck without changing the account", async () => {
  /** Public join consumes this same loader inside its real transaction. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  /** Published private run retains the authored answer and deterministic content version. */
  const view = await joinLiveRaceForUser(OWNER, {locale: "en", categoryId: "history", requestId: "projected-catalog-join"}, {db, nowMs: 1_800_000_000_000});
  expect(view.phase).toBe("searching");
  expect((await db.doc(`liveRaceTickets/${view.ticketId}`).get()).data()?.run.riddles).toHaveLength(15);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
});
