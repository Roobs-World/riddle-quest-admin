import {deleteApp, initializeApp} from "firebase-admin/app";
import {getDatabase, type Database} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {get, ref} from "firebase/database";
import {deletePresenceForUser, refreshPresenceVisibility} from "../presence/presenceVisibility";
import {blockKnownRival} from "../social/socialSafety";
import {recordAccountDeletion} from "../shared/accountDeletion";
import {AccountDeletionBusyError} from "../shared/accountDeletion";

/** Destructive fixtures are confined to a private demo and loopback emulators. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
if (
  !PROJECT.startsWith("demo-") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "")
) {
  throw new Error("Private demo Firestore and Database emulators required");
}
/** Admin SDK app shares exactly the rules-test database namespace. */
const app = initializeApp({projectId: PROJECT, databaseURL: `https://${PROJECT}.firebaseio.com`});
/** Actual server authority and actual RTDB storage are never mocked. */
const db = getFirestore(app),
  database = getDatabase(app);
/** Rules clients verify the resulting permission, rather than only the stored ACL. */
let environment: RulesTestEnvironment;
beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT,
    database: {rules: readFileSync(join(__dirname, "../../database.rules.json"), "utf8")},
  });
});
beforeEach(async () => {
  await Promise.all(["users", "jestAccountDeletionTombstones"].map((name) => db.recursiveDelete(db.collection(name))));
  await database.ref().set({featureGates: {facebookPresence: true}});
});
afterAll(async () => {
  await Promise.all(["users", "jestAccountDeletionTombstones"].map((name) => db.recursiveDelete(db.collection(name))));
  await database.ref().remove();
  await environment.cleanup();
  await deleteApp(app);
});

/** Pauses only one production ACL write after its Firestore source was read. */
function pauseVisibilityWrite(viewer: string, target: string) {
  /** Explicit barriers make delivery reversal deterministic without sleeps. */
  let reached!: () => void, resume!: () => void;
  /** Both versions of the production writer pass through the same storage seam. */
  const paused = new Promise<void>((resolve) => {
    reached = resolve;
  });
  /** Releases the one blocked storage delivery after the newer action commits. */
  const released = new Promise<void>((resolve) => {
    resume = resolve;
  });
  /** Only the selected directed edge is delayed. */
  const path = `presenceVisibility/${viewer}/${target}`;
  /** Proxy retains the real SDK methods, binding their original receiver. */
  const delayed = {
    ref: (referencePath?: string) => {
      /** All forwarded calls use the real emulator reference. */
      const reference = database.ref(referencePath);
      return new Proxy(reference, {
        get: (object, property) => {
          if (property === "update")
            return async (values: Record<string, unknown>) => {
              if (!referencePath && values[path] === true) {
                reached();
                await released;
              }
              return reference.update(values);
            };
          if (property === "transaction")
            return async (...args: Parameters<typeof reference.transaction>) => {
              if (referencePath === path) {
                reached();
                await released;
              }
              return reference.transaction(...args);
            };
          /** Preserve the SDK receiver for methods that are not intercepted. */
          const value = Reflect.get(object, property);
          return typeof value === "function" ? value.bind(object) : value;
        },
      });
    },
  } as Database;
  return {delayed, paused, resume};
}

it.each([
  ["facebook", "viewer"],
  ["facebook", "target"],
])(
  "keeps %s presence unreadable after the %s confirms a block despite an older grant finishing last",
  async (provider, blocker) => {
    /** Canonical identities verify preservation of both realtime platform contracts. */
    const viewer = `${provider}_${"a".repeat(40)}`,
      target = `${provider}_${"b".repeat(40)}`;
    await Promise.all(
      [viewer, target].map((owner, index) =>
        db.doc(`users/${owner}/knownRivals/${index ? viewer : target}`).set({
          targetUserId: index ? viewer : target,
          source: "completed_race",
          establishedAtMs: 1,
        }),
      ),
    );
    await refreshPresenceVisibility(viewer, target, db, database);
    await database
      .ref()
      .update({[`presenceOptIn/${target}`]: true, [`presenceStatus/${target}`]: {state: "racing", updatedAt: 1}});
    /** An authenticated observer can read this consenting, established rival initially. */
    const client = environment.authenticatedContext(viewer, {provider}).database();
    await assertSucceeds(get(ref(client, `presenceStatus/${target}`)));
    /** Source is allowed before the newer block; storage delivery is deliberately reversed. */
    /** Reverse transport completion while preserving actual server-side reads. */
    const barrier = pauseVisibilityWrite(viewer, target);
    /** The earlier computed decision remains in flight while the block completes. */
    const stale = refreshPresenceVisibility(viewer, target, db, barrier.delayed);
    try {
      await barrier.paused;
      /** Either owner can revoke this bilateral presence relationship. */
      const owner = blocker === "viewer" ? viewer : target,
        other = blocker === "viewer" ? target : viewer;
      await blockKnownRival(owner, other, {db, database, nowMs: 2});
      expect((await db.doc(`users/${owner}/blockedRivals/${other}`).get()).exists).toBe(true);
      expect((await database.ref(`presenceVisibility/${viewer}/${target}`).get()).child("allowed").val()).toBe(false);
      await assertFails(get(ref(client, `presenceStatus/${target}`)));
    } finally {
      barrier.resume();
    }
    await stale;
    await assertFails(get(ref(client, `presenceStatus/${target}`)));
  },
  15_000,
);

it.each(["facebook"])("preserves a newer %s unblock when an older denial arrives last", async (provider) => {
  /** Server-owned rivalry remains eligible after explicit unblocking. */
  const viewer = `${provider}_${"a".repeat(40)}`,
    target = `${provider}_${"b".repeat(40)}`;
  /** Relationship authority lives in Firestore, independently of the mirrored ACL. */
  const known = db.doc(`users/${viewer}/knownRivals/${target}`),
    block = db.doc(`users/${target}/blockedRivals/${viewer}`);
  await known.set({targetUserId: target, source: "completed_race"});
  await block.set({blockedAtMs: 1});
  await refreshPresenceVisibility(viewer, target, db, database);
  await database
    .ref()
    .update({[`presenceOptIn/${target}`]: true, [`presenceStatus/${target}`]: {state: "online", updatedAt: 1}});
  /** The delayed denial was computed while blocked. */
  /** Reverse transport completion while preserving actual server-side reads. */
  const barrier = pauseVisibilityWrite(viewer, target),
    stale = refreshPresenceVisibility(viewer, target, db, barrier.delayed);
  try {
    await barrier.paused;
    await block.delete();
    await expect(refreshPresenceVisibility(viewer, target, db, database)).resolves.toBe(true);
  } finally {
    barrier.resume();
  }
  await expect(stale).resolves.toBe(true);
  await assertSucceeds(
    get(ref(environment.authenticatedContext(viewer, {provider}).database(), `presenceStatus/${target}`)),
  );
});

it("keeps removed rival access denied after an older grant and retains its deletion cleanup index", async () => {
  /** This exercises relationship deletion independently of either player's block. */
  const viewer = `facebook_${"a".repeat(40)}`,
    target = `facebook_${"b".repeat(40)}`;
  /** Relationship authority lives in Firestore, independently of the mirrored ACL. */
  const known = db.doc(`users/${viewer}/knownRivals/${target}`);
  await known.set({targetUserId: target, source: "facebook_context"});
  await refreshPresenceVisibility(viewer, target, db, database);
  await database
    .ref()
    .update({[`presenceOptIn/${target}`]: true, [`presenceStatus/${target}`]: {state: "online", updatedAt: 1}});
  /** Reverse transport completion while preserving actual server-side reads. */
  const barrier = pauseVisibilityWrite(viewer, target),
    stale = refreshPresenceVisibility(viewer, target, db, barrier.delayed);
  try {
    await barrier.paused;
    await known.delete();
    await expect(refreshPresenceVisibility(viewer, target, db, database)).resolves.toBe(false);
  } finally {
    barrier.resume();
  }
  await expect(stale).resolves.toBe(false);
  await assertFails(
    get(ref(environment.authenticatedContext(viewer, {provider: "facebook"}).database(), `presenceStatus/${target}`)),
  );
  expect((await database.ref(`presenceViewers/${target}/${viewer}`).get()).val()).toBe(true);
  await deletePresenceForUser(target, database);
  expect((await database.ref(`presenceVisibility/${viewer}/${target}`).get()).exists()).toBe(false);
});

it.each(["viewer", "target"])(
  "drains older mirrors before deleting the %s and refuses cleanup-trigger resurrection",
  async (owner) => {
    /** Existing production deletion guards protect each side of a directed edge. */
    const viewer = `facebook_${"a".repeat(40)}`,
      target = `facebook_${"b".repeat(40)}`,
      deleted = owner === "viewer" ? viewer : target;
    await db.doc(`users/${viewer}/knownRivals/${target}`).set({targetUserId: target, source: "completed_race"});
    /** Reverse transport completion while preserving actual server-side reads. */
    const barrier = pauseVisibilityWrite(viewer, target),
      stale = refreshPresenceVisibility(viewer, target, db, barrier.delayed);
    try {
      await barrier.paused;
      await expect(recordAccountDeletion(deleted)).rejects.toBeInstanceOf(AccountDeletionBusyError);
    } finally {
      barrier.resume();
    }
    await stale;
    await recordAccountDeletion(deleted);
    await deletePresenceForUser(deleted, database);
    await db.recursiveDelete(db.doc(`users/${deleted}`));
    await expect(refreshPresenceVisibility(viewer, target, db, database)).resolves.toBe(false);
    expect((await database.ref(`presenceVisibility/${viewer}/${target}`).get()).exists()).toBe(false);
    expect((await database.ref(`presenceViewers/${target}/${viewer}`).get()).exists()).toBe(false);
    expect((await db.collectionGroup("activeOperations").get()).empty).toBe(true);
  },
);
