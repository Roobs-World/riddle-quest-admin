import {randomUUID} from "node:crypto";
import {deleteApp, initializeApp} from "firebase-admin/app";
import {DocumentReference, getFirestore, Timestamp} from "firebase-admin/firestore";
import {joinLiveRaceForUser} from "../../race/live/raceLiveService";
import {streamLiveRaceChanges} from "../../race/live/raceLiveStream";

/** Deterministic Jest account that owns every stream admission in this fixture. */
const OWNER = `jest_${"d".repeat(40)}`;
/** Isolated Firebase app, emulator database and owned ticket used by these cases. */
let app: ReturnType<typeof initializeApp>, db: FirebaseFirestore.Firestore, ticketId: string;
/** Private account ledger path used to inspect concurrent connection leases. */
const admissionPath = `users/${OWNER}/liveRaceStreamAdmissions/current`;

beforeAll(() => {
  if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
    !process.env.GCLOUD_PROJECT?.startsWith("demo-")) throw new Error("Isolated demo Firestore emulator required");
  app = initializeApp({projectId: process.env.GCLOUD_PROJECT}, "live-stream-admission-tests");
  db = getFirestore(app);
});

/** Deletes all account, race and content fixtures from the isolated emulator. */
async function clear() {
  for (const name of ["users", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "liveRaceSignals", "localizedRiddles"])
    await db.recursiveDelete(db.collection(name));
}

beforeEach(async () => {
  await clear();
  /** Atomic account and reviewed content fixture batch for a real production join. */
  const batch = db.batch();
  batch.set(db.doc(`users/${OWNER}`), {username: "Stream owner", coins: 100});
  for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${index}`), {
    riddleId: `history-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  await batch.commit();
  ticketId = (await joinLiveRaceForUser(OWNER, {locale: "en", categoryId: "history", requestId: "stream-admission-seat", waitForPlayer: true},
    {db, nowMs: Date.now()})).ticketId;
});

afterAll(async () => {await clear(); await db.terminate(); await deleteApp(app);});

/** Starts a real owned stream and exposes readiness, completion and abort controls. */
function openStream(lifetimeMs = 5000, sendChunk: () => Promise<boolean> = async () => true) {
  /** Connection-local abort controller used to release listeners and admission. */
  const controller = new AbortController();
  /** Readiness callbacks resolved by the first chunk or rejected by early stream failure. */
  let firstChunk!: () => void, rejectInitial!: (error: unknown) => void;
  /** Promise that observes admission success or a failure before the first chunk. */
  const ready = new Promise<void>((resolve, reject) => {firstChunk = resolve; rejectInitial = reject;});
  void ready.catch(() => undefined);
  /** Actual stream lifetime promise, including final admission cleanup. */
  const completed = streamLiveRaceChanges(db, OWNER, ticketId, {signal: controller.signal, sendChunk: async () => {
    /** Transport outcome returned after the supplied chunk handler completes. */
    const sent = await sendChunk(); firstChunk(); return sent;
  }}, lifetimeMs);
  void completed.then(firstChunk, rejectInitial);
  return {controller, ready, completed};
}

it("atomically caps concurrent account streams at two and admits a replacement after abort cleanup", async () => {
  /** Original ticket and account versions used to detect unintended gameplay writes. */
  const beforeTicket = await db.doc(`liveRaceTickets/${ticketId}`).get(), beforeOwner = await db.doc(`users/${OWNER}`).get();
  /** Three competing streams used to exercise the atomic two-connection cap. */
  const streams = [openStream(), openStream(), openStream()];
  try {
    /** Settled readiness outcomes separating the admitted connections from the rejection. */
    const admissions = await Promise.allSettled(streams.map(stream => stream.ready));
    expect(admissions.filter(result => result.status === "fulfilled")).toHaveLength(2);
    /** Admission rejection expected when both account slots are already occupied. */
    const rejected = admissions.find(result => result.status === "rejected");
    expect(rejected).toMatchObject({status: "rejected", reason: {code: "resource-exhausted"}});
    expect((await db.doc(admissionPath).get()).data()?.leases).toHaveLength(2);
    /** First admitted connection selected for abort and slot release. */
    const firstActive = streams.find((_stream, index) => admissions[index].status === "fulfilled");
    if (!firstActive) throw new Error("No stream admitted");
    firstActive.controller.abort();
    await firstActive.completed;
    expect((await db.doc(admissionPath).get()).data()?.leases).toHaveLength(1);
    /** New stream admitted into the slot released by the aborted connection. */
    const replacement = openStream();
    streams.push(replacement);
    await replacement.ready;
    expect((await db.doc(admissionPath).get()).data()?.leases).toHaveLength(2);
    expect((await db.doc(`liveRaceTickets/${ticketId}`).get()).updateTime?.isEqual(beforeTicket.updateTime!)).toBe(true);
    expect((await db.doc(`users/${OWNER}`).get()).updateTime?.isEqual(beforeOwner.updateTime!)).toBe(true);
    expect((await db.collection("liveRaceMatches").get()).empty).toBe(true);
  } finally {
    streams.forEach(stream => stream.controller.abort());
    await Promise.allSettled(streams.map(stream => stream.completed));
  }
  expect((await db.doc(admissionPath).get()).exists).toBe(false);
});

it.each(["closed", "failed"])("releases a %s transport without deleting another live lease", async kind => {
  /** Existing healthy connection whose lease must survive another transport failure. */
  const survivor = openStream();
  await survivor.ready;
  /** Original surviving lease ledger retained for exact cleanup comparison. */
  const before = (await db.doc(admissionPath).get()).data()?.leases;
  /** Second connection whose send operation closes or throws as selected by the case. */
  const failing = openStream(5000, async () => {
    if (kind === "failed") throw new Error("Synthetic disconnected transport");
    return false;
  });
  try {
    if (kind === "failed") await expect(failing.completed).rejects.toThrow("Synthetic disconnected transport");
    else await failing.completed;
    expect((await db.doc(admissionPath).get()).data()?.leases).toEqual(before);
  } finally {
    survivor.controller.abort(); failing.controller.abort();
    await Promise.allSettled([survivor.completed, failing.completed, failing.ready]);
  }
  expect((await db.doc(admissionPath).get()).exists).toBe(false);
});

it("prunes an expired crashed lease and preserves the original surviving lease", async () => {
  /** Unexpired existing lease retained while a crashed expired connection is pruned. */
  const surviving = {leaseId: randomUUID(), expiresAtMs: Date.now() + 30_000};
  await db.doc(admissionPath).set({leases: [{leaseId: randomUUID(), expiresAtMs: Date.now() - 1000}, surviving]});
  /** New stream admitted alongside the surviving pre-existing lease. */
  const stream = openStream();
  try {
    await stream.ready;
    /** Current validated ledger expected to contain the survivor and new connection. */
    const leases = (await db.doc(admissionPath).get()).data()?.leases;
    expect(leases).toHaveLength(2);
    expect(leases).toContainEqual(surviving);
  } finally {stream.controller.abort(); await stream.completed;}
  expect((await db.doc(admissionPath).get()).data()?.leases).toEqual([surviving]);
});

it("keeps a replacement lease when an older stream performs delayed cleanup", async () => {
  /** Original stream whose delayed cleanup must preserve a replacement lease. */
  const stream = openStream();
  await stream.ready;
  /** Different lease identity installed before the older connection releases itself. */
  const replacement = {leaseId: randomUUID(), expiresAtMs: Date.now() + 30_000};
  try {
    await db.doc(admissionPath).set({leases: [replacement]});
  } finally {stream.controller.abort(); await stream.completed;}
  expect((await db.doc(admissionPath).get()).data()?.leases).toEqual([replacement]);
});

it("releases its admitted slot when attaching the first real SDK listener fails", async () => {
  /** One-shot SDK listener failure used to verify admission cleanup during setup. */
  const attach = jest.spyOn(DocumentReference.prototype, "onSnapshot").mockImplementationOnce(() => {
    throw new Error("Synthetic listener attachment failure");
  });
  try {
    await expect(streamLiveRaceChanges(db, OWNER, ticketId, {signal: new AbortController().signal, sendChunk: async () => true}, 5000))
      .rejects.toThrow("Synthetic listener attachment failure");
    expect((await db.doc(admissionPath).get()).exists).toBe(false);
  } finally {attach.mockRestore();}
});

it("releases admission when the owned ticket lifetime bounds the stream", async () => {
  await db.doc(`liveRaceTickets/${ticketId}`).update({expiresAt: Timestamp.fromMillis(Date.now() + 1000)});
  /** Connection whose lifetime must end at the owned ticket's earlier retention deadline. */
  const stream = openStream(5000);
  try {
    await stream.ready;
    /** Committed admission deadline read to confirm the ticket bounds stream lifetime. */
    const expiry = (await db.doc(admissionPath).get()).data()?.leases[0]?.expiresAtMs;
    expect(expiry).toBeLessThanOrEqual(Date.now() + 1000);
    await stream.completed;
    expect((await db.doc(admissionPath).get()).exists).toBe(false);
  } finally {stream.controller.abort(); await stream.completed;}
});

it("allocates no lease for an already aborted connection or malformed existing ledger", async () => {
  /** Already-aborted connection and chunk spy that must allocate no lease or sends. */
  const controller = new AbortController(), sendChunk = jest.fn(async () => true);
  controller.abort();
  await streamLiveRaceChanges(db, OWNER, ticketId, {signal: controller.signal, sendChunk});
  expect((await db.doc(admissionPath).get()).exists).toBe(false);
  await db.doc(admissionPath).set({leases: "untrusted"});
  await expect(streamLiveRaceChanges(db, OWNER, ticketId, {signal: new AbortController().signal, sendChunk}))
    .rejects.toMatchObject({code: "unavailable"});
  expect((await db.doc(admissionPath).get()).data()).toEqual({leases: "untrusted"});
  expect(sendChunk).not.toHaveBeenCalled();
});
