import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, type Firestore} from "firebase-admin/firestore";
import {purgeExpiredRedditProfile, purgeExpiredRedditProfilePage} from "../reddit/redditProfileRetention";

/** Destructive setup is confined to one demo-project loopback emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "demo-riddle-reddit-profile-retention";
/** Exact expiry boundary independent of emulator scheduling. */
const NOW = Date.UTC(2026, 9, 1);
/** Fixture account remains separate from the provider mapping. */
const UID = `reddit_${"a".repeat(40)}`;
/** Actual Admin SDK transactions are used in every storage case. */
let db: Firestore;
/** Opaque provider keys match the production namespace's storage grammar. */
const key = (value: string) => createHash("sha256").update(value).digest("hex");
/** Server-generated cache with a fixed original 24-hour lifetime. */
const profile = (expiresAtMs = NOW) => ({username: "RedditSolver", avatarUrl: "https://styles.redditmedia.com/avatar.png",
  refreshedAt: Timestamp.fromMillis(expiresAtMs - 86400000), expiresAt: Timestamp.fromMillis(expiresAtMs)});
/** Permanent mapping fields must survive cleanup unchanged. */
const identity = (expiresAtMs = NOW) => ({provider: "reddit", appName: "riddle-quest", providerUserId: "t2_profile-test",
  uid: UID, accountGeneration: 3, status: "active", redditProfile: profile(expiresAtMs)});

beforeAll(async () => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) {
    throw new Error("reddit-profile-retention-tests-require-local-demo-emulator");
  }
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all([db.recursiveDelete(db.collection("providerIdentities")), db.recursiveDelete(db.collection("users"))]);
});
afterAll(async () => {
  if (db) await Promise.all([db.recursiveDelete(db.collection("providerIdentities")), db.recursiveDelete(db.collection("users"))]);
});

it("dry-runs unchanged and clears only the expired field while retaining identity and economy", async () => {
  /** Target document is a permanent identity mapping, never a TTL candidate itself. */
  const ref = db.doc(`providerIdentities/${key("expired")}`);
  await ref.set(identity());
  await db.doc(`users/${UID}`).set({coins: 700, stats: {wins: 8}});
  await expect(purgeExpiredRedditProfile(db, ref.id, NOW)).resolves.toBe("ready");
  expect((await ref.get()).data()).toEqual(identity());
  await expect(purgeExpiredRedditProfile(db, ref.id, NOW, true)).resolves.toBe("ready");
  /** The field delete cannot replace or omit any permanent mapping field. */
  const {redditProfile: unused, ...mapping} = identity();
  expect(unused).toEqual(profile());
  expect((await ref.get()).data()).toEqual(mapping);
  expect((await db.doc(`users/${UID}`).get()).data()).toEqual({coins: 700, stats: {wins: 8}});
  await expect(purgeExpiredRedditProfile(db, ref.id, NOW, true)).resolves.toBe("absent");
});

it("preserves supported sub-millisecond expiry and rejects unsafe scopes/clocks", async () => {
  /** Firestore stores timestamps with microsecond precision, beyond an integer-millisecond cutoff. */
  const cutoff = Timestamp.fromMillis(NOW);
  /** Cache remains active until its full timestamp expires. */
  const row = {...identity(), redditProfile: {...profile(), expiresAt: new Timestamp(cutoff.seconds, 1000)}};
  /** Test-owned permanent mapping. */
  const ref = db.doc(`providerIdentities/${key("nano")}`);
  await ref.set(row);
  expect((await ref.get()).data()?.redditProfile.expiresAt.nanoseconds).toBe(1000);
  await expect(purgeExpiredRedditProfile(db, ref.id, NOW, true)).resolves.toBe("active");
  expect((await ref.get()).data()).toEqual(row);
  for (const time of [NaN, -1, 253402300800000]) {
    await expect(purgeExpiredRedditProfile(db, ref.id, time, true)).rejects.toThrow("invalid-reddit-profile-retention-clock");
  }
  await expect(purgeExpiredRedditProfile(db, "private-provider-key", NOW, true)).rejects.toThrow("invalid-reddit-profile-retention-key");
});

it("bounds the indexed page and keeps other providers and active Reddit profiles unchanged", async () => {
  /** More candidates than the chosen budget require another page. */
  const batch = db.batch();
  for (const label of ["expired-1", "expired-2", "expired-3"]) batch.set(db.doc(`providerIdentities/${key(label)}`), identity());
  batch.set(db.doc(`providerIdentities/${key("active")}`), identity(NOW + 1));
  batch.set(db.doc(`providerIdentities/${key("facebook")}`), {...identity(), provider: "facebook"});
  batch.set(db.doc(`providerIdentities/${key("jest")}`), {...identity(), provider: "jest"});
  await batch.commit();
  await expect(purgeExpiredRedditProfilePage(db, NOW, false, 2)).resolves.toMatchObject({scanned: 2, ready: 2, complete: false});
  await expect(purgeExpiredRedditProfilePage(db, NOW, true, 2)).resolves.toMatchObject({scanned: 2, ready: 2, complete: false});
  await expect(purgeExpiredRedditProfilePage(db, NOW, true, 2)).resolves.toMatchObject({scanned: 1, ready: 1, complete: true});
  expect((await db.doc(`providerIdentities/${key("active")}`).get()).data()?.redditProfile).toEqual(profile(NOW + 1));
  for (const provider of ["facebook", "jest"]) {
    expect((await db.doc(`providerIdentities/${key(provider)}`).get()).data()?.redditProfile).toEqual(profile());
    await expect(purgeExpiredRedditProfile(db, key(provider), NOW, true)).resolves.toBe("foreign");
  }
  expect((await db.collection("providerIdentities").get()).size).toBe(6);
});

it("rechecks a stale selected row after refresh or mapping deletion without recreating it", async () => {
  for (const deleted of [false, true]) {
    /** Candidate selected before a normal login refresh or deletion. */
    const ref = db.doc(`providerIdentities/${key(`stale-${deleted}`)}`);
    await ref.set(identity());
    /** Real SDK query is intercepted only after obtaining its stale result. */
    const query = db.collection("providerIdentities").where("provider", "==", "reddit")
      .where("redditProfile.expiresAt", "<=", Timestamp.fromMillis(NOW)).orderBy("redditProfile.expiresAt").limit(2);
    /** The mutation happens between outer selection and the helper's actual transaction. */
    const wrappedQuery = {where: () => wrappedQuery, orderBy: () => wrappedQuery, limit: () => wrappedQuery,
      get: async () => {
        /** No fake snapshot or transaction supplies the cleanup decision. */
        const snapshot = await query.get();
        if (deleted) await ref.delete();
        else await ref.update({redditProfile: profile(NOW + 86400000)});
        return snapshot;
      }};
    /** Transaction and document references retain the real Admin SDK behavior. */
    const wrappedDb = {collection: () => wrappedQuery, doc: db.doc.bind(db), runTransaction: db.runTransaction.bind(db)} as unknown as Firestore;
    await expect(purgeExpiredRedditProfilePage(wrappedDb, NOW, true, 1)).resolves.toMatchObject({
      scanned: 1, ready: 0, [deleted ? "missing" : "active"]: 1, complete: true,
    });
    expect((await ref.get()).exists).toBe(!deleted);
    if (!deleted) expect((await ref.get()).data()?.redditProfile).toEqual(profile(NOW + 86400000));
    await ref.delete();
  }
});

it("converges with concurrent refresh and overlapping cleanup transactions", async () => {
  /** Each concurrent path touches the actual same mapping. */
  const ref = db.doc(`providerIdentities/${key("concurrent")}`);
  await ref.set(identity());
  await Promise.all([purgeExpiredRedditProfile(db, ref.id, NOW, true),
    purgeExpiredRedditProfile(db, ref.id, NOW, true), ref.update({redditProfile: profile(NOW + 86400000)})]);
  expect((await ref.get()).data()).toEqual(identity(NOW + 86400000));
  await expect(purgeExpiredRedditProfile(db, ref.id, NOW, true)).resolves.toBe("active");
});

it("fails malformed cache records closed and reports aggregate invalid candidates", async () => {
  for (const malformed of [null, [], {expiresAt: NOW}, {expiresAt: null}]) {
    /** Invalid expiry cannot authorize field removal. */
    const ref = db.doc(`providerIdentities/${key("malformed")}`);
    await ref.set({...identity(), redditProfile: malformed});
    await expect(purgeExpiredRedditProfile(db, ref.id, NOW, true)).rejects.toThrow("invalid-reddit-profile-retention-record");
    expect((await ref.get()).data()?.redditProfile).toEqual(malformed);
  }
  /** Noncanonical selected storage keys require repair instead of arbitrary path mutation. */
  await db.doc("providerIdentities/noncanonical-key").set(identity());
  /** Aggregate failure neither includes the key nor silently claims whole-page success. */
  const result = await purgeExpiredRedditProfilePage(db, NOW, true);
  expect(result).toMatchObject({scanned: 1, invalid: 1, ready: 0, complete: false});
  expect(JSON.stringify(result)).not.toContain("noncanonical");
  await expect(purgeExpiredRedditProfilePage(db, NOW, true, 51)).rejects.toThrow("invalid-reddit-profile-retention-limit");
});
