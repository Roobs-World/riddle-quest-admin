import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  joinFacebookContextCompetition,
  removeUserFromFacebookContextCompetitions,
} from "../../race/facebookContextService";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the a interface. */
const A = `facebook_${"a".repeat(40)}`;
/** Renders the b interface. */
const B = `facebook_${"b".repeat(40)}`;
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(["users", "facebookContextCompetitions"].map((name) => db.recursiveDelete(db.collection(name))));
  await Promise.all([db.doc(`users/${A}`).set({coins: 300}), db.doc(`users/${B}`).set({coins: 300})]);
});

afterAll(async () => {
  await Promise.all(["users", "facebookContextCompetitions"].map((name) => db.recursiveDelete(db.collection(name))));
});

it("converges simultaneous context joins on one host and bilateral relationship", async () => {
  /** Provides now ms behavior. */
  const nowMs = Date.UTC(2026, 7, 19);
  /** Provides [left, right] behavior. */
  const [left, right] = await Promise.all([
    joinFacebookContextCompetition(
      {
        userId: B,
        contextId: "concurrent-thread",
        contextType: "THREAD",
        locale: "ko",
        nowMs,
      },
      db,
    ),
    joinFacebookContextCompetition(
      {
        userId: A,
        contextId: "concurrent-thread",
        contextType: "THREAD",
        locale: "ko",
        nowMs,
      },
      db,
    ),
  ]);
  expect([left.members.length, right.members.length]).toContain(2);
  /** Provides boards behavior. */
  const boards = await db.collection("facebookContextCompetitions").get();
  expect(boards.size).toBe(1);
  expect(boards.docs[0].data()).toMatchObject({hostUserId: A, locale: "ko"});
  expect(boards.docs[0].data().members).toHaveLength(2);
  await expect(db.doc(`users/${A}/knownRivals/${B}`).get()).resolves.toMatchObject({exists: true});
  await expect(db.doc(`users/${B}/knownRivals/${A}`).get()).resolves.toMatchObject({exists: true});

  await removeUserFromFacebookContextCompetitions(A, db);
  /** Provides after host deletion behavior. */
  const afterHostDeletion = await boards.docs[0].ref.get();
  expect(afterHostDeletion.data()).toMatchObject({hostUserId: B, memberIds: [B]});
  expect(JSON.stringify(afterHostDeletion.data())).not.toContain(A);

  await removeUserFromFacebookContextCompetitions(B, db);
  await expect(boards.docs[0].ref.get()).resolves.toMatchObject({exists: false});
});
