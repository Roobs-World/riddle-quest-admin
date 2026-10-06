import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {processClassicSupplyJob} from "../riddles/classicSupplyWorker";

/** Only the generation provider is stubbed; job reads, claims, rollback and settlement remain real. */
const mockGenerate = jest.fn(async (_locale: string, _count: number, _deadline: number) => undefined);
jest.mock("../riddles/riddleGeneration", () => ({generateLocalizedClassicRiddlesForLocale: (...args: [string, number, number]) => mockGenerate(...args)}));
/** Every fixture is restricted to a loopback demo project and one private job document. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Actual SDK transactions share this private canonical job store. */
let db: FirebaseFirestore.Firestore;
/** Unique fixed identifier cannot collide with ordinary locale/index replenishment requests. */
const JOB_ID = "classic-transaction-payload-fixture";
/** Only this fixture's canonical job document is removed. */
const clear = async () => {await db.doc(`classicSupplyJobs/${JOB_ID}`).delete();};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {await clear(); mockGenerate.mockReset(); mockGenerate.mockResolvedValue(undefined);});
afterAll(clear);

/** Seeds a genuine canonical job; override fields can independently change eligibility or identity. */
const seed = async (patch: Record<string, unknown> = {}) => db.doc(`classicSupplyJobs/${JOB_ID}`).set({locale: "ar", highestClassicIndex: 20,
  completed: false, nextAttemptAtMs: 0, privateBlob: "x".repeat(100_000), ...patch});

it("loads only claim authority and lease ownership in the two real transaction reads", async () => {
  await seed();
  /** The real SDK remains responsible for transactions, reads, retries and commit. */
  const original = db.runTransaction.bind(db);
  /** Each row records decoded synthetic data without printing job contents or lease values. */
  const reads: Array<{
    /** Transaction stage associated with the observed original SDK snapshot. */
    stage: string;
    /** Size of decoded synthetic document JSON, excluding metadata and wire encoding. */
    documentBytes: number;
    /** Selected field names returned by the actual emulator. */
    loadedFields: string[];
  }> = [];
  /** Transaction boundaries distinguish the initial claim from post-generation settlement. */
  let transactions = 0;
  /** Observes snapshots below either baseline get or fixed masked getAll API. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => {
    /** Stage identity is fixed for every SDK retry of this transaction. */
    const stage = transactions++ === 0 ? "claim" : "settlement";
    return original(async transaction => {
      /** Only this private job's original SDK snapshots contribute to decoded payload evidence. */
      const observe = (snapshot: FirebaseFirestore.DocumentSnapshot) => {
        if (snapshot.ref.path === `classicSupplyJobs/${JOB_ID}`) reads.push({stage,
          documentBytes: Buffer.byteLength(JSON.stringify(snapshot.data())), loadedFields: Object.keys(snapshot.data()!).sort()});
      };
      /** Restored after each attempt so wrappers cannot accumulate during actual SDK retries. */
      const get = transaction.get.bind(transaction), getAll = transaction.getAll.bind(transaction);
      transaction.get = async (...args: Parameters<typeof get>) => {
        /** Baseline document reads still execute through the original SDK. */
        const snapshot = await get(...args); observe(snapshot as FirebaseFirestore.DocumentSnapshot); return snapshot;
      };
      transaction.getAll = async (...args: Parameters<typeof getAll>) => {
        /** Firestore applies the field masks; the fixture never supplies filtered snapshots. */
        const snapshots = await getAll(...args); snapshots.forEach(observe); return snapshots;
      };
      try {return await operation(transaction);} finally {transaction.get = get; transaction.getAll = getAll;}
    }, options);
  });
  try {
    expect(await processClassicSupplyJob(JOB_ID)).toBe("generated");
    if (process.env.CLASSIC_SUPPLY_TRANSACTION_TRACE) console.info(JSON.stringify({readCalls: reads.length, transactions, reads}));
    expect(transactions).toBe(2); expect(reads).toHaveLength(2);
    expect(reads[0]).toMatchObject({stage: "claim", loadedFields: ["completed", "locale", "nextAttemptAtMs"]});
    expect(reads[1]).toMatchObject({stage: "settlement", loadedFields: ["leaseId"]});
    expect(reads.every(read => read.documentBytes < 128)).toBe(true);
    expect((await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()).toMatchObject({completed: true, nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
      privateBlob: "x".repeat(100_000), highestClassicIndex: 20});
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0]![0]).toBe("ar");
  } finally {spy.mockRestore();}
});

it("grants exactly one concurrent worker and preserves unused job fields", async () => {
  await seed();
  /** Four real claim transactions contend for the same canonical lease. */
  const results = await Promise.all(Array.from({length: 4}, () => processClassicSupplyJob(JOB_ID)));
  expect(results.filter(result => result === "generated")).toHaveLength(1);
  expect(results.filter(result => result === "skipped")).toHaveLength(3);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
  expect((await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()).toMatchObject({completed: true, privateBlob: "x".repeat(100_000)});
});

it("backs off a provider failure and permits the next eligible retry", async () => {
  await seed(); mockGenerate.mockRejectedValueOnce(new Error("Fixture generation unavailable"));
  /** Actual wall-clock range bounds the five-minute backoff written after provider failure. */
  const before = Date.now();
  expect(await processClassicSupplyJob(JOB_ID)).toBe("retry");
  /** Canonical failure settlement preserves the uncompleted job and its unrelated fields. */
  const job = (await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()!;
  expect(job.nextAttemptAtMs).toBeGreaterThanOrEqual(before + 300000);
  expect(job.nextAttemptAtMs).toBeLessThanOrEqual(Date.now() + 300000);
  expect(job).toMatchObject({completed: false, privateBlob: "x".repeat(100_000)});
  expect(await processClassicSupplyJob(JOB_ID)).toBe("skipped");
  await db.doc(`classicSupplyJobs/${JOB_ID}`).update({nextAttemptAtMs: 0});
  expect(await processClassicSupplyJob(JOB_ID)).toBe("generated");
  expect(mockGenerate).toHaveBeenCalledTimes(2);
});

it.each(["future", "completed", "missing"])("retains %s job exclusion under a mask", async control => {
  if (control !== "missing") await seed(control === "future" ? {nextAttemptAtMs: Date.now() + 600000} : {completed: true});
  /** Exact canonical data must survive an ineligible claim without a lease write. */
  const before = (await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data();
  expect(await processClassicSupplyJob(JOB_ID)).toBe("skipped");
  expect(mockGenerate).not.toHaveBeenCalled();
  expect((await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()).toEqual(before);
});

it("does not mistake a fieldless existing job for a missing document", async () => {
  await db.doc(`classicSupplyJobs/${JOB_ID}`).set({privateBlob: "synthetic"});
  await expect(processClassicSupplyJob(JOB_ID)).rejects.toThrow("Invalid Classic supply job locale.");
  expect(mockGenerate).not.toHaveBeenCalled();
  expect((await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()).toEqual({privateBlob: "synthetic"});
});

it.each(["superseded", "removed"])("never settles a %s job after generation", async control => {
  await seed();
  mockGenerate.mockImplementationOnce(async () => {
    if (control === "removed") await db.doc(`classicSupplyJobs/${JOB_ID}`).delete();
    else await db.doc(`classicSupplyJobs/${JOB_ID}`).update({leaseId: "new-owner", nextAttemptAtMs: Date.now() + 600000});
  });
  expect(await processClassicSupplyJob(JOB_ID)).toBe("generated");
  /** Settlement's fresh lease read cannot publish under a newer owner or recreate a missing job. */
  const snapshot = await db.doc(`classicSupplyJobs/${JOB_ID}`).get();
  if (control === "removed") expect(snapshot.exists).toBe(false);
  else expect(snapshot.data()).toMatchObject({completed: false, leaseId: "new-owner"});
});

it("reads fresh claim authority after an actual SDK abort", async () => {
  await seed();
  /** Original SDK handles rollback/retry after the fixture injects a retryable abort. */
  const original = db.runTransaction.bind(db);
  /** The first claim queues a lease before being discarded; only its retry may determine generation inputs. */
  let attempts = 0;
  /** Injects the abort at the SDK boundary without replacing any domain reads or writes. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    attempts++;
    if (attempts === 2) await db.doc(`classicSupplyJobs/${JOB_ID}`).update({locale: "de"});
    /** Actual claim/settlement callback executes on every original SDK attempt. */
    const result = await operation(transaction);
    if (attempts === 1) throw Object.assign(new Error("Fixture retryable claim abort"), {code: 10});
    return result;
  }, options));
  try {
    expect(await processClassicSupplyJob(JOB_ID)).toBe("generated");
    expect(attempts).toBe(3); // Two claim attempts, then one settlement attempt.
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0]![0]).toBe("de");
    expect((await db.doc(`classicSupplyJobs/${JOB_ID}`).get()).data()).toMatchObject({locale: "de", completed: true});
  } finally {spy.mockRestore();}
});
