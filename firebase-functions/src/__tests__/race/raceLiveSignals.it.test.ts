import {readFileSync} from "node:fs";
import {join} from "node:path";
import {initializeTestEnvironment, assertFails, type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, getDocs, collection, setDoc} from "firebase/firestore";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/live/raceLiveService";
import {streamLiveRaceChanges} from "../../race/live/raceLiveStream";
import {removeLiveRaceIdentitySnapshots} from "../../profile/accountDeletion/liveRaceAccountDeletion";

/** Dedicated demo project prevents these fixtures from reaching a live database. */
const PROJECT = "demo-riddle-quest-push", A = `facebook_${"a".repeat(40)}`, B = `facebook_${"b".repeat(40)}`;
/** Provides environment behavior. */
let environment: RulesTestEnvironment, db: FirebaseFirestore.Firestore;
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
  environment = await initializeTestEnvironment({projectId: PROJECT,
    firestore: {rules: readFileSync(join(__dirname, "../../../firestore.rules"), "utf8")}});
});
beforeEach(async () => {
  await environment.clearFirestore();
  /** Provides batch behavior. */
  const batch = db.batch();
  for (const user of [A, B]) batch.set(db.doc(`users/${user}`), {username: user === A ? "Alice" : "Bob", coins: 100});
  for (let i = 0; i < 30; i++) batch.set(db.doc(`localizedRiddles/en/riddles/history-${i}`), {
    riddleId: `history-${i}`, canonicalRiddleId: `history:${i}`, categoryId: "history", text: `Historical clue ${i} follows a distinct trail`,
    answer: `a${String(i).padStart(6, "0")}`, difficultyBand: ["easy", "medium", "hard"][i % 3], raceEligible: true, qualityVersion: "human_review_v1",
  });
  await batch.commit();
});
afterAll(async () => {await environment?.cleanup(); await db.terminate();});
/** Creates public seats using real transactional matchmaking. */
async function pair() {
  /** Provides now ms behavior. */
  const nowMs = Date.now();
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "push-alice-join"}, {db, nowMs});
  /** Provides b behavior. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "push-bob-join"}, {db, nowMs});
  return {a, b, nowMs};
}

it("keeps revisions, match contents, enumeration and writes server-only", async () => {
  /** Provides {a, b} behavior. */
  const {a, b} = await pair();
  /** Provides client behavior. */
  const client = environment.authenticatedContext(A).firestore(), own = doc(client, `liveRaceSignals/${a.ticketId}`);
  expect(Object.keys((await db.doc(own.path).get()).data()!).sort()).toEqual(["expiresAt", "revision"]);
  await assertFails(getDoc(own));
  await assertFails(getDoc(doc(client, `liveRaceSignals/${b.ticketId}`)));
  await assertFails(getDocs(collection(client, "liveRaceSignals")));
  await assertFails(setDoc(own, {revision: "forged"}));
  /** Account stream-admission document that browser security rules must keep private. */
  const admission = doc(client, `users/${A}/liveRaceStreamAdmissions/current`);
  await assertFails(getDoc(admission));
  await assertFails(setDoc(admission, {leases: []}));
  await assertFails(getDoc(doc(client, `liveRaceMatches/${a.ticketId}`)));
  await assertFails(getDoc(doc(client, `liveRaceTickets/${a.ticketId}`)));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), own.path)));
  await db.doc(own.path).update({expiresAt: Timestamp.fromMillis(Date.now() - 1000)});
  await assertFails(getDoc(own));
});

it("denies direct browser access for deleted, missing and provider profiles", async () => {
  /** Provides {a} behavior. */
  const {a} = await pair(), client = environment.authenticatedContext(A).firestore();
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({status: "deleting"});
  await assertFails(getDoc(doc(client, `liveRaceSignals/${a.ticketId}`)));
  await db.doc(`jestAccountDeletionTombstones/${A}`).delete(); await db.doc(`users/${A}`).delete();
  await assertFails(getDoc(doc(client, `liveRaceSignals/${a.ticketId}`)));
  for (const provider of ["facebook", "reddit"]) {
    /** Provides uid behavior. */
    const uid = `${provider}_${"c".repeat(40)}`, id = provider === "facebook" ? "c".repeat(64) : "d".repeat(64);
    await db.doc(`users/${uid}`).set({coins: 100}); await db.doc(`liveRaceTickets/${id}`).set({userId: uid});
    await db.doc(`liveRaceSignals/${id}`).set({revision: "opaque", expiresAt: Timestamp.fromMillis(Date.now() + 60000)});
    /** Provides read behavior. */
    const read = getDoc(doc(environment.authenticatedContext(uid).firestore(), `liveRaceSignals/${id}`));
    await assertFails(read);
  }
});

it("pushes a committed opponent action, without rewriting signals for unchanged polls or duplicate commands", async () => {
  /** Provides {a, b, now ms} behavior. */
  const {a, b, nowMs} = await pair();
  await updateLiveRaceForUser(A, {ticketId: a.ticketId, action: "poll", requestId: "push-start-poll"}, {db, nowMs: nowMs + 6000});
  /** Provides before behavior. */
  const before = (await db.doc(`liveRaceSignals/${b.ticketId}`).get()).data()!.revision;
  /** Provides controller behavior. */
  const controller = new AbortController();
  /** Provides initial behavior. */
  let initial!: () => void, delivered!: (value: string) => void;
  /** Provides ready behavior. */
  const ready = new Promise<void>(resolve => {initial = resolve;});
  /** Provides changed behavior. */
  const changed = new Promise<string>(resolve => {delivered = resolve;});
  /** Provides streaming behavior. */
  const streaming = streamLiveRaceChanges(db, B, b.ticketId, {signal: controller.signal, sendChunk: async chunk => {
    initial(); if (chunk.revision && chunk.revision !== before) delivered(chunk.revision); return true;
  }}, 5000);
  await ready;
  /** Provides match behavior. */
  const match = (await db.doc(`liveRaceMatches/${a.ticketId}`).get()).data()!;
  /** Provides command behavior. */
  const command = {ticketId: a.ticketId, action: "guess" as const, requestId: "push-first-answer", guess: match.runs[0].riddles[0].answer, riddleId: match.runs[0].riddles[0].riddleId};
  try {
    await updateLiveRaceForUser(A, command, {db, nowMs: nowMs + 7000});
    expect(await changed).not.toBe(before);
    /** Provides ref behavior. */
    const ref = db.doc(`liveRaceSignals/${b.ticketId}`), committed = await ref.get();
    expect((await updateLiveRaceForUser(B, {ticketId: b.ticketId, action: "poll", requestId: "push-rival-poll"}, {db, nowMs: nowMs + 8000})).opponent?.correctCount).toBe(1);
    await updateLiveRaceForUser(A, command, {db, nowMs: nowMs + 9000});
    expect((await ref.get()).updateTime!.isEqual(committed.updateTime!)).toBe(true);
  } finally {controller.abort(); await streaming;}
});

it("wakes private creators on acceptance and removes deleted owners' signals while notifying survivors", async () => {
  /** Provides now ms behavior. */
  const nowMs = Date.now();
  /** Provides a behavior. */
  const a = await joinLiveRaceForUser(A, {locale: "en", categoryId: "history", requestId: "push-private-lobby", createChallenge: true}, {db, nowMs});
  /** Provides initial behavior. */
  const initial = (await db.doc(`liveRaceSignals/${a.ticketId}`).get()).data()!.revision;
  /** Provides b behavior. */
  const b = await joinLiveRaceForUser(B, {locale: "en", categoryId: "history", requestId: "push-private-accept", challengeId: a.challengeId}, {db, nowMs});
  expect((await db.doc(`liveRaceSignals/${a.ticketId}`).get()).data()!.revision).not.toBe(initial);
  /** Provides previous behavior. */
  const previous = (await db.doc(`liveRaceSignals/${b.ticketId}`).get()).data()!.revision;
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({status: "deleting"});
  await removeLiveRaceIdentitySnapshots(A);
  expect((await db.doc(`liveRaceSignals/${a.ticketId}`).get()).exists).toBe(false);
  expect((await db.doc(`liveRaceSignals/${b.ticketId}`).get()).data()!.revision).not.toBe(previous);
});

it("rejects unowned and deleted subscriptions and releases an active stream immediately on deletion", async () => {
  /** Provides {a} behavior. */
  const {a} = await pair(), controller = new AbortController(), sendChunk = jest.fn(async () => true);
  await expect(streamLiveRaceChanges(db, B, a.ticketId, {signal: controller.signal, sendChunk})).rejects.toMatchObject({code: "permission-denied"});
  /** Provides ready behavior. */
  let ready!: () => void;
  /** Provides initial behavior. */
  const initial = new Promise<void>(resolve => {ready = resolve;});
  /** Provides stream behavior. */
  const stream = streamLiveRaceChanges(db, A, a.ticketId, {signal: controller.signal, sendChunk: async () => {ready(); return true;}}, 5000);
  await initial;
  await db.doc(`jestAccountDeletionTombstones/${A}`).set({status: "deleting"});
  await stream;
  await expect(streamLiveRaceChanges(db, A, a.ticketId, {signal: controller.signal, sendChunk})).rejects.toThrow("account-deleted");
});

it.each(["missing", "malformed", "expired"])("rejects %s ticket retention before subscribing", async kind => {
  /** Actual production matchmaking provides otherwise valid ownership and retention. */
  const {a} = await pair(), ref = db.doc(`liveRaceTickets/${a.ticketId}`);
  await ref.update({expiresAt: kind === "missing" ? FieldValue.delete() : kind === "malformed" ? {unexpected: true} : Timestamp.fromMillis(Date.now() - 1000)});
  /** Rejection must not publish a stream or mutate the owned private record. */
  const before = await ref.get(), sendChunk = jest.fn(async () => true), controller = new AbortController();
  try {
    await expect(streamLiveRaceChanges(db, A, a.ticketId, {signal: controller.signal, sendChunk}, 100)).rejects.toMatchObject({code: "not-found"});
    expect(sendChunk).not.toHaveBeenCalled();
    expect((await ref.get()).updateTime!.isEqual(before.updateTime!)).toBe(true);
  } finally {controller.abort();}
});

it.each(["missing", "malformed", "scalar", "expired"])("falls back for %s signal retention and accepts a later healthy revision", async kind => {
  /** A genuine owned ticket isolates the asynchronous signal projection boundary. */
  const {a} = await pair(), ref = db.doc(`liveRaceSignals/${a.ticketId}`), controller = new AbortController();
  await ref.update({expiresAt: kind === "missing" ? FieldValue.delete() : kind === "malformed" ? {unexpected: true} : kind === "scalar" ? 123 : Timestamp.fromMillis(Date.now() - 1000)});
  /** Invalid notifications must remain read-only and preserve the original record. */
  const before = await ref.get(), chunks: Array<{
    /** Safe polling fallback or an opaque server wake-up token. */
    revision: string | null;
  }> = [];
  /** Both initial fallback and subsequent healthy delivery release bounded stream assertions. */
  let ready!: () => void, recovered!: () => void;
  /** First snapshot should select the existing polling fallback. */
  const initial = new Promise<void>(resolve => {ready = resolve;});
  /** A later repaired server record must still wake the surviving listener. */
  const healthy = new Promise<void>(resolve => {recovered = resolve;});
  /** Normal abort owns all real SDK listeners even when an assertion fails. */
  const stream = streamLiveRaceChanges(db, A, a.ticketId, {signal: controller.signal, sendChunk: async chunk => {
    chunks.push(chunk); ready(); if (chunk.revision === "11111111-1111-1111-1111-111111111111") recovered(); return true;
  }}, 5000);
  try {
    await initial;
    expect(chunks).toEqual([{revision: null}]);
    expect((await ref.get()).updateTime!.isEqual(before.updateTime!)).toBe(true);
    await ref.update({revision: "11111111-1111-1111-1111-111111111111", expiresAt: Timestamp.fromMillis(Date.now() + 60000)});
    await healthy;
    expect(chunks.at(-1)).toEqual({revision: "11111111-1111-1111-1111-111111111111"});
  } finally {controller.abort(); await stream;}
});

it("stops advertising a cached healthy revision once its deadline expires without another snapshot", async () => {
  /** A live owned seat remains valid while only its notification deadline expires. */
  const {a} = await pair(), ref = db.doc(`liveRaceSignals/${a.ticketId}`), controller = new AbortController();
  await ref.update({revision: "22222222-2222-2222-2222-222222222222", expiresAt: Timestamp.fromMillis(Date.now() + 2000)});
  /** The actual stream must first publish the valid revision, then select fallback on its heartbeat. */
  const chunks: Array<{
    /** Opaque server revision or safe polling fallback. */
    revision: string | null;
  }> = [];
  /** Snapshot and post-expiry heartbeat release distinct assertions. */
  let first!: () => void, expired!: () => void;
  /** Valid initial delivery proves the test did not begin with already expired metadata. */
  const initial = new Promise<void>(resolve => {first = resolve;});
  /** No database write or second snapshot may be needed to detect expiration. */
  const fallback = new Promise<void>(resolve => {expired = resolve;});
  /** A bounded assertion makes the missing heartbeat fallback an ordinary test failure. */
  let deadline: ReturnType<typeof setTimeout> | undefined;
  /** Stream abort releases every actual SDK listener even when the deadline assertion fails. */
  const stream = streamLiveRaceChanges(db, A, a.ticketId, {signal: controller.signal, sendChunk: async chunk => {
    chunks.push(chunk); if (chunks.length === 1) first(); else if (chunk.revision === null) expired(); return true;
  }}, 15000);
  try {
    await initial;
    expect(chunks[0]).toEqual({revision: "22222222-2222-2222-2222-222222222222"});
    /** Exact document timestamp proves fallback did not renew or rewrite the private signal. */
    const before = await ref.get();
    await Promise.race([fallback, new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error("Expired notification stayed healthy")), 12000);
    })]);
    expect(chunks.at(-1)).toEqual({revision: null});
    expect((await ref.get()).updateTime!.isEqual(before.updateTime!)).toBe(true);
  } finally {clearTimeout(deadline); controller.abort(); await stream;}
});
