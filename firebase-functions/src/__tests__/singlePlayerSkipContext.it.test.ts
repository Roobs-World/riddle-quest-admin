import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {ensureAuthoritativeSession, skipAuthoritativeRiddle} from "../gameplay/sessions/singlePlayerSession";
import {skipRiddle} from "../gameplay/callables/gameLogic";

/** Derived preparation is observable while the callable, lease and skip transaction remain real. */
const mockSupply = jest.fn(async (_user: string, _index: number, _locale: string) => undefined);
jest.mock("../riddles/riddleSupply", () => ({triggerClassicRiddleGenerationIfNeeded: (...args: [string, number, string]) => mockSupply(...args)}));
/** Every fixture is restricted to its own canonical account in a private demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** One private identity owns all sessions, leases and economy assertions. */
const OWNER = `jest_${"e".repeat(40)}`;
/** Actual Admin SDK instance is shared by issuance, callable leases and transactions. */
let db: FirebaseFirestore.Firestore;
/** Only this fixture's account subtree and deletion lease subtree may be removed. */
const clear = async () => {await db.recursiveDelete(db.doc(`users/${OWNER}`)); await db.recursiveDelete(db.doc(`jestAccountDeletionTombstones/${OWNER}`));};
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("Private demo emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT}); db = getFirestore();
});
beforeEach(async () => {await clear(); mockSupply.mockClear();});
afterAll(clear);

/** Real issuance binds the locale, answer, entitlement and trusted expiry. */
async function issued() {
  await db.doc(`users/${OWNER}`).set({coins: 550, hasPurchasedApp: true, progress: {classicIndex: 1}, stats: {classicSkipped: 2, multiplayerWins: 9}});
  /** Real token retains the content identity and locale before any skip. */
  const sessionToken = await ensureAuthoritativeSession(OWNER, "classic", "classic-1", "fr", "classic-fr-1", "classic:1", "piano", {classicIndex: 1});
  return {sessionToken, riddleId: "classic-1", gameMode: "classic" as const, requestId: "real-skip-context"};
}
/** Actual callable boundary retains its domain validation, deletion lease and public response shaping. */
const call = (data: Awaited<ReturnType<typeof issued>>) => skipRiddle.run({auth: {uid: OWNER, token: {}}, data} as never);
/** Session identity is computed solely to inspect or mutate the server-owned fixture. */
const sessionRef = (token: string) => db.doc(`users/${OWNER}/singlePlayerSessions/${createHash("sha256").update(token).digest("hex")}`);

it("charges once across concurrent real callables and avoids a standalone session read", async () => {
  /** Each probe starts with one real issued session and untouched account. */
  const request = await issued();
  /** Observes the actual document SDK read used by the old pre-transaction locale fetch. */
  const ref = sessionRef(request.sessionToken), prototype = Object.getPrototypeOf(ref), original = prototype.get;
  /** Counts only direct session reads; transaction and lease reads remain untouched. */
  let directSessionReads = 0;
  /** Direct-read observer forwards every original SDK call. */
  const spy = jest.spyOn(prototype, "get").mockImplementation(function(this: FirebaseFirestore.DocumentReference, ...args: unknown[]) {
    if (this.path === ref.path) directSessionReads++;
    return original.apply(this, args);
  });
  try {
    /** Four callables contend on the same real account and private receipt. */
    const results = await Promise.all(Array.from({length: 4}, (_, index) => call({...request, requestId: `real-concurrent-skip-${index}`})));
    expect(results.every(result => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
    expect(directSessionReads).toBe(0);
    expect(results[0]).toMatchObject({success: true, costDeducted: 100, newCoins: 450, newProgress: {classicIndex: 2}});
    expect(results[0]).not.toHaveProperty("classicSupply");
    expect(mockSupply).toHaveBeenCalledTimes(4);
    expect(mockSupply.mock.calls.every(args => args[1] === 2 && args[2] === "fr")).toBe(true);
    /** Canonical account proves a single charge and retained unrelated fields. */
    const profile = (await db.doc(`users/${OWNER}`).get()).data();
    expect(profile).toMatchObject({coins: 450, hasPurchasedApp: true, progress: {classicIndex: 2}, stats: {classicSkipped: 3, multiplayerWins: 9}});
    expect((await ref.get()).data()?.skipResult).not.toHaveProperty("classicSupply");
  } finally {spy.mockRestore();}
});

it("keeps an old response immutable while preparing the current replay entitlement", async () => {
  /** The initial real callable establishes the public response used to verify replay. */
  const request = await issued(), first = await call(request);
  await db.doc(`users/${OWNER}`).update({"progress.classicIndex": 7});
  /** Snapshot establishes the account state that replay or rejection must preserve. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  expect(await call({...request, requestId: "real-later-replay"})).toEqual(first);
  expect(mockSupply).toHaveBeenLastCalledWith(OWNER, 7, "fr");
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
});

it("uses only the committed attempt's supply context after a real SDK abort", async () => {
  /** Actual transaction retries read this same private session reference afresh. */
  const request = await issued(), ref = sessionRef(request.sessionToken);
  /** Original SDK retries and rolls back the first queued skip writes. */
  const original = db.runTransaction.bind(db);
  /** Injection occurs at the SDK boundary after the domain callback has queued its writes. */
  let attempts = 0;
  /** Original SDK remains responsible for commit, rollback and retry. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation((operation, options) => original(async transaction => {
    attempts++;
    if (attempts === 2) {
      await db.doc(`users/${OWNER}`).update({coins: 700});
      await ref.update({locale: "de", contentKey: "classic-de-1"});
    }
    /** Actual domain callback queues the same writes on each SDK attempt. */
    const result = await operation(transaction);
    if (attempts === 1) throw Object.assign(new Error("Fixture retryable skip abort"), {code: 10});
    return result;
  }, options));
  try {
    expect(await skipAuthoritativeRiddle(OWNER, request)).toMatchObject({newCoins: 600, newProgress: {classicIndex: 2}, classicSupply: {classicIndex: 2, locale: "de"}});
    expect(attempts).toBe(2);
    expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 600, progress: {classicIndex: 2}, stats: {classicSkipped: 3}});
    expect((await ref.get()).data()?.skipResult).toMatchObject({newCoins: 600});
    expect((await ref.get()).data()?.skipResult).not.toHaveProperty("classicSupply");
  } finally {spy.mockRestore();}
});

it.each(["locale", "contentKey", "completionKey", "answer"])("rejects malformed %s without a charge or supply task", async field => {
  /** Each probe starts with one real issued session and untouched account. */
  const request = await issued(); await sessionRef(request.sessionToken).update({[field]: FieldValue.delete()});
  /** Snapshot establishes the account state that replay or rejection must preserve. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  await expect(call(request)).rejects.toMatchObject({code: "permission-denied"});
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
  expect(mockSupply).not.toHaveBeenCalled();
});

it("never recreates a removed account when an existing skip response is replayed", async () => {
  /** Each probe starts with one real issued session and untouched account. */
  const request = await issued(); await call(request); await db.doc(`users/${OWNER}`).delete(); mockSupply.mockClear();
  await expect(call(request)).rejects.toMatchObject({code: "not-found"});
  expect((await db.doc(`users/${OWNER}`).get()).exists).toBe(false);
  expect(mockSupply).not.toHaveBeenCalled();
});

it.each(["riddle", "expiry"])("retains issued %s rejection before spending", async control => {
  /** Each probe starts with one real issued session and untouched account. */
  const request = await issued();
  if (control === "expiry") await sessionRef(request.sessionToken).update({expiresAt: Timestamp.fromMillis(Date.now() - 1)});
  else request.riddleId = "wrong-riddle";
  /** Snapshot establishes the account state that replay or rejection must preserve. */
  const profile = (await db.doc(`users/${OWNER}`).get()).data();
  await expect(call(request)).rejects.toMatchObject({code: control === "expiry" ? "failed-precondition" : "permission-denied"});
  expect((await db.doc(`users/${OWNER}`).get()).data()).toEqual(profile);
  expect(mockSupply).not.toHaveBeenCalled();
});
