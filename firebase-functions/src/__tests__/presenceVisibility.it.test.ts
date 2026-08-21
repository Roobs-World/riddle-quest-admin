import {deleteApp, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment} from
  "@firebase/rules-unit-testing";
import {get, onValue, ref, remove, update, type Database as ClientDatabase} from "firebase/database";
import {
  deletePresenceForUser,
  refreshBlockedRivalPresenceVisibility,
  refreshPresenceVisibility,
} from "../presence/presenceVisibility";
import {setPresenceConsentForUser} from "../presence/presenceAggregation";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const VIEWER = "presence-integration-viewer";
const TARGET = "presence-integration-target";
const FACEBOOK_TARGET = `facebook_${"c".repeat(40)}`;
const MULTI_DEVICE_VIEWER = `facebook_${"d".repeat(40)}`;
const MULTI_DEVICE_TARGET = `facebook_${"e".repeat(40)}`;
const MULTI_DEVICE_BLOCK_TARGET = `facebook_${"f".repeat(40)}`;

const watchPresenceUntilRevoked = (database: ClientDatabase, targetUserId: string) => {
  let resolveInitial!: (value: unknown) => void;
  let resolveRevoked!: (error: Error) => void;
  const initial = new Promise<unknown>((resolve) => { resolveInitial = resolve; });
  const revoked = new Promise<Error>((resolve) => { resolveRevoked = resolve; });
  const unsubscribe = onValue(
    ref(database, `presenceStatus/${targetUserId}`),
    (snapshot) => resolveInitial(snapshot.val()),
    (error) => resolveRevoked(error),
  );
  return {initial, revoked, unsubscribe};
};

const waitForRevocations = async (revocations: Array<Promise<Error>>): Promise<Error[]> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all(revocations),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("presence-revocation-timeout")), 5_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

let environment: RulesTestEnvironment;
const adminApp = initializeApp({
  projectId: PROJECT_ID,
}, "presence-visibility-integration");
const firestore = getFirestore(adminApp);
const adminDatabase = () => ({
  ref: (path?: string) => ({
    get: async () => {
      let snapshot: Awaited<ReturnType<typeof get>> | undefined;
      await environment.withSecurityRulesDisabled(async (context) => {
        snapshot = await get(ref(context.database(), path));
      });
      if (!snapshot) throw new Error("missing-rtdb-snapshot");
      return snapshot;
    },
    update: (values: Record<string, unknown>) => environment.withSecurityRulesDisabled((context) =>
      update(ref(context.database(), path), values)),
    remove: () => environment.withSecurityRulesDisabled((context) =>
      remove(ref(context.database(), path))),
  }),
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {rules: readFileSync(join(__dirname, "../../database.rules.json"), "utf8")},
  });
  const database = adminDatabase();
  await Promise.all([
    firestore.recursiveDelete(firestore.doc(`users/${VIEWER}`)),
    firestore.recursiveDelete(firestore.doc(`users/${TARGET}`)),
    firestore.recursiveDelete(firestore.doc(`users/${MULTI_DEVICE_VIEWER}`)),
    firestore.recursiveDelete(firestore.doc(`users/${MULTI_DEVICE_BLOCK_TARGET}`)),
    database.ref("presenceConnections").remove(),
    database.ref("presenceConsent").remove(),
    database.ref("presenceStatus").remove(),
    database.ref("presenceOptIn").remove(),
    database.ref("presenceVisibility").remove(),
    database.ref("presenceViewers").remove(),
    database.ref("featureGates").remove(),
  ]);
  await database.ref().update({"featureGates/facebookPresence": true});
});

afterAll(async () => {
  const database = adminDatabase();
  await Promise.all([
    firestore.recursiveDelete(firestore.doc(`users/${VIEWER}`)),
    firestore.recursiveDelete(firestore.doc(`users/${TARGET}`)),
    firestore.recursiveDelete(firestore.doc(`users/${MULTI_DEVICE_VIEWER}`)),
    firestore.recursiveDelete(firestore.doc(`users/${MULTI_DEVICE_BLOCK_TARGET}`)),
    database.ref("presenceConnections").remove(),
    database.ref("presenceConsent").remove(),
    database.ref("presenceStatus").remove(),
    database.ref("presenceOptIn").remove(),
    database.ref("presenceVisibility").remove(),
    database.ref("presenceViewers").remove(),
    database.ref("featureGates").remove(),
  ]);
  await environment.cleanup();
  await deleteApp(adminApp);
});

it("revokes RTDB reads when the Firestore block-trigger body runs, then deletes every indexed edge", async () => {
  const database = adminDatabase();
  await Promise.all([
    firestore.doc(`users/${VIEWER}/knownRivals/${TARGET}`).set({
      targetUserId: TARGET, source: "completed_race", establishedAtMs: 1,
    }),
    firestore.doc(`users/${TARGET}/knownRivals/${VIEWER}`).set({
      targetUserId: VIEWER, source: "completed_race", establishedAtMs: 1,
    }),
  ]);
  await Promise.all([
    refreshPresenceVisibility(VIEWER, TARGET, firestore, database as never),
    refreshPresenceVisibility(TARGET, VIEWER, firestore, database as never),
  ]);
  await database.ref().update({
    [`presenceStatus/${TARGET}`]: {state: "racing", updatedAt: 1},
    [`presenceOptIn/${TARGET}`]: true,
    [`presenceConnections/${TARGET}/device-1`]: {platform: "facebook", state: "racing", updatedAt: 1},
  });

  const viewerDatabase = environment.authenticatedContext(VIEWER).database();
  await assertSucceeds(get(ref(viewerDatabase, `presenceStatus/${TARGET}`)));

  await firestore.doc(`users/${TARGET}/blockedRivals/${VIEWER}`).set({createdAtMs: 2});
  await refreshBlockedRivalPresenceVisibility(TARGET, VIEWER, firestore, database as never);
  await assertFails(get(ref(viewerDatabase, `presenceStatus/${TARGET}`)));
  expect((await database.ref(`presenceVisibility/${VIEWER}/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceViewers/${TARGET}/${VIEWER}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceVisibility/${TARGET}/${VIEWER}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceViewers/${VIEWER}/${TARGET}`).get()).exists()).toBe(false);

  await firestore.doc(`users/${TARGET}/blockedRivals/${VIEWER}`).delete();
  await refreshBlockedRivalPresenceVisibility(TARGET, VIEWER, firestore, database as never);
  await assertSucceeds(get(ref(viewerDatabase, `presenceStatus/${TARGET}`)));

  await deletePresenceForUser(TARGET, database as never);
  await assertFails(get(ref(viewerDatabase, `presenceStatus/${TARGET}`)));
  expect((await database.ref(`presenceConnections/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceConsent/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceStatus/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceOptIn/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceVisibility/${VIEWER}/${TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceViewers/${VIEWER}/${TARGET}`).get()).exists()).toBe(false);
});

it("revokes rival reads and clears every tab/device on account-wide opt-out", async () => {
  const database = adminDatabase();
  await database.ref().update({
    [`presenceConnections/${FACEBOOK_TARGET}/tab-1`]: {platform: "facebook", state: "playing", updatedAt: 1},
    [`presenceConnections/${FACEBOOK_TARGET}/device-2`]: {platform: "facebook", state: "racing", updatedAt: 2},
    [`presenceStatus/${FACEBOOK_TARGET}`]: {state: "racing", updatedAt: 2},
    [`presenceOptIn/${FACEBOOK_TARGET}`]: true,
    [`presenceConsent/${FACEBOOK_TARGET}`]: true,
    [`presenceVisibility/${VIEWER}/${FACEBOOK_TARGET}`]: true,
    [`presenceViewers/${FACEBOOK_TARGET}/${VIEWER}`]: true,
  });
  const viewerDatabase = environment.authenticatedContext(VIEWER).database();
  await assertSucceeds(get(ref(viewerDatabase, `presenceStatus/${FACEBOOK_TARGET}`)));

  await setPresenceConsentForUser(FACEBOOK_TARGET, false, database as never, 3);

  await assertFails(get(ref(viewerDatabase, `presenceStatus/${FACEBOOK_TARGET}`)));
  expect((await database.ref(`presenceConnections/${FACEBOOK_TARGET}`).get()).exists()).toBe(false);
  expect((await database.ref(`presenceOptIn/${FACEBOOK_TARGET}`).get()).val()).toBe(false);
  expect((await database.ref(`presenceConsent/${FACEBOOK_TARGET}`).get()).val()).toBe(false);
  expect((await database.ref(`presenceStatus/${FACEBOOK_TARGET}`).get()).val()).toEqual({
    state: "offline", updatedAt: 3,
  });
  expect((await database.ref(`presenceVisibility/${VIEWER}/${FACEBOOK_TARGET}`).get()).val()).toBe(true);
});

it("cancels already-open rival observers on both viewer devices after account-wide opt-out", async () => {
  const database = adminDatabase();
  await database.ref().update({
    [`presenceConnections/${MULTI_DEVICE_TARGET}/tab-1`]: {
      platform: "facebook", state: "playing", updatedAt: 1,
    },
    [`presenceConnections/${MULTI_DEVICE_TARGET}/phone-1`]: {
      platform: "facebook", state: "racing", updatedAt: 2,
    },
    [`presenceStatus/${MULTI_DEVICE_TARGET}`]: {state: "racing", updatedAt: 2},
    [`presenceOptIn/${MULTI_DEVICE_TARGET}`]: true,
    [`presenceConsent/${MULTI_DEVICE_TARGET}`]: true,
    [`presenceVisibility/${MULTI_DEVICE_VIEWER}/${MULTI_DEVICE_TARGET}`]: true,
    [`presenceViewers/${MULTI_DEVICE_TARGET}/${MULTI_DEVICE_VIEWER}`]: true,
  });
  const desktop = watchPresenceUntilRevoked(
    environment.authenticatedContext(MULTI_DEVICE_VIEWER, {provider: "facebook"}).database(),
    MULTI_DEVICE_TARGET,
  );
  const phone = watchPresenceUntilRevoked(
    environment.authenticatedContext(MULTI_DEVICE_VIEWER, {provider: "facebook"}).database(),
    MULTI_DEVICE_TARGET,
  );
  try {
    await expect(Promise.all([desktop.initial, phone.initial])).resolves.toEqual([
      {state: "racing", updatedAt: 2},
      {state: "racing", updatedAt: 2},
    ]);

    await setPresenceConsentForUser(MULTI_DEVICE_TARGET, false, database as never, 3);

    const cancellationErrors = await waitForRevocations([desktop.revoked, phone.revoked]);
    expect(cancellationErrors.map((error) => error.message)).toEqual([
      expect.stringMatching(/permission_denied|permission denied/iu),
      expect.stringMatching(/permission_denied|permission denied/iu),
    ]);
    expect((await database.ref(`presenceConnections/${MULTI_DEVICE_TARGET}`).get()).exists()).toBe(false);
    expect((await database.ref(`presenceOptIn/${MULTI_DEVICE_TARGET}`).get()).val()).toBe(false);
  } finally {
    desktop.unsubscribe();
    phone.unsubscribe();
  }
}, 15_000);

it("cancels both viewer devices immediately on block and later account deletion", async () => {
  const database = adminDatabase();
  await Promise.all([
    firestore.doc(`users/${MULTI_DEVICE_VIEWER}/knownRivals/${MULTI_DEVICE_BLOCK_TARGET}`).set({
      targetUserId: MULTI_DEVICE_BLOCK_TARGET, source: "completed_race", establishedAtMs: 1,
    }),
    firestore.doc(`users/${MULTI_DEVICE_BLOCK_TARGET}/knownRivals/${MULTI_DEVICE_VIEWER}`).set({
      targetUserId: MULTI_DEVICE_VIEWER, source: "completed_race", establishedAtMs: 1,
    }),
  ]);
  await refreshPresenceVisibility(
    MULTI_DEVICE_VIEWER, MULTI_DEVICE_BLOCK_TARGET, firestore, database as never,
  );
  await database.ref().update({
    [`presenceStatus/${MULTI_DEVICE_BLOCK_TARGET}`]: {state: "playing", updatedAt: 1},
    [`presenceOptIn/${MULTI_DEVICE_BLOCK_TARGET}`]: true,
  });
  const newViewerDevices = () => [
    watchPresenceUntilRevoked(
      environment.authenticatedContext(MULTI_DEVICE_VIEWER, {provider: "facebook"}).database(),
      MULTI_DEVICE_BLOCK_TARGET,
    ),
    watchPresenceUntilRevoked(
      environment.authenticatedContext(MULTI_DEVICE_VIEWER, {provider: "facebook"}).database(),
      MULTI_DEVICE_BLOCK_TARGET,
    ),
  ];
  const blockWatchers = newViewerDevices();
  try {
    await expect(Promise.all(blockWatchers.map((watcher) => watcher.initial))).resolves.toEqual([
      {state: "playing", updatedAt: 1},
      {state: "playing", updatedAt: 1},
    ]);
    await firestore.doc(`users/${MULTI_DEVICE_BLOCK_TARGET}/blockedRivals/${MULTI_DEVICE_VIEWER}`)
      .set({createdAtMs: 2});
    await refreshBlockedRivalPresenceVisibility(
      MULTI_DEVICE_BLOCK_TARGET, MULTI_DEVICE_VIEWER, firestore, database as never,
    );
    const errors = await waitForRevocations(blockWatchers.map((watcher) => watcher.revoked));
    expect(errors.every((error) => /permission_denied|permission denied/iu.test(error.message))).toBe(true);
  } finally {
    blockWatchers.forEach((watcher) => watcher.unsubscribe());
  }

  await firestore.doc(`users/${MULTI_DEVICE_BLOCK_TARGET}/blockedRivals/${MULTI_DEVICE_VIEWER}`).delete();
  await refreshBlockedRivalPresenceVisibility(
    MULTI_DEVICE_BLOCK_TARGET, MULTI_DEVICE_VIEWER, firestore, database as never,
  );
  const deletionWatchers = newViewerDevices();
  try {
    await Promise.all(deletionWatchers.map((watcher) => watcher.initial));
    await deletePresenceForUser(MULTI_DEVICE_BLOCK_TARGET, database as never);
    const errors = await waitForRevocations(deletionWatchers.map((watcher) => watcher.revoked));
    expect(errors.every((error) => /permission_denied|permission denied/iu.test(error.message))).toBe(true);
    expect((await database.ref(`presenceVisibility/${MULTI_DEVICE_VIEWER}/${MULTI_DEVICE_BLOCK_TARGET}`).get())
      .exists()).toBe(false);
  } finally {
    deletionWatchers.forEach((watcher) => watcher.unsubscribe());
  }
}, 20_000);
