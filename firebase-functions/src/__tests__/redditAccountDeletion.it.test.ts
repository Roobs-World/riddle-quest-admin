import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {deleteRedditAccountGeneration} from "../reddit/redditAccountDeletion";
import {provisionRedditIdentity} from "../reddit/redditEndpoints";
import {redditFirebaseUid} from "../reddit/redditSecurity";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const APP_NAME = "riddle-quest";
const USER_ID = "t2_reddit-deletion-race";
const UID_SECRET = Buffer.alloc(32, 19).toString("base64");
const providerId = createHash("sha256").update(`reddit\0${APP_NAME}\0${USER_ID}`).digest("hex");
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection("providerIdentities"));
  await db.recursiveDelete(db.collection("users"));
  await db.recursiveDelete(db.collection("redditPlayerStorage"));
});

afterAll(async () => {
  await db.recursiveDelete(db.collection("providerIdentities"));
  await db.recursiveDelete(db.collection("users"));
  await db.recursiveDelete(db.collection("redditPlayerStorage"));
});

const deleteGeneration = (generation: number, deleteUser: (uid: string) => Promise<void>) =>
  deleteRedditAccountGeneration(
    {appName: APP_NAME, userId: USER_ID, accountGeneration: generation},
    {uidSecret: UID_SECRET, deleteUser},
  );

it("serializes concurrent deletion retries and never deletes a recreated generation", async () => {
  const firstUid = redditFirebaseUid(USER_ID, UID_SECRET, 1);
  const providerRef = db.collection("providerIdentities").doc(providerId);
  await Promise.all([
    providerRef.set({provider: "reddit", appName: APP_NAME, providerUserId: USER_ID, uid: firstUid, accountGeneration: 1, status: "active", redditProfile: {username: "Old_User", avatarUrl: null}}),
    db.collection("users").doc(firstUid).set({coins: 300}),
    db.collection("redditPlayerStorage").doc(firstUid).set({playerData: {schemaVersion: 1}}),
  ]);
  const deletedUids: string[] = [];
  const cleanup = async (uid: string) => {
    deletedUids.push(uid);
    await Promise.all([
      db.recursiveDelete(db.collection("users").doc(uid)),
      db.collection("redditPlayerStorage").doc(uid).delete(),
    ]);
  };

  await expect(Promise.all(Array.from({length: 8}, () => deleteGeneration(1, cleanup))))
    .resolves.toEqual(Array(8).fill(2));
  const completed = (await providerRef.get()).data();
  expect(completed).toMatchObject({uid: null, accountGeneration: 2, status: "active"});
  expect(completed).not.toHaveProperty("redditProfile");
  expect(completed?.lastDeletedUidHash).toBe(createHash("sha256").update(firstUid).digest("hex"));
  expect(await db.collection("users").doc(firstUid).get()).toMatchObject({exists: false});
  expect(await db.collection("redditPlayerStorage").doc(firstUid).get()).toMatchObject({exists: false});
  expect(deletedUids.every((uid) => uid === firstUid)).toBe(true);

  const secondUid = redditFirebaseUid(USER_ID, UID_SECRET, 2);
  const refreshedAtMs = 1_750_000_000_000;
  await expect(provisionRedditIdentity({
    appName: APP_NAME, userId: USER_ID, uidSecret: UID_SECRET,
    profile: {username: "Fresh_User", avatarUrl: "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png"},
  }, db, refreshedAtMs))
    .resolves.toEqual({uid: secondUid, accountGeneration: 2});
  deletedUids.length = 0;
  await expect(deleteGeneration(1, cleanup)).resolves.toBe(2);
  expect(deletedUids).toEqual([]);
  expect((await providerRef.get()).data()).toMatchObject({uid: secondUid, accountGeneration: 2, status: "active"});
  const refreshedProvider = (await providerRef.get()).data();
  expect(refreshedProvider?.redditProfile).toMatchObject({
    username: "Fresh_User", avatarUrl: "https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png",
  });
  expect(refreshedProvider?.redditProfile.refreshedAt.toMillis()).toBe(refreshedAtMs);
  expect(refreshedProvider?.redditProfile.expiresAt.toMillis()).toBe(refreshedAtMs + 24 * 60 * 60 * 1_000);
  expect((await db.collection("users").doc(secondUid).get()).data()).toMatchObject({
    userId: secondUid, coins: 300, hasPurchasedApp: false, hasActiveSubscription: false,
  });
});

it("retains deleting state after cleanup failure and safely resumes", async () => {
  const uid = redditFirebaseUid(USER_ID, UID_SECRET, 1);
  const providerRef = db.collection("providerIdentities").doc(providerId);
  await providerRef.set({provider: "reddit", appName: APP_NAME, providerUserId: USER_ID, uid, accountGeneration: 1, status: "active"});
  await expect(deleteGeneration(1, async () => { throw new Error("cleanup-failed"); }))
    .rejects.toThrow("cleanup-failed");
  expect((await providerRef.get()).data()).toMatchObject({uid, accountGeneration: 1, status: "deleting"});
  await expect(deleteGeneration(1, async () => undefined)).resolves.toBe(2);
  expect((await providerRef.get()).data()).toMatchObject({uid: null, accountGeneration: 2, status: "active"});
});
