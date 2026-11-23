import {deleteApp, initializeApp} from "firebase-admin/app";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {get, ref} from "firebase/database";
import {reconcilePresenceVisibilityPage} from "../presence/presenceVisibilityReconciliation";

/** Destructive cleanup can only affect this private loopback demo fixture. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
if (
  !PROJECT.startsWith("demo-") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "")
)
  throw new Error("Private demo presence emulators required");
/** Named fixture and CLI child share exactly one explicit database namespace. */
const app = initializeApp(
  {projectId: PROJECT, databaseURL: `https://${PROJECT}.firebaseio.com`},
  "presence-reconciliation",
);
/** Real storage backs every service operation. */
const db = getFirestore(app),
  database = getDatabase(app);
/** Authenticated rules reads verify the effect on players. */
let environment: RulesTestEnvironment;
beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT,
    database: {rules: readFileSync(join(__dirname, "../../database.rules.json"), "utf8")},
  });
});
/** Only these fixture-owned stores are cleared. */
async function clear() {
  await Promise.all(["users", "jestAccountDeletionTombstones"].map((name) => db.recursiveDelete(db.collection(name))));
  await database.ref().set({featureGates: {facebookPresence: true}});
}
beforeEach(clear);
afterAll(async () => {
  await clear();
  await environment.cleanup();
  await deleteApp(app);
});

/** Seed actual rivalry and an old-style grant independently of current blocking. */
async function seed(provider = "facebook") {
  /** Canonical platform identities exercise existing rules unchanged. */
  const pair = {viewerUserId: `${provider}_${"a".repeat(40)}`, targetUserId: `${provider}_${"b".repeat(40)}`};
  await db
    .doc(`users/${pair.viewerUserId}/knownRivals/${pair.targetUserId}`)
    .set({targetUserId: pair.targetUserId, source: "completed_race"});
  await database.ref().update({
    [`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`]: true,
    [`presenceViewers/${pair.targetUserId}/${pair.viewerUserId}`]: true,
    [`presenceOptIn/${pair.targetUserId}`]: true,
    [`presenceStatus/${pair.targetUserId}`]: {state: "racing", updatedAt: 1},
    unrelated: {preserve: true},
  });
  return pair;
}

it("preview inventories legacy bits without writing RTDB, source authority or operation leases", async () => {
  /** Synthetic server-owned relationship defines the scope under test. */
  const pair = await seed(),
    before = (await database.ref().get()).val();
  await db.doc(`users/${pair.targetUserId}/blockedRivals/${pair.viewerUserId}`).set({blockedAtMs: 2});
  await expect(reconcilePresenceVisibilityPage([pair], db, database)).resolves.toMatchObject({
    processed: 1,
    legacy: 1,
    refreshed: 0,
    deletedOwnerEdgesRemoved: 0,
  });
  expect((await database.ref().get()).val()).toEqual(before);
  expect((await db.collectionGroup("activeOperations").get()).empty).toBe(true);
  expect((await db.doc(`users/${pair.targetUserId}/blockedRivals/${pair.viewerUserId}`).get()).data()).toEqual({
    blockedAtMs: 2,
  });
});

it.each(["facebook", "jest"])(
  "converts consenting %s grants and revokes a preexisting legacy bit for a blocked rival",
  async (provider) => {
    /** Synthetic server-owned relationship defines the scope under test. */
    const pair = await seed(provider);
    /** An authenticated rules client checks actual status access. */
    const client = environment.authenticatedContext(pair.viewerUserId, {provider}).database();
    await expect(reconcilePresenceVisibilityPage([pair], db, database, true)).resolves.toMatchObject({
      processed: 1,
      legacy: 1,
      refreshed: 1,
    });
    await assertSucceeds(get(ref(client, `presenceStatus/${pair.targetUserId}`)));
    await db.doc(`users/${pair.targetUserId}/blockedRivals/${pair.viewerUserId}`).set({blockedAtMs: 2});
    await database.ref(`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`).set(true);
    await assertSucceeds(get(ref(client, `presenceStatus/${pair.targetUserId}`)));
    await expect(reconcilePresenceVisibilityPage([pair], db, database, true)).resolves.toMatchObject({refreshed: 1});
    await assertFails(get(ref(client, `presenceStatus/${pair.targetUserId}`)));
    expect(
      (await database.ref(`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`).get()).child("allowed").val(),
    ).toBe(false);
    expect((await database.ref("unrelated").get()).val()).toEqual({preserve: true});
  },
);

it.each(["viewer", "target"])(
  "cleans a stale edge only after the deleted %s's earlier operations drain",
  async (owner) => {
    /** Synthetic server-owned relationship defines the scope under test. */
    const pair = await seed(),
      id = owner === "viewer" ? pair.viewerUserId : pair.targetUserId;
    /** Permanent deletion guard and prior lease use the production store names. */
    const guard = db.doc(`jestAccountDeletionTombstones/${id}`),
      lease = guard.collection("activeOperations").doc("earlier-writer");
    await guard.set({recreationBlocked: true});
    await lease.set({expiresAt: new Date(0)});
    /** Compare the entire fixture database to catch writes outside the selected edge. */
    const before = (await database.ref().get()).val();
    await expect(reconcilePresenceVisibilityPage([pair], db, database, true)).resolves.toMatchObject({
      processed: 0,
      busy: true,
      deletedOwnerEdgesRemoved: 0,
    });
    expect((await database.ref().get()).val()).toEqual(before);
    expect((await lease.get()).exists).toBe(true);
    await lease.delete();
    await expect(reconcilePresenceVisibilityPage([pair], db, database, true)).resolves.toMatchObject({
      processed: 1,
      busy: false,
      deletedOwnerEdgesRemoved: 1,
    });
    expect((await database.ref(`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`).get()).exists()).toBe(
      false,
    );
    expect((await database.ref(`presenceViewers/${pair.targetUserId}/${pair.viewerUserId}`).get()).exists()).toBe(
      false,
    );
    expect((await guard.get()).exists).toBe(true);
    expect((await database.ref("unrelated").get()).val()).toEqual({preserve: true});
  },
);

it("returns the exact completed prefix when a later owner is busy, then resumes without touching that prefix", async () => {
  /** Distinct native identities preserve provider isolation while sharing the global authority. */
  const first = await seed("facebook"),
    second = await seed("jest");
  /** The second edge cannot be removed until its existing writer actually finishes. */
  const guard = db.doc(`jestAccountDeletionTombstones/${second.targetUserId}`),
    lease = guard.collection("activeOperations").doc("running");
  await guard.set({recreationBlocked: true});
  await lease.set({expiresAt: new Date(0)});
  await expect(reconcilePresenceVisibilityPage([first, second], db, database, true)).resolves.toMatchObject({
    processed: 1,
    refreshed: 1,
    busy: true,
  });
  /** A resume cursor starts at the unfinished edge rather than repeating completed work. */
  const firstPermission =
    (await database.ref(`presenceVisibility/${first.viewerUserId}/${first.targetUserId}`).get()).val();
  await lease.delete();
  await expect(reconcilePresenceVisibilityPage([second], db, database, true)).resolves.toMatchObject({
    processed: 1,
    deletedOwnerEdgesRemoved: 1,
    busy: false,
  });
  expect((await database.ref(`presenceVisibility/${first.viewerUserId}/${first.targetUserId}`).get()).val()).toEqual(
    firstPermission,
  );
  expect((await database.ref(`presenceVisibility/${second.viewerUserId}/${second.targetUserId}`).get()).exists()).toBe(
    false,
  );
});

it("rejects invalid page scope and corrupt stored revisions before making a partial write", async () => {
  /** Synthetic server-owned relationship defines the scope under test. */
  const pair = await seed(),
    before = (await database.ref().get()).val();
  await expect(
    reconcilePresenceVisibilityPage([pair, {viewerUserId: "../escape", targetUserId: "target"}], db, database, true),
  ).rejects.toThrow("invalid-presence-reconciliation-pair");
  expect((await database.ref().get()).val()).toEqual(before);
  await database
    .ref(`presenceVisibility/${pair.viewerUserId}/${pair.targetUserId}`)
    .set({allowed: true, revision: "bad"});
  await expect(reconcilePresenceVisibilityPage([pair], db, database)).resolves.toMatchObject({
    invalid: 1,
    refreshed: 0,
  });
  await expect(reconcilePresenceVisibilityPage([pair], db, database, true)).rejects.toThrow(
    "invalid-presence-reconciliation-record",
  );
});

it("runs the actual CLI preview and hash-confirmed apply against production services in the private emulator", async () => {
  /** Synthetic server-owned relationship defines the scope under test. */
  const pair = await seed();
  /** Private local inventory is synthetic and removed after the actual CLI run. */
  const directory = mkdtempSync(join(tmpdir(), "presence-reconciliation-")),
    input = join(directory, "pairs.json");
  /** The production CLI is compared byte-for-byte with its isolated compiled copy. */
  const cli =
    process.env.PRESENCE_RECONCILIATION_CLI ?? join(__dirname, "../../scripts/maintenance/presence-visibility-reconcile.js");
  expect(readFileSync(cli, "utf8")).toBe(
    readFileSync(join(__dirname, "../../scripts/maintenance/presence-visibility-reconcile.js"), "utf8"),
  );
  writeFileSync(input, JSON.stringify([pair]), {mode: 0o600});
  /** Every storage scope is explicit and constrained to the same private demo. */
  const args = [cli, "--project", PROJECT, "--database-url", `https://${PROJECT}.firebaseio.com`, "--input", input];
  /** The actual operator path selects the repository's pinned Functions runtime. */
  const runner = join(__dirname, "../../scripts/runtime/run-with-functions-node.js");
  /** Execute the unchanged CLI through that wrapper without shell interpolation. */
  const invokeCli = (tail: string[] = []) =>
    JSON.parse(execFileSync(process.execPath, [runner, ...args, ...tail], {env: process.env, encoding: "utf8"}));
  try {
    /** Compare the entire fixture database to catch writes outside the selected edge. */
    const before = (await database.ref().get()).val();
    /** Capture the actual read-only CLI hash and cursor. */
    const preview = invokeCli();
    expect(preview).toMatchObject({mode: "dry-run", legacy: 1, refreshed: 0, globalCoverageVerified: false});
    expect((await database.ref().get()).val()).toEqual(before);
    // Authorization can change after preview; the inventory hash never freezes a grant.
    await db.doc(`users/${pair.targetUserId}/blockedRivals/${pair.viewerUserId}`).set({blockedAtMs: 2});
    /** Apply the exact reviewed inventory while recomputing current source authorization. */
    const applied = invokeCli(["--apply", "--confirm-project", PROJECT, "--expect-sha256", preview.inputSha256]);
    expect(applied).toMatchObject({
      mode: "apply",
      processed: 1,
      refreshed: 1,
      reachedInventoryEnd: true,
      globalCoverageVerified: false,
    });
    expect(applied.node).toBe(`v${readFileSync(join(__dirname, "../../.nvmrc"), "utf8").trim()}`);
    expect(JSON.stringify(applied)).not.toContain(pair.viewerUserId);
    await assertFails(
      get(
        ref(
          environment.authenticatedContext(pair.viewerUserId, {provider: "facebook"}).database(),
          `presenceStatus/${pair.targetUserId}`,
        ),
      ),
    );
    expect((await db.collectionGroup("activeOperations").get()).empty).toBe(true);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
