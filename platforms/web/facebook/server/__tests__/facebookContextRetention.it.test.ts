import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {purgeExpiredFacebookContext, purgeExpiredFacebookContextPage} from "../race/facebookContextRetention";
import {facebookContextKey, FACEBOOK_CONTEXT_BOARD_DURATION_MS, FACEBOOK_CONTEXT_HISTORY_RETENTION_MS} from "../race/facebookContextCompetition";
import {joinFacebookContextCompetition, removeUserFromFacebookContextCompetitions} from "../race/facebookContextService";

/** Isolated local-emulator storage; these tests may never access a production database. */
let db: FirebaseFirestore.Firestore;
/** Synthetic provider accounts, with no Meta identity. */
const A = `facebook_${"a".repeat(40)}`;
/** Independent synthetic member. */
const B = `facebook_${"b".repeat(40)}`;
/** Exact canonical start and expiry clocks. */
const start = 1_700_000_000_000;
/** Canonical seven-day boundary. */
const expiry = start + FACEBOOK_CONTEXT_BOARD_DURATION_MS;
/** Fixture-owned collections only. */
const collections = ["users", "facebookContextCompetitions", "facebookContextCompetitionHistory"];

beforeAll(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("facebook-context-retention-tests-require-local-emulator");
  }
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-facebook-context-retention"});
  db = getFirestore();
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(collections.map(name => db.recursiveDelete(db.collection(name))));
  await db.doc(`users/${A}`).set({coins: 300});
  await db.doc(`users/${B}`).set({coins: 300});
});
afterAll(async () => {
  jest.restoreAllMocks();
  await Promise.all(collections.map(name => db.recursiveDelete(db.collection(name))));
});

/** Creates one real context board and a score entry through synthetic server fixtures. */
async function board(id = "expired-context") {
  await joinFacebookContextCompetition({userId: A, contextId: id, contextType: "THREAD", locale: "en", nowMs: start}, db);
  /** Hash identifies only this emulator board. */
  const key = facebookContextKey(id);
  await db.doc(`facebookContextCompetitions/${key}/entries/${A}`).set({contextKey: key, userId: A,
    runId: "synthetic-run", adjustedTimeMs: 100, expiresAt: Timestamp.fromMillis(expiry)});
  return db.doc(`facebookContextCompetitions/${key}`);
}

it("dry-runs unchanged, then atomically removes expired parent and scores while retaining identity-free history", async () => {
  /** Includes one stale score outside current membership to prove full subcollection cleanup. */
  const ref = await board();
  await ref.collection("entries").doc(B).set({userId: B});
  /** Original parent must remain byte-for-byte unchanged during dry run. */
  const before = (await ref.get()).data();
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry)).resolves.toEqual({status: "ready", entries: 2, archive: true});
  expect((await ref.get()).data()).toEqual(before);
  expect((await ref.collection("entries").get()).size).toBe(2);
  expect((await db.collection("facebookContextCompetitionHistory").get()).empty).toBe(true);
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry, true)).resolves.toEqual({status: "ready", entries: 2, archive: true});
  expect((await ref.get()).exists).toBe(false);
  expect((await ref.collection("entries").get()).empty).toBe(true);
  /** History omits member/run identity and never extends expiry from the cleanup clock. */
  const history = (await db.doc(`facebookContextCompetitionHistory/${ref.id}_${start}`).get()).data();
  expect(history).toMatchObject({participantCount: 1, expiresAt: Timestamp.fromMillis(expiry + FACEBOOK_CONTEXT_HISTORY_RETENTION_MS)});
  expect(JSON.stringify(history)).not.toContain(A);
  expect(JSON.stringify(history)).not.toContain(B);
  expect(JSON.stringify(history)).not.toContain("synthetic-run");
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry + 1, true)).resolves.toEqual({status: "missing", entries: 0, archive: false});
  expect((await db.doc(`users/${A}`).get()).data()?.coins).toBe(300);
});

it("never deletes an active board or creates history after its original retention window", async () => {
  /** Cleanup eligibility includes the exact seven-day boundary. */
  const ref = await board();
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry - 1, true)).resolves.toMatchObject({status: "active"});
  expect((await ref.get()).exists).toBe(true);
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry + FACEBOOK_CONTEXT_HISTORY_RETENTION_MS, true))
    .resolves.toEqual({status: "ready", entries: 1, archive: false});
  expect((await db.collection("facebookContextCompetitionHistory").get()).empty).toBe(true);
});

it("refuses malformed scope, clocks and excessive score fan-out without partial deletion", async () => {
  /** Invalid input must stop before querying/writing the board. */
  const ref = await board();
  await expect(purgeExpiredFacebookContext(db, ref.id, Number.NaN, true)).rejects.toThrow("invalid-facebook-context-retention-clock");
  await expect(purgeExpiredFacebookContext(db, "raw-context", expiry, true)).rejects.toThrow("invalid-facebook-context-retention-key");
  await ref.update({contextKey: "c".repeat(64)});
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry, true)).rejects.toThrow("invalid-facebook-context-retention-scope");
  await ref.update({contextKey: ref.id});
  /** Fifty-one child rows exceed the canonical fifty-member write budget. */
  const batch = db.batch();
  for (let index = 0; index < 50; index++) batch.set(ref.collection("entries").doc(`extra-${index}`), {score: index});
  await batch.commit();
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry, true)).resolves.toEqual({status: "too-many-entries", entries: 0, archive: false});
  expect((await ref.get()).exists).toBe(true);
  expect((await ref.collection("entries").get()).size).toBe(51);
  expect((await db.collection("facebookContextCompetitionHistory").get()).empty).toBe(true);
});

it("bounds pages, reports invalid rows, and leaves other provider/user records unchanged", async () => {
  /** Two healthy boards prove one-row page continuation is required. */
  const first = await board("first");
  await board("second");
  await db.doc("users/other-fixture").set({coins: 900});
  await expect(purgeExpiredFacebookContextPage(db, expiry, false, 1)).resolves.toMatchObject({scanned: 1, ready: 1, complete: false});
  expect((await db.collection("facebookContextCompetitions").get()).size).toBe(2);
  await first.update({locale: "invalid-locale"});
  await expect(purgeExpiredFacebookContextPage(db, expiry, true, 20)).resolves.toMatchObject({scanned: 2, ready: 1, invalid: 1, complete: false});
  expect((await first.get()).exists).toBe(true);
  expect((await db.doc("users/other-fixture").get()).data()).toEqual({coins: 900});
  await expect(purgeExpiredFacebookContextPage(db, expiry, true, 21)).rejects.toThrow("invalid-facebook-context-retention-limit");
});

it("a board renewed after the outer query is revalidated and survives cleanup", async () => {
  /** This deterministic interleaving proves query-time eligibility is never deletion authority. */
  const ref = await board();
  /** Preserve the real transaction implementation after pausing only the first cleanup transaction. */
  const original = db.runTransaction.bind(db);
  jest.spyOn(db, "runTransaction").mockImplementationOnce(async callback => {
    await joinFacebookContextCompetition({userId: B, contextId: "expired-context", contextType: "THREAD", locale: "en", nowMs: expiry}, db);
    return original(callback);
  });
  await expect(purgeExpiredFacebookContextPage(db, expiry, true)).resolves.toMatchObject({scanned: 1, active: 1, ready: 0});
  expect((await ref.get()).data()).toMatchObject({hostUserId: B, createdAtMs: expiry, expiresAtMs: expiry + FACEBOOK_CONTEXT_BOARD_DURATION_MS});
});

it("concurrent rollover and purge converge on a live fresh board without stale scores", async () => {
  /** Real transaction retries decide the ordering; neither valid ordering deletes the replacement. */
  const ref = await board();
  await Promise.all([
    purgeExpiredFacebookContext(db, ref.id, expiry, true),
    joinFacebookContextCompetition({userId: B, contextId: "expired-context", contextType: "THREAD", locale: "en", nowMs: expiry}, db),
  ]);
  expect((await ref.get()).data()).toMatchObject({hostUserId: B, createdAtMs: expiry});
  expect((await ref.collection("entries").get()).empty).toBe(true);
});

it("account membership deletion and concurrent purges do not recreate removed records", async () => {
  /** Cleanup and account deletion both use the same parent transaction boundary. */
  const ref = await board();
  await Promise.all([
    purgeExpiredFacebookContext(db, ref.id, expiry, true),
    purgeExpiredFacebookContext(db, ref.id, expiry, true),
    removeUserFromFacebookContextCompetitions(A, db),
  ]);
  expect((await ref.get()).exists).toBe(false);
  expect((await ref.collection("entries").get()).empty).toBe(true);
  await expect(purgeExpiredFacebookContext(db, ref.id, expiry, true)).resolves.toMatchObject({status: "missing"});
});
