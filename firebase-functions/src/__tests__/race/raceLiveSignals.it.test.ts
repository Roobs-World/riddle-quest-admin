import {readFileSync} from "node:fs";
import {join} from "node:path";
import {initializeTestEnvironment, assertFails, type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, getDocs, collection, setDoc} from "firebase/firestore";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {joinLiveRaceForUser, updateLiveRaceForUser} from "../../race/raceLiveService";
import {streamLiveRaceChanges} from "../../race/raceLiveStream";
import {removeLiveRaceIdentitySnapshots} from "../../profile/accountDeletion/liveRaceAccountDeletion";

/** Dedicated demo project prevents these fixtures from reaching a live database. */
const PROJECT = "demo-riddle-quest-push", A = `jest_${"a".repeat(40)}`, B = `jest_${"b".repeat(40)}`;
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
afterAll(async () => {await environment?.cleanup();});
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
