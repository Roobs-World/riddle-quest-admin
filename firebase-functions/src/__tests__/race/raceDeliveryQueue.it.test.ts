import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {processRaceDeliveryQueue, RACE_DELIVERY_LEASE_MS} from "../../race/raceDeliveryQueue";
import {pendingRaceDelivery, raceDeliveryRetryAt, withRaceDeliveryReceipt} from "../../race/raceDeliveryFailures";
import {readRaceRecoveryHealth} from "../../race/raceRecoveryHealth";

/** Recovery tests always use a demo-project emulator. */
let db: FirebaseFirestore.Firestore;
/** Queue being exercised through its public recovery interface. */
const collection = "raceSettlementOutbox";
/** Persisted recovery checkpoint shared by overlapping workers. */
const statePath = `raceMaintenance/${collection}Recovery`;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("delivery-queue-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([collection, "racePerformanceOutbox", "raceRuns", "raceDeadlineFailures", "raceMaintenance", "raceConfig"].map(name => db.recursiveDelete(db.collection(name))));
});
afterEach(() => jest.restoreAllMocks());

it("rotates past a full failed page and its deferred retries to reach a healthy event", async () => {
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 100; index++) batch.set(db.doc(`${collection}/bad-${String(index).padStart(3, "0")}`),
    {createdAtMs: 0, ...pendingRaceDelivery(1000)});
  batch.set(db.doc(`${collection}/healthy`), {createdAtMs: 1, ...pendingRaceDelivery(1000)});
  await batch.commit();
  /** Provides deliver behavior. */
  const deliver = jest.fn(async (id: string) => withRaceDeliveryReceipt(db, db.doc(`${collection}/${id}`), 1000, async () => {
    if (id.startsWith("bad-")) throw new Error("transient-storage-failure");
    await db.doc(`${collection}/${id}`).update({delivered: true});
    return true;
  }));
  expect(await processRaceDeliveryQueue(db, collection, deliver, 1000)).toMatchObject({scanned: 100, failed: 100, sampleCapped: true});
  deliver.mockClear();
  expect(await processRaceDeliveryQueue(db, collection, deliver, 1001)).toMatchObject({delivered: 1, deferred: 99, failed: 0});
  expect(deliver.mock.calls).toEqual([["healthy"]]);
  expect((await db.doc(`${collection}/bad-000`).get()).data()?.deliveryAttempts).toBe(1);
});

it("orders equal enqueue times by ID and survives a deleted cursor and earlier insertion", async () => {
  await Promise.all(["a", "b", "c", "d"].map(id => db.doc(`${collection}/${id}`).set({createdAtMs: 0, delivered: false})));
  /** Provides deliver behavior. */
  const deliver = jest.fn(async (_id: string) => false);
  await processRaceDeliveryQueue(db, collection, deliver, 1000, 2);
  expect(deliver.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
  await db.doc(`${collection}/b`).delete();
  await db.doc(`${collection}/aa`).set({createdAtMs: 0, delivered: false});
  deliver.mockClear();
  await processRaceDeliveryQueue(db, collection, deliver, 1001, 2);
  expect(deliver.mock.calls.map(([id]) => id)).toEqual(["c", "d"]);
  deliver.mockClear();
  await processRaceDeliveryQueue(db, collection, deliver, 1002, 2);
  expect(deliver.mock.calls.map(([id]) => id)).toEqual(["a", "aa"]);
});

it("leases overlapping work and permits recovery after a worker's lease expires", async () => {
  await db.doc(`${collection}/a`).set({createdAtMs: 0, delivered: false});
  /** Provides release behavior. */
  let release!: () => void;
  /** Provides entered behavior. */
  let entered!: () => void;
  /** Provides entry behavior. */
  const entry = new Promise<void>(resolve => {entered = resolve;});
  /** Provides pause behavior. */
  const pause = new Promise<void>(resolve => {release = resolve;});
  /** Provides first behavior. */
  const first = processRaceDeliveryQueue(db, collection, async () => {entered(); await pause; return false;}, 1000);
  await entry;
  expect(await processRaceDeliveryQueue(db, collection, async () => true, 1001)).toMatchObject({status: "leased", scanned: 0});
  /** Provides recovered behavior. */
  const recovered = await processRaceDeliveryQueue(db, collection, async () => true, 1000 + RACE_DELIVERY_LEASE_MS);
  expect(recovered.status).toBe("processed");
  release();
  expect((await first).status).toBe("superseded");
  expect((await db.doc(statePath).get()).data()?.lastCompletedAtMs).toBe(1000 + RACE_DELIVERY_LEASE_MS);
});

it("preserves the cursor and releases its lease when retrieval fails", async () => {
  await db.doc(statePath).set({cursor: {createdAtMs: 0, id: "previous"}});
  jest.spyOn(db, "collection").mockImplementationOnce(() => {throw new Error("query-unavailable");});
  await expect(processRaceDeliveryQueue(db, collection, async () => true, 1000)).rejects.toThrow("query-unavailable");
  jest.restoreAllMocks();
  expect((await db.doc(statePath).get()).data()).toMatchObject({cursor: {createdAtMs: 0, id: "previous"}, leaseUntilMs: 0});
  expect(await processRaceDeliveryQueue(db, collection, async () => true, 1001)).toMatchObject({status: "processed", scanned: 0});
});

it("isolates synchronous adapter errors and resets a malformed historical cursor", async () => {
  await db.doc(statePath).set({cursor: {createdAtMs: -1, id: "bad/path"}, leaseUntilMs: "broken"});
  await db.doc(`${collection}/a`).set({createdAtMs: 0, delivered: false});
  expect(await processRaceDeliveryQueue(db, collection, () => {throw new Error("synchronous-failure");}, 400000))
    .toMatchObject({failed: 1, oldestPendingAgeMs: 400000, scanned: 1});
  expect((await db.doc(statePath).get()).data()?.cursor).toBeNull();
});

it.each([0, 101, 1.5])("rejects an invalid page size %s before acquiring a lease", async limit => {
  await expect(processRaceDeliveryQueue(db, collection, async () => true, 1000, limit)).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.doc(statePath).get()).exists).toBe(false);
});

it("keeps jitter deterministic and retry delays bounded", () => {
  expect(raceDeliveryRetryAt("a", 1, 1000)).toBe(raceDeliveryRetryAt("a", 1, 1000));
  expect(raceDeliveryRetryAt("a", 1, 1000)).toBeGreaterThanOrEqual(25000);
  expect(raceDeliveryRetryAt("a", 1, 1000)).toBeLessThanOrEqual(37000);
  expect(raceDeliveryRetryAt("a", 20, 1000)).toBeLessThanOrEqual(901000);
  expect(raceDeliveryRetryAt("a", 2000, 1000)).toBe(raceDeliveryRetryAt("a", 20, 1000));
});

it("reports a healthy empty system without acquiring leases or creating checkpoints", async () => {
  expect(await readRaceRecoveryHealth(db, 1000)).toMatchObject({observedAtMs: 1000, warnings: [],
    deadlines: {due: {lowerBound: 0, capped: false}, oldestWakeDelayMs: 0},
    outboxes: {raceSettlementOutbox: {pending: {lowerBound: 0, capped: false}, recoveryStale: false}}});
  expect((await db.collection("raceMaintenance").get()).empty).toBe(true);
});

it("keeps original retry age and quarantine visible when worker wake-ups are deferred", async () => {
  await db.doc("raceRuns/retry").set({status: "active", deadlineAtMs: 2000000,
    deadlineRecovery: {originalDeadlineAtMs: 0, nextAttemptAtMs: 2000000}});
  await db.doc("raceRuns/due").set({status: "scheduled", deadlineAtMs: 800000});
  await db.doc("raceRuns/completed").set({status: "completed", deadlineAtMs: 0,
    deadlineRecovery: {originalDeadlineAtMs: 0}});
  await db.doc("raceDeadlineFailures/corrupt").set({state: "quarantined"});
  await db.doc(`${collection}/pending`).set({delivered: false, createdAtMs: 0, nextAttemptAtMs: 2000000});
  await db.doc(`${collection}/corrupt`).set({delivered: true, quarantined: true});
  await db.doc("racePerformanceOutbox/pending").set({delivered: false, createdAtMs: 900000});
  await db.doc(statePath).set({lastCompletedAtMs: 1});
  /** Provides report behavior. */
  const report = await readRaceRecoveryHealth(db, 1000000);
  expect(report.deadlines).toEqual({due: {lowerBound: 1, capped: false}, oldestWakeDelayMs: 200000,
    retried: {lowerBound: 1, capped: false}, oldestOriginalDeadlineAgeInSampleMs: 1000000,
    deferredInSample: 1, quarantined: {lowerBound: 1, capped: false}});
  expect(report.outboxes.raceSettlementOutbox).toMatchObject({oldestPendingAgeMs: 1000000, recoveryStale: true,
    quarantined: {lowerBound: 1, capped: false}});
  expect(report.outboxes.racePerformanceOutbox.recoveryStale).toBe(false);
  expect(report.warnings).toEqual(["deadlines-overdue", "deadline-retry-delay", "deadlines-quarantined",
    "raceSettlementOutbox-delivery-delay", "raceSettlementOutbox-quarantined", "raceSettlementOutbox-recovery-stale"]);
  expect((await db.doc(`${collection}/pending`).get()).data()?.delivered).toBe(false);
});

it("reports projection progress, complete-cycle delay and retained unavailable observations without identities", async () => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  await db.doc("raceMaintenance/projectionReconciliation").set({lastCompletedAtMs: 3999999,
    lastCycleCompletedAtMs: 0, cycleUnavailable: 2, lastCycleUnavailable: 3,
    lastFailureCode: "unavailable", afterId: "private-cursor", leaseId: "private-worker", payload: {answer: "private-answer"}});
  /** A recent page cannot conceal an old full cycle or unavailable canonical records. */
  const report = await readRaceRecoveryHealth(db, 4000000);
  expect(report.projections).toEqual({enabled: true, lastPageAgeMs: 1, lastCycleAgeMs: 4000000,
    unavailableInCurrentCycle: 2, unavailableInLastCycle: 3, recoveryStale: false, pageFailed: true});
  expect(report.warnings).toEqual(["projections-cycle-delay", "projections-page-failed", "projections-unavailable-sources"]);
  expect(JSON.stringify(report)).not.toMatch(/private-cursor|private-worker|private-answer/);
  expect((await db.doc("raceMaintenance/projectionReconciliation").get()).data()?.afterId).toBe("private-cursor");
});

it.each([undefined, -1, "invalid", 2000000])("does not let an invalid projection clock appear healthy: %s", async lastCompletedAtMs => {
  await db.doc("raceConfig/maintenance").set({projectionReconciliationEnabled: true});
  if (lastCompletedAtMs !== undefined) await db.doc("raceMaintenance/projectionReconciliation").set({lastCompletedAtMs});
  /** Enabled maintenance lacking trustworthy progress needs investigation even without a sampled queue. */
  const report = await readRaceRecoveryHealth(db, 1000000);
  expect(report.projections).toMatchObject({lastPageAgeMs: null, lastCycleAgeMs: null, recoveryStale: true});
  expect(report.warnings).toEqual(["projections-recovery-stale", "projections-cycle-unobserved"]);
});

it("labels capped counts honestly and detects receipts missing the ordering field", async () => {
  /** Provides batch behavior. */
  const batch = db.batch();
  for (let index = 0; index < 21; index++) batch.set(db.doc(`${collection}/pending-${index}`), {delivered: false});
  await batch.commit();
  /** Provides report behavior. */
  const report = await readRaceRecoveryHealth(db, 1000000);
  expect(report.outboxes.raceSettlementOutbox).toMatchObject({pending: {lowerBound: 20, capped: true},
    invalidEnqueueTimesInSample: 21, oldestPendingAgeMs: 0});
  expect(report.warnings).toEqual(["raceSettlementOutbox-invalid-enqueue-time"]);
});

it.each([undefined, "invalid", 2000000])("does not let an invalid or missing checkpoint hide old pending work: %s", async lastCompletedAtMs => {
  await db.doc(`${collection}/pending`).set({delivered: false, createdAtMs: 0});
  if (lastCompletedAtMs !== undefined) await db.doc(statePath).set({lastCompletedAtMs});
  expect((await readRaceRecoveryHealth(db, 1000000)).outboxes.raceSettlementOutbox.recoveryStale).toBe(true);
});

it("propagates health query failure rather than reporting a healthy empty queue", async () => {
  jest.spyOn(db, "collection").mockImplementationOnce(() => {throw new Error("health-unavailable");});
  await expect(readRaceRecoveryHealth(db, 1000000)).rejects.toThrow("health-unavailable");
});


it.each([
  ["missing owner", undefined, 301000], ["cleared owner", null, 301000],
  ["invalid owner", 42, 301000], ["empty owner", "", 301000],
  ["unsafe deadline", "worker", 1e30], ["fractional deadline", "worker", 301000.5],
])("recovers pending delivery after a malformed %s lease", async (_label, leaseId, leaseUntilMs) => {
  /** Recovery cannot wait indefinitely for a lease without a usable worker identity or clock. */
  await db.doc(statePath).set({...leaseId === undefined ? {} : {leaseId}, leaseUntilMs});
  await db.doc(`${collection}/pending`).set({delivered: false, createdAtMs: 0});
  /** Actual delivery is observable without inventing an economy grant. */
  const deliver = jest.fn(async () => false);
  expect(await processRaceDeliveryQueue(db, collection, deliver, 1000)).toMatchObject({status: "processed", scanned: 1});
  expect(deliver).toHaveBeenCalledWith("pending");
  expect((await db.doc(statePath).get()).data()).toMatchObject({leaseId: null, leaseUntilMs: 0});
});


it.each([-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER])("rejects an invalid queue clock before changing a lease: %s", async nowMs => {
  /** Invalid internal/operator input cannot persist an unrecoverable lease deadline. */
  await expect(processRaceDeliveryQueue(db, collection, async () => true, nowMs)).rejects.toMatchObject({code: "invalid-argument"});
  expect((await db.doc(statePath).get()).exists).toBe(false);
});


it.each(["permanent", "transient"])("preserves a replayed receipt when an older %s delivery fails", async kind => {
  /** A delayed failure may belong to the receipt before operator repair/replay. */
  const ref = db.doc(`${collection}/replayed`);
  await ref.set(pendingRaceDelivery(1000));
  /** Only the old worker's failure is held; Firestore receipt updates remain real. */
  let reject!: (error: Error) => void;
  /** An in-flight delivery survives until after the repaired receipt is released. */
  const pending = new Promise<boolean>((_resolve, no) => {reject = no;});
  /** The original worker owns its original invocation clock. */
  const old = withRaceDeliveryReceipt(db, ref, 1000, () => pending);
  await ref.update({...pendingRaceDelivery(2000), replayedAtMs: 2000});
  /** Snapshot of the repair/replay revision, not a copied economy grant. */
  const replayed = (await ref.get()).data();
  reject(kind === "permanent" ? Object.assign(new Error("corrupt old source"), {name: "ZodError"}) : new Error("old infrastructure failure"));
  if (kind === "permanent") expect(await old).toBe(false);
  else await expect(old).rejects.toThrow("old infrastructure failure");
  expect((await ref.get()).data()).toEqual(replayed);
  /** A current failure at the replay clock must still quarantine genuine corruption. */
  await withRaceDeliveryReceipt(db, ref, 2000, async () => {throw Object.assign(new Error("still corrupt"), {name: "ZodError"});});
  expect((await ref.get()).data()).toMatchObject({delivered: true, deliveryState: "quarantined", quarantinedAtMs: 2000});
});


it.each([[900, "permanent"], [1000, "permanent"], [900, "transient"], [1000, "transient"]] as const)(
  "keeps a replacement replay identity with clock %s and %s failure", async (replayAtMs, kind) => {
  /** One old failure must not quarantine a fresh replay, even if its clock is equal or earlier. */
  const ref = db.doc(`${collection}/replay-clock`);
  await ref.set({...pendingRaceDelivery(1000), replayedAtMs: 1000, replayId: "old-replay"});
  /** Barrier ensures the failed worker really observed the prior receipt. */
  let observed!: () => void;
  /** Snapshot read has completed before operator replacement. */
  const observation = new Promise<void>(resolve => {observed = resolve;});
  /** Delayed failure of the source validation belonging to the old replay. */
  let reject!: (error: Error) => void;
  /** Independent worker promise deliberately remains unsettled during the replay. */
  const operation = new Promise<boolean>((_resolve, no) => {reject = no;});
  /** Optional observer permits this regression to execute against the prior public implementation. */
  const old = withRaceDeliveryReceipt(db, ref, 1000, async (observe?: (value: FirebaseFirestore.DocumentData | undefined) => void) => {
    observe?.((await ref.get()).data()); observed(); return operation;
  });
  await observation;
  await ref.update({...pendingRaceDelivery(replayAtMs), replayedAtMs: replayAtMs, replayId: "fresh-replay"});
  /** Current revision includes no new economy effects. */
  const fresh = (await ref.get()).data();
  reject(kind === "permanent" ? Object.assign(new Error("old corruption"), {name: "ZodError"}) : new Error("old infrastructure failure"));
  if (kind === "permanent") expect(await old).toBe(false);
  else await expect(old).rejects.toThrow("old infrastructure failure");
  expect((await ref.get()).data()).toEqual(fresh);
  /** A worker observing the replacement still quarantines actual current corruption. */
  await withRaceDeliveryReceipt(db, ref, 1000, async (observe?: (value: FirebaseFirestore.DocumentData | undefined) => void) => {
    observe?.((await ref.get()).data()); throw Object.assign(new Error("current corruption"), {name: "ZodError"});
  });
  expect((await ref.get()).data()).toMatchObject({deliveryState: "quarantined", replayId: "fresh-replay"});
});
