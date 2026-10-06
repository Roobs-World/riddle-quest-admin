import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {joinLiveRaceForUser} from "../../race/raceLiveService";
import {getLiveRaceChallengeForUser} from "../../race/raceLiveInvitation";
import {getJestAccountDeletionRef} from "../../jest/jestAccountDeletion";

/** Destructive fixtures may run only in a private loopback demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** Provider-owned accounts isolate profile identity from external SDK calls. */
const A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`;
/** A deterministic server clock retains original lobby and countdown behavior. */
const NOW = 1_800_000_000_000;
/** Real Admin SDK executes all profile, ticket, queue and invitation reads and writes. */
let db: FirebaseFirestore.Firestore;
/** Bounded catalog fixtures are recorded so only their own documents are removed. */
const catalogPaths = Array.from({length: 30}, (_, index) => `localizedRiddles/en/riddles/join-payload-${index}`);
/** Own live state may be removed only under the private demo guard above. */
const clear = async () => {
  for (const path of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "liveRaceSignals"])
    await db.recursiveDelete(db.collection(path));
  await Promise.all([A, B].flatMap(uid => [db.recursiveDelete(db.doc(`users/${uid}`)), getJestAccountDeletionRef(db, uid).delete()]));
  await Promise.all(catalogPaths.map(path => db.doc(path).delete()));
};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {
  await clear();
  /** Canonical authored pool is read through the real race-content query. */
  const batch = db.batch();
  catalogPaths.forEach((path, index) => batch.set(db.doc(path), {riddleId: `join-payload-${index}`, canonicalRiddleId: `history:${index}`, categoryId: "history",
    text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
    difficultyBand: (["easy", "medium", "hard"] as const)[index % 3], raceEligible: true, qualityVersion: "human_review_v1"}));
  [A, B].forEach((uid, index) => batch.set(db.doc(`users/${uid}`), {username: index ? "Bob" : "Alice", level: 8,
    avatarUrl: "https://example.invalid/avatar.png", coins: 550, privateBlob: "x".repeat(100_000)}));
  await batch.commit();
});
afterAll(clear);
/** New joins and reconnects share the original server entry point. */
const join = (uid = A, requestId = "payload-public-join", createChallenge = false, challengeId?: string) => joinLiveRaceForUser(uid,
  {locale: "en", categoryId: "history", requestId, ...(createChallenge ? {createChallenge} : {}), ...(challengeId ? {challengeId} : {})}, {db, nowMs: NOW});
/** A reserved invitation is issued by the same canonical join transaction as production. */
const reserve = () => join(A, "payload-private-join", true);
/** Actual returned profile snapshots provide a decoded payload measure rather than synthetic SDK results. */
type ProfileRead = {
  /** Canonical document path identifies creator or viewer read duplication. */ path: string;
  /** Decoded JSON bytes exclude wire encoding and metadata. */ bytes: number;
  /** Actual loaded fields show whether unused account data crossed the SDK boundary. */ fields: string[];
};
/** Forwards both original SDK read methods, including their field-mask options. */
async function observed<T>(operation: () => Promise<T>) {
  /** Payload records only canonical account documents, excluding their gameplay subcollections. */
  const reads: ProfileRead[] = [];
  /** Actual SDK callback owns locks, snapshots, retries and commits. */
  const original = db.runTransaction.bind(db);
  /** Reads preserve SDK existence metadata and data access without fabricating any snapshots. */
  const record = (snapshot: FirebaseFirestore.DocumentSnapshot) => {
    if (/^users\/[^/]+$/.test(snapshot.ref.path)) reads.push({path: snapshot.ref.path,
      bytes: Buffer.byteLength(JSON.stringify(snapshot.data() ?? null)), fields: Object.keys(snapshot.data() ?? {}).sort()});
  };
  /** Every production transaction method remains forwarded to its real SDK implementation. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((callback, options) => original(async transaction => {
    /** Restore per-attempt wrappers before the SDK reuses a transaction object. */
    const get = transaction.get.bind(transaction), getAll = transaction.getAll.bind(transaction);
    transaction.get = async (...args: Parameters<typeof get>) => {
      /** These live-join callbacks read only document references inside the transaction. */
      const snapshot = await get(...args); record(snapshot as FirebaseFirestore.DocumentSnapshot); return snapshot;
    };
    transaction.getAll = async (...args: Parameters<typeof getAll>) => {
      /** Original SDK applies masks and preserves existence independently of selected fields. */
      const snapshots = await getAll(...args); snapshots.forEach(record); return snapshots;
    };
    try {return await callback(transaction);} finally {transaction.get = get; transaction.getAll = getAll;}
  }, options));
  try {return {result: await operation(), reads};} finally {spy.mockRestore();}
}
/** Only identity fields should be loaded, and fixture account economy/storage must stay unchanged. */
function expectIdentityOnly(reads: ProfileRead[]) {
  for (const read of reads) expect(read.fields).toEqual(["avatarUrl", "level", "username"]);
}

it.each(["public", "private", "reconnect"] as const)("loads only public identity for a %s join", async kind => {
  if (kind === "reconnect") await join();
  /** Account must remain unchanged while a seat is created or recovered. */
  const before = (await db.doc(`users/${A}`).get()).data();
  /** The read observer forwards real snapshots and emits the matching baseline/fixed payload. */
  const {result, reads} = await observed(() => join(A, "payload-public-join", kind === "private"));
  if (process.env.LIVE_JOIN_PROFILE_TRACE) console.info(JSON.stringify({kind, reads}));
  expectIdentityOnly(reads); expect(reads).toHaveLength(1);
  expect(result.player).toMatchObject({displayName: "Alice", level: 8, avatarUrl: "https://example.invalid/avatar.png"});
  expect((await db.doc(`users/${A}`).get()).data()).toEqual(before);
});

it.each(["preview", "accept", "accepted-recovery"] as const)("loads bounded creator/viewer identity for invitation %s", async kind => {
  /** Genuine reserved creator state includes the original immutable catalog and retention deadline. */
  const lobby = await reserve();
  if (kind === "accepted-recovery") await join(B, "payload-accept", false, lobby.challengeId);
  /** Only the final observed preview/acceptance contributes to profile read counts. */
  const {result, reads} = await observed(() => kind === "preview"
    ? getLiveRaceChallengeForUser(B, lobby.challengeId!, {db, nowMs: NOW}) : join(B, "payload-accept", false, lobby.challengeId));
  if (process.env.LIVE_JOIN_PROFILE_TRACE) console.info(JSON.stringify({kind, reads}));
  expectIdentityOnly(reads); expect(reads).toHaveLength(2);
  expect(reads.filter(read => read.path === `users/${B}`)).toHaveLength(1);
  if ("creator" in result) expect(result.creator).toMatchObject({displayName: "Alice", level: 8});
  else expect(result).toMatchObject({phase: "countdown", player: {displayName: "Bob", level: 8}, opponent: {displayName: "Alice", level: 8}});
  expect((await db.doc(`users/${B}`).get()).data()?.coins).toBe(550);
});

it.each([false, true])("preserves an existing fieldless profile for private join %s", async privateJoin => {
  await db.doc(`users/${A}`).set({});
  expect((await join(A, "payload-fieldless", privateJoin)).player).toMatchObject({displayName: "Riddle Quest player", level: 1, avatarUrl: null});
  expect((await db.doc(`users/${A}`).get()).data()).toEqual({});
});

it.each(["join", "accept"] as const)("captures fresh identity after an actual SDK %s transaction abort", async kind => {
  /** Acceptance uses real creator state; the public join starts with no own ticket. */
  const lobby = kind === "accept" ? await reserve() : undefined, uid = kind === "accept" ? B : A;
  /** Callback abort occurs after writes are queued; actual SDK rolls them back before its second attempt. */
  const original = db.runTransaction.bind(db);
  /** One service invocation owns the two SDK attempts. */
  let attempts = 0;
  /** Second attempt reads changed canonical identity rather than caching the first profile snapshot. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((callback, options) => original(async transaction => {
    attempts++;
    if (attempts === 2) await db.doc(`users/${uid}`).update({username: "Fresh identity", level: 11, avatarUrl: "https://example.invalid/fresh.png"});
    /** Original callback still performs all safety checks and queues canonical writes. */
    const result = await callback(transaction);
    if (attempts === 1) throw Object.assign(new Error("Fixture retryable live identity abort"), {code: 10});
    return result;
  }, options));
  try {
    expect((await join(uid, "payload-retry", false, lobby?.challengeId)).player).toMatchObject({displayName: "Fresh identity", level: 11, avatarUrl: "https://example.invalid/fresh.png"});
    expect(attempts).toBe(2);
    expect((await db.collection("liveRaceTickets").get()).size).toBe(kind === "accept" ? 2 : 1);
    expect((await db.doc(`users/${uid}`).get()).data()?.coins).toBe(550);
  } finally {spy.mockRestore();}
});

it.each(["missing", "deleted"] as const)("rejects a %s account before publishing a new live seat", async kind => {
  if (kind === "missing") await db.doc(`users/${A}`).delete();
  else await getJestAccountDeletionRef(db, A).set({deletedAt: NOW});
  if (kind === "missing") await expect(join()).rejects.toMatchObject({code: "not-found"});
  else await expect(join()).rejects.toThrow("account-deleted");
  expect((await db.collection("liveRaceTickets").get()).empty).toBe(true);
  expect((await db.collection("liveRacePlayers").get()).empty).toBe(true);
});
