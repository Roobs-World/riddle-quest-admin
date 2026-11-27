import {ACCOUNT_DELETION_COLLECTION} from "../../../../../firebase-functions/src/shared/accountDeletion";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {initializeTestEnvironment, assertFails, type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";
import {createFacebookNotificationDispatchLedger, type FacebookNotificationDispatchRequest} from "../facebookNotificationDispatch";
import {facebookFirebaseUid} from "../facebookSecurity";

/** Every data mutation is confined to an explicitly named local demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-riddle-facebook-dispatch";
/** Synthetic provider scope, never a live user. */
const APP = "1748953042991569";
/** Synthetic UID key, unrelated to deployment secrets. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
/** Canonical server clock for original issuance and TTL assertions. */
const NOW = Date.UTC(2026, 9, 2, 16);
/** Preserve the process's deployment switch after this isolated fixture suite. */
const originalDisabledFeatures = process.env.FACEBOOK_DISABLED_FEATURES;
/** Test identity is derived using the real production UID helper. */
const actor = {playerId: "dispatch_fixture_player", accountGeneration: 1, uid: facebookFirebaseUid("dispatch_fixture_player", SECRET)};
/** Database is the real Admin SDK connected only to the demo emulator. */
let db: FirebaseFirestore.Firestore;
/** Client rules use the same local project without administrator bypass. */
let rules: RulesTestEnvironment;
/** Digest helper matches canonical provider document identity, not a mocked database. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Stable provider identity reference for the synthetic generation. */
const providerPath = `providerIdentities/${hash(`${APP}\0${actor.playerId}`)}`;
/** Private state is recursively removed with the account. */
const statePath = `users/${actor.uid}/facebookNotificationState/current`;
/** Constructor uses only a fake key and the actual local database. */
const ledger = (now: () => number = () => NOW) => createFacebookNotificationDispatchLedger(db, actor, {appId: APP, uidSecret: SECRET, now});
/** Each synthetic request carries its original issuance and exact content fingerprint. */
const work = (id: string, patch: Partial<FacebookNotificationDispatchRequest> = {}): FacebookNotificationDispatchRequest => ({
  attemptId: `fixture_attempt_${id}`, issuedAtMs: NOW, operation: "send", label: `riddlequest_${id}`,
  requestDigest: hash(`synthetic notification body ${id}`), scheduleInterval: 86_400, ...patch,
});
/** Simulates only the transport's fixture-confirmed result, not real Meta delivery. */
const confirmed = {outcome: "confirmed" as const, httpStatus: 200};

beforeAll(async () => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/u.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("facebook-dispatch-tests-require-local-demo-emulator");
  }
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
  /** Same local listener is used by rules-aware SDK clients. */
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  rules = await initializeTestEnvironment({projectId: PROJECT, firestore: {host, port: Number(port), rules: readFileSync("firestore.rules", "utf8")}});
});
beforeEach(async () => {
  delete process.env.FACEBOOK_DISABLED_FEATURES;
  await db.recursiveDelete(db.doc(`users/${actor.uid}`));
  await db.doc(`${ACCOUNT_DELETION_COLLECTION}/${actor.uid}`).delete();
  await db.doc(`users/${actor.uid}`).set({provider: "facebook", stats: {wins: 1}});
  await db.doc(providerPath).set({provider: "facebook", appId: APP, providerPlayerId: actor.playerId,
    uid: actor.uid, accountGeneration: 1, status: "active"});
  await db.doc(`facebookNotificationPromptLeases/${actor.uid}`).set({schemaVersion: 1, uid: actor.uid,
    accepted: true, lastPromptAt: Timestamp.fromMillis(NOW - 2), acceptedAt: Timestamp.fromMillis(NOW - 1)});
});
afterAll(async () => {
  if (originalDisabledFeatures === undefined) delete process.env.FACEBOOK_DISABLED_FEATURES;
  else process.env.FACEBOOK_DISABLED_FEATURES = originalDisabledFeatures;
  if (db) {
    await db.recursiveDelete(db.doc(`users/${actor.uid}`));
    await Promise.all([db.doc(providerPath).delete(), db.doc(`facebookNotificationPromptLeases/${actor.uid}`).delete(),
      db.doc(`${ACCOUNT_DELETION_COLLECTION}/${actor.uid}`).delete()]);
  }
  await rules?.cleanup();
});

it("admits exactly five distinct simultaneous scheduled sends across independent instances", async () => {
  /** Contention exercises an actual Firestore transaction, not an in-memory quota. */
  const admitted = await Promise.all(Array.from({length: 10}, (_, i) => ledger().claim(work(`cap_${i}`))));
  expect(admitted.filter(Boolean)).toHaveLength(5);
  expect((await db.doc(statePath).get()).data()?.slots).toHaveLength(5);
  expect((await db.collection(`users/${actor.uid}/facebookNotificationAttempts`).get()).size).toBe(5);
});

it("persists one attempt before transmission and refuses concurrent replay or changed content/issuance", async () => {
  /** Same durable outbox work is shared by every contender. */
  const request = work("replay");
  expect((await Promise.all(Array.from({length: 8}, () => ledger().claim(request)))).filter(Boolean)).toHaveLength(1);
  await expect(ledger().claim({...request, requestDigest: hash("different body")})).rejects.toThrow("receipt-conflict");
  await expect(ledger().claim({...request, issuedAtMs: NOW - 1})).rejects.toThrow("receipt-conflict");
  await ledger().finish(request, confirmed);
  await ledger().finish(request, confirmed);
  await expect(ledger().claim(request)).resolves.toBe(false);
});

it("keeps uncertain sends occupied and blocks cancellation, new IDs and a contradictory late outcome", async () => {
  /** A timed-out native request may have committed remotely. */
  const request = work("uncertain");
  await ledger().claim(request);
  await ledger().finish(request, {outcome: "unconfirmed"});
  await expect(ledger().claim(work("replacement", {label: request.label}))).resolves.toBe(false);
  await expect(ledger().claim(work("cancel_uncertain", {operation: "cancel", label: request.label, scheduleInterval: undefined}))).resolves.toBe(false);
  await expect(ledger().finish(request, confirmed)).rejects.toThrow("result-conflict");
  expect((await db.doc(statePath).get()).data()?.slots[0].phase).toBe("uncertain");
});

it("does not cancel a still-running send, and confirms cleanup before freeing a scheduled slot", async () => {
  /** Native cancellation cannot safely precede a potentially late send. */
  const request = work("ordered");
  /** Cancellation uses a distinct durable attempt, scoped to the same label. */
  const cancel = work("cancel_ordered", {operation: "cancel", label: request.label, scheduleInterval: undefined});
  await ledger().claim(request);
  await expect(ledger().claim(cancel)).resolves.toBe(false);
  await ledger().finish(request, confirmed);
  expect(await ledger().claim(cancel)).toBe(true);
  await expect(ledger().claim(work("replace_ordered", {label: request.label}))).resolves.toBe(false);
  await ledger().finish(cancel, confirmed);
  expect((await db.doc(statePath).get()).data()?.slots).toEqual([]);
  expect(await ledger().claim(work("replace_ordered", {label: request.label}))).toBe(true);
});

it("does not retry uncertain cancellation, but releases a proven unsent cancellation for another attempt", async () => {
  for (const outcome of ["unconfirmed", "not-sent"] as const) {
    /** Each phase uses an independent app-owned label. */
    const request = work(`cancel_${outcome}`);
    await ledger().claim(request); await ledger().finish(request, confirmed);
    /** Provider cancellation has its own one-use receipt. */
    const cancel = work(`cleanup_${outcome}`, {operation: "cancel", label: request.label, scheduleInterval: undefined});
    await ledger().claim(cancel); await ledger().finish(cancel, {outcome});
    await expect(ledger().claim(cancel)).resolves.toBe(false);
    await expect(ledger().claim(work(`retry_${outcome}`, {operation: "cancel", label: request.label, scheduleInterval: undefined}))).resolves.toBe(outcome === "not-sent");
  }
});

it("frees proven unsent reservations and confirmed immediate sends without permitting receipt replay", async () => {
  for (const outcome of ["not-sent", "confirmed"] as const) {
    /** Immediate delivery does not remain a scheduled pending slot after acknowledgement. */
    const request = work(`immediate_${outcome}`, {scheduleInterval: undefined});
    await ledger().claim(request); await ledger().finish(request, outcome === "confirmed" ? confirmed : {outcome});
    expect((await db.doc(statePath).get()).data()?.slots).toEqual([]);
    await expect(ledger().claim(request)).resolves.toBe(false);
  }
});

it("enforces current consent, emergency-off, provider generation and deletion authority", async () => {
  /** Denied authority never creates a pending receipt or slot. */
  const request = work("authority");
  await db.doc(`facebookNotificationPromptLeases/${actor.uid}`).update({accepted: false});
  expect(await ledger().claim(request)).toBe(false);
  await db.doc(`facebookNotificationPromptLeases/${actor.uid}`).update({accepted: true});
  process.env.FACEBOOK_DISABLED_FEATURES = "notifications";
  expect(await ledger().claim(request)).toBe(false);
  delete process.env.FACEBOOK_DISABLED_FEATURES;
  await db.doc(providerPath).update({accountGeneration: 2});
  expect(await ledger().claim(request)).toBe(false);
  await db.doc(providerPath).update({accountGeneration: 1});
  await db.doc(`${ACCOUNT_DELETION_COLLECTION}/${actor.uid}`).set({recreationBlocked: true});
  expect(await ledger().claim(request)).toBe(false);
  expect((await db.doc(statePath).get()).exists).toBe(false);
});

it("revokes new sending while retaining authorized cleanup during opt-out/deletion", async () => {
  /** Existing acknowledged provider schedule must survive local revocation until cancellation. */
  const request = work("revoke");
  await ledger().claim(request); await ledger().finish(request, confirmed);
  await ledger().suspend();
  expect(await ledger().claim(work("revoked_send"))).toBe(false);
  await db.doc(providerPath).update({status: "deleting"});
  await db.doc(`${ACCOUNT_DELETION_COLLECTION}/${actor.uid}`).set({recreationBlocked: true});
  await db.doc(`facebookNotificationPromptLeases/${actor.uid}`).delete();
  process.env.FACEBOOK_DISABLED_FEATURES = "notifications";
  /** Deletion cleanup is server-owned and scoped to one known slot. */
  const cancel = work("delete_cleanup", {operation: "cancel", label: request.label, scheduleInterval: undefined});
  expect(await ledger().claim(cancel)).toBe(true);
  await ledger().finish(cancel, confirmed);
  expect((await db.doc(statePath).get()).data()).toMatchObject({suspended: true, slots: []});
});

it("checks fresh admission after reads/commit and never renews expired or future work", async () => {
  expect(await ledger(() => NOW + 300_000).claim(work("expired"))).toBe(false);
  expect(await ledger(() => NOW - 1).claim(work("future"))).toBe(false);
  /** Clock advances while the transaction commits; the late authorization remains closed. */
  let reads = 0;
  /** First clock admits, second clock expires the committed reservation. */
  const clock = () => ++reads === 1 ? NOW : NOW + 300_000;
  expect(await ledger(clock).claim(work("late_commit"))).toBe(false);
  expect((await db.doc(statePath).get()).data()?.slots[0].phase).toBe("sending");
});

it("retains original physical expiry and blocks an old request even after receipt removal", async () => {
  /** Receipt TTL is a physical retention aid, never an authorization clock. */
  const request = work("ttl");
  await ledger().claim(request); await ledger().finish(request, {outcome: "not-sent"});
  /** The sole receipt contains no raw Meta ID or token. */
  const stored = (await db.collection(`users/${actor.uid}/facebookNotificationAttempts`).get()).docs[0];
  expect(stored.data().expiresAt.isEqual(Timestamp.fromMillis(NOW + 31 * 86_400_000))).toBe(true);
  expect(JSON.stringify(stored.data())).not.toContain(actor.playerId);
  await stored.ref.delete();
  expect(await ledger(() => NOW + 32 * 86_400_000).claim(request)).toBe(false);
});

it("fails on transplanted/corrupt state and cannot recreate rows after recursive deletion", async () => {
  await ledger().claim(work("corrupt"));
  await db.doc(statePath).update({scopeHash: "a".repeat(64)});
  await expect(ledger().claim(work("next"))).rejects.toThrow("state-conflict");
  await db.recursiveDelete(db.doc(`users/${actor.uid}`));
  await expect(ledger().finish(work("corrupt"), confirmed)).rejects.toThrow("attempt-missing");
  await ledger().suspend();
  expect((await db.doc(statePath).get()).exists).toBe(false);
});

it("denies browser access to pending state and receipts even for their owner", async () => {
  await ledger().claim(work("private"));
  /** Direct browser access must not expose or let anyone free server capacity. */
  const receipt = (await db.collection(`users/${actor.uid}/facebookNotificationAttempts`).get()).docs[0].ref.path;
  for (const client of [rules.authenticatedContext(actor.uid).firestore(), rules.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(doc(client, statePath)));
    await assertFails(setDoc(doc(client, statePath), {slots: []}));
    await assertFails(getDoc(doc(client, receipt)));
    await assertFails(setDoc(doc(client, receipt), {outcome: "confirmed"}));
  }
});
