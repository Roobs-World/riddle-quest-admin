import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  FACEBOOK_NOTIFICATION_REPROMPT_MS,
  acceptFacebookNotificationPrompt,
  claimFacebookNotificationPrompt,
} from "../facebookNotificationPrompts";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Provides uid behavior. */
const uid = `facebook_${"b".repeat(40)}`;
/** Provides now ms behavior. */
const nowMs = Date.parse("2026-08-20T12:00:00.000Z");
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await db.recursiveDelete(db.collection("facebookNotificationPromptLeases"));
  await db.doc(`users/${uid}`).set({stats: {wins: 1, totalWins: 1, multiplayerWins: 0}});
});

afterAll(async () => {
  await db.recursiveDelete(db.collection("facebookNotificationPromptLeases"));
  await db.doc(`users/${uid}`).delete();
});

it("grants one cross-device weekly lease transactionally and restores durable acceptance", async () => {
  /** Provides claims behavior. */
  const claims = await Promise.all(Array.from({length: 8}, () => claimFacebookNotificationPrompt(uid, {db, nowMs})));
  expect(claims.filter(({granted}) => granted)).toEqual([{granted: true, claimedAtMs: nowMs}]);
  expect(claims.filter(({granted}) => !granted)).toHaveLength(7);
  await expect(
    claimFacebookNotificationPrompt(uid, {
      db,
      nowMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS - 1,
    }),
  ).resolves.toEqual({granted: false});
  await expect(
    claimFacebookNotificationPrompt(uid, {
      db,
      nowMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS,
    }),
  ).resolves.toEqual({granted: true, claimedAtMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS});

  await acceptFacebookNotificationPrompt(uid, {db, nowMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS + 1});
  await acceptFacebookNotificationPrompt(uid, {db, nowMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS + 2});
  await expect(
    claimFacebookNotificationPrompt(uid, {
      db,
      nowMs: nowMs + FACEBOOK_NOTIFICATION_REPROMPT_MS * 10,
    }),
  ).resolves.toEqual({granted: false});
  expect((await db.doc(`facebookNotificationPromptLeases/${uid}`).get()).data()).toMatchObject({
    schemaVersion: 1,
    uid,
    accepted: true,
  });
});
