import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {disconnectRedditPresence, pollRedditPresence} from "../reddit/redditPresence";
import {deletePresenceForUser} from "../presence/presenceVisibility";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "";
// Every destructive fixture operation requires the private loopback demo services.
if (
  !PROJECT_ID.startsWith("demo-") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "") ||
  !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")
)
  throw new Error("Private demo presence emulators required");
/** Renders the viewer interface. */
const VIEWER = `reddit_${"a".repeat(40)}`;
/** Renders the target interface. */
const TARGET = `reddit_${"b".repeat(40)}`;
/** Provides firestore behavior. */
let firestore: FirebaseFirestore.Firestore;
/** Provides database behavior. */
let database: ReturnType<typeof getDatabase>;

beforeAll(async () => {
  if (getApps().length === 0)
    initializeApp({
      projectId: PROJECT_ID,
      databaseURL: `http://127.0.0.1:${process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(":").at(-1) ?? "9000"}?ns=${PROJECT_ID}`,
    });
  firestore = getFirestore();
  database = getDatabase();
  await Promise.all([firestore.recursiveDelete(firestore.collection("users")), database.ref().remove()]);
});
afterAll(async () => {
  await Promise.all([firestore.recursiveDelete(firestore.collection("users")), database.ref().remove()]);
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

it("converges tabs, reconnects, blocks, opt-out and deletion without exposing strangers", async () => {
  await firestore
    .doc(`users/${VIEWER}/knownRivals/${TARGET}`)
    .set({targetUserId: TARGET, source: "completed_race", establishedAtMs: 1});
  await Promise.all([
    pollRedditPresence(
      TARGET,
      {sessionId: "desktop_session_1", state: "playing", enabled: true},
      {firestore, database, nowMs: 1_000},
    ),
    pollRedditPresence(
      TARGET,
      {sessionId: "phone_session_001", state: "racing", enabled: true},
      {firestore, database, nowMs: 1_001},
    ),
  ]);
  await expect(
    pollRedditPresence(
      VIEWER,
      {sessionId: "viewer_session_01", state: "online", enabled: true},
      {firestore, database, nowMs: 2_000},
    ),
  ).resolves.toEqual({rivals: [{userId: TARGET, state: "racing"}]});

  await disconnectRedditPresence(TARGET, "phone_session_001", {database, nowMs: 2_001});
  await expect(
    pollRedditPresence(
      VIEWER,
      {sessionId: "viewer_session_01", state: "online", enabled: true},
      {firestore, database, nowMs: 2_002},
    ),
  ).resolves.toEqual({rivals: [{userId: TARGET, state: "playing"}]});

  await firestore.doc(`users/${VIEWER}/blockedRivals/${TARGET}`).set({targetUserId: TARGET, blockedAtMs: 2_003});
  await expect(
    pollRedditPresence(
      VIEWER,
      {sessionId: "viewer_session_01", state: "online", enabled: true},
      {firestore, database, nowMs: 2_004},
    ),
  ).resolves.toEqual({rivals: [{userId: TARGET, state: "offline"}]});
  await firestore.doc(`users/${VIEWER}/blockedRivals/${TARGET}`).delete();

  await pollRedditPresence(
    TARGET,
    {sessionId: "desktop_session_1", state: "playing", enabled: false},
    {firestore, database, nowMs: 2_005},
  );
  await expect(
    pollRedditPresence(
      VIEWER,
      {sessionId: "viewer_session_01", state: "online", enabled: true},
      {firestore, database, nowMs: 2_006},
    ),
  ).resolves.toEqual({rivals: [{userId: TARGET, state: "offline"}]});

  await database
    .ref()
    .update({[`presenceVisibility/${VIEWER}/${TARGET}`]: true, [`presenceViewers/${TARGET}/${VIEWER}`]: true});
  await deletePresenceForUser(TARGET, database);
  for (const path of [
    `presenceConnections/${TARGET}`,
    `presenceConsent/${TARGET}`,
    `presenceStatus/${TARGET}`,
    `presenceOptIn/${TARGET}`,
    `presenceVisibility/${VIEWER}/${TARGET}`,
    `presenceViewers/${TARGET}/${VIEWER}`,
  ]) {
    expect((await database.ref(path).get()).exists()).toBe(false);
  }
});
