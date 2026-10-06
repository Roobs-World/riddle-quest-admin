import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Query} from "firebase-admin/firestore";
import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";
import {processClassicSupplyJobs} from "../riddles/classicSupplyWorker";

/** Only model generation is replaced; discovery, lease acquisition and settlement remain real SDK calls. */
const mockGenerate = jest.fn(async (_locale: string, _count: number, _deadline: number) => undefined);
jest.mock("../riddles/riddleGeneration", () => ({generateLocalizedClassicRiddlesForLocale: (...args: [string, number, number]) => mockGenerate(...args)}));
/** Synthetic private content and jobs are permitted only on this loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Real SDK queries and transactions share the same private database. */
let db: FirebaseFirestore.Firestore;
/** Stable IDs limit deletion to this fixture's content and replenishment jobs. */
const CONTENT_IDS = ["supply-payload-high", "supply-payload-low", "supply-payload-no-index", "supply-payload-negative"];
/** Fixed canonical locale/index job identifiers cover every seeded or requested job. */
const JOB_IDS = [-1, 10, 11, 12, 13, 20, 200].map(index => `tr_${index}`);
/** Destructive cleanup never scans another project's data or removes other fixture IDs. */
const clear = async () => {await Promise.all([
  ...CONTENT_IDS.flatMap(id => [db.doc(`localizedRiddles/tr/riddles/${id}`).delete(), db.doc(`localizedRiddles/vi/riddles/${id}`).delete()]),
  ...JOB_IDS.map(id => db.doc(`classicSupplyJobs/${id}`).delete()),
]);};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {await clear(); mockGenerate.mockClear();});
afterAll(clear);

it("loads only the highest index in one real supply query", async () => {
  await db.doc("localizedRiddles/tr/riddles/supply-payload-high").set({classicIndex: 12, answer: "piano", text: "x".repeat(100_000), provenance: {unused: "synthetic"}});
  await db.doc("localizedRiddles/tr/riddles/supply-payload-low").set({classicIndex: 11, answer: "organ"});
  /** Query observation forwards the actual SDK select/filter/order/limit execution. */
  const original = Query.prototype.get;
  /** Records only synthetic decoded sizes and field names, never content values. */
  let readCalls = 0, documentBytes = 0, loadedFields: string[] = [];
  /** Original SDK snapshots are returned unchanged to the actual supply service. */
  const spy = jest.spyOn(Query.prototype, "get").mockImplementation(async function(this: FirebaseFirestore.Query) {
    /** Actual emulator results establish server-side field selection. */
    const snapshot = await original.call(this);
    if (snapshot.docs.some(document => document.id === "supply-payload-high")) {
      readCalls++; documentBytes = Buffer.byteLength(JSON.stringify(snapshot.docs.map(document => document.data())));
      loadedFields = Object.keys(snapshot.docs[0]!.data()).sort();
    }
    return snapshot;
  });
  try {
    await triggerClassicRiddleGenerationIfNeeded("supply-fixture", 11, "tr");
    if (process.env.CLASSIC_SUPPLY_PAYLOAD_TRACE) console.info(JSON.stringify({mode: "catalog", readCalls, documentBytes, loadedFields}));
    expect(readCalls).toBe(1); expect(loadedFields).toEqual(["classicIndex"]); expect(documentBytes).toBeLessThan(64);
    expect((await db.doc("classicSupplyJobs/tr_12").get()).data()).toMatchObject({locale: "tr", highestClassicIndex: 12, nextAttemptAtMs: 0});
    expect(mockGenerate).not.toHaveBeenCalled();
    expect((await db.doc("localizedRiddles/tr/riddles/supply-payload-high").get()).data()?.text.length).toBe(100_000);
  } finally {spy.mockRestore();}
});

it.each([10, 11, 12])("preserves the supply threshold at current index %s", async index => {
  await db.doc("localizedRiddles/tr/riddles/supply-payload-high").set({classicIndex: 12});
  await triggerClassicRiddleGenerationIfNeeded("supply-fixture", index, "tr");
  expect((await db.doc("classicSupplyJobs/tr_12").get()).exists).toBe(index >= 11);
  expect(mockGenerate).not.toHaveBeenCalled();
});

it("keeps the empty-catalog sentinel and excludes another locale or non-Classic content", async () => {
  await db.doc("localizedRiddles/vi/riddles/supply-payload-high").set({classicIndex: 200});
  await db.doc("localizedRiddles/tr/riddles/supply-payload-no-index").set({answer: "daily"});
  await db.doc("localizedRiddles/tr/riddles/supply-payload-negative").set({classicIndex: -1});
  await triggerClassicRiddleGenerationIfNeeded("supply-fixture", 1, "tr");
  expect((await db.doc("classicSupplyJobs/tr_-1").get()).data()).toMatchObject({locale: "tr", highestClassicIndex: -1, nextAttemptAtMs: 0});
  expect((await db.doc("classicSupplyJobs/tr_200").get()).exists).toBe(false);
});

it("creates one durable job across concurrent and repeated low-supply requests", async () => {
  await db.doc("localizedRiddles/tr/riddles/supply-payload-high").set({classicIndex: 12});
  await Promise.all(Array.from({length: 4}, () => triggerClassicRiddleGenerationIfNeeded("supply-fixture", 11, "tr")));
  /** Existing job fields and timestamp must remain unchanged on another create attempt. */
  const before = (await db.doc("classicSupplyJobs/tr_12").get()).data();
  await triggerClassicRiddleGenerationIfNeeded("supply-fixture", 12, "tr");
  expect((await db.doc("classicSupplyJobs/tr_12").get()).data()).toEqual(before);
  expect(mockGenerate).not.toHaveBeenCalled();
});

it("discovers only three due IDs and lets real transactions read canonical jobs", async () => {
  await Promise.all([10, 11, 12, 13].map((index, position) => db.doc(`classicSupplyJobs/tr_${index}`).set({locale: "tr", highestClassicIndex: index,
    nextAttemptAtMs: position, privateBlob: "x".repeat(100_000)})));
  await db.doc("classicSupplyJobs/tr_20").set({locale: "tr", highestClassicIndex: 20, nextAttemptAtMs: Date.now() + 600000});
  /** Original query applies due filtering, ordering, limiting and document-ID selection. */
  const original = Query.prototype.get;
  /** Decoded discovery result size excludes subsequent canonical transaction reads. */
  let readCalls = 0, documentBytes = 0, loadedFields: string[] = [];
  /** Actual SDK document IDs remain available even when the selected field set is empty. */
  const spy = jest.spyOn(Query.prototype, "get").mockImplementation(async function(this: FirebaseFirestore.Query) {
    /** Canonical due-query snapshot is observed without replacing data or metadata. */
    const snapshot = await original.call(this);
    if (snapshot.docs.some(document => document.ref.path.startsWith("classicSupplyJobs/"))) {
      readCalls++; documentBytes = Buffer.byteLength(JSON.stringify(snapshot.docs.map(document => document.data())));
      loadedFields = Object.keys(snapshot.docs[0]!.data()).sort();
      expect(snapshot.docs.map(document => document.id)).toEqual(["tr_10", "tr_11", "tr_12"]);
    }
    return snapshot;
  });
  try {
    await processClassicSupplyJobs();
    if (process.env.CLASSIC_SUPPLY_PAYLOAD_TRACE) console.info(JSON.stringify({mode: "discovery", readCalls, documentBytes, loadedFields}));
    expect(readCalls).toBe(1); expect(loadedFields).toEqual([]); expect(documentBytes).toBe(10);
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(mockGenerate.mock.calls.every(args => args[0] === "tr" && args[1] === 5 && args[2] > Date.now())).toBe(true);
    for (const index of [10, 11, 12]) expect((await db.doc(`classicSupplyJobs/tr_${index}`).get()).data()).toMatchObject({completed: true, privateBlob: "x".repeat(100_000)});
    expect((await db.doc("classicSupplyJobs/tr_13").get()).data()).not.toHaveProperty("completed");
    expect((await db.doc("classicSupplyJobs/tr_20").get()).data()).not.toHaveProperty("completed");
  } finally {spy.mockRestore();}
});

it("rechecks due eligibility after discovery when another worker acquires the job", async () => {
  await db.doc("classicSupplyJobs/tr_12").set({locale: "tr", highestClassicIndex: 12, nextAttemptAtMs: 0});
  /** Updates canonical authority after the real discovery snapshot but before the claim transaction. */
  const original = Query.prototype.get;
  /** Original SDK discovery remains genuine; only a competing fixture lease write is injected. */
  const spy = jest.spyOn(Query.prototype, "get").mockImplementation(async function(this: FirebaseFirestore.Query) {
    /** This result is already stale when the caller begins its real claim transaction. */
    const snapshot = await original.call(this);
    if (snapshot.docs.some(document => document.ref.path === "classicSupplyJobs/tr_12"))
      await db.doc("classicSupplyJobs/tr_12").update({leaseId: "other-worker", nextAttemptAtMs: Date.now() + 600000});
    return snapshot;
  });
  try {
    await processClassicSupplyJobs();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect((await db.doc("classicSupplyJobs/tr_12").get()).data()).toMatchObject({leaseId: "other-worker"});
    expect((await db.doc("classicSupplyJobs/tr_12").get()).data()).not.toHaveProperty("completed");
  } finally {spy.mockRestore();}
});
