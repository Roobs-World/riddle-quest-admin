import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {REDDIT_REFERRAL_REWARD_COINS, settleRedditReferralAfterAuthoritativeWin} from "../reddit/redditReferrals";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Provides inviter uid behavior. */
const inviterUid = `reddit_${"a".repeat(40)}`;
/** Provides invitees behavior. */
const invitees = Array.from({length: 6}, (_, index) => `reddit_${String(index + 1).repeat(40)}`);
/** Provides now behavior. */
const now = Date.parse("2026-08-19T12:00:00.000Z");
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(
    [
      "users",
      "redditReferralBindings",
      "redditReferralDailyCaps",
      "redditReferralSettlements",
      "jestAccountDeletionTombstones",
    ].map((collection) => db.recursiveDelete(db.collection(collection))),
  );
  /** Provides batch behavior. */
  const batch = db.batch();
  batch.set(db.doc(`users/${inviterUid}`), {
    coins: 300,
    hasPurchasedApp: false,
    stats: {wins: 10, gamesPlayed: 10},
  });
  invitees.forEach((inviteeUid) => {
    batch.set(db.doc(`users/${inviteeUid}`), {
      coins: 325,
      hasPurchasedApp: false,
      stats: {wins: 1, gamesPlayed: 1},
    });
    batch.set(db.doc(`redditReferralBindings/${inviteeUid}`), {
      provider: "reddit",
      inviteeUid,
      inviterUid,
      tokenId: Buffer.from(inviteeUid).toString("hex").slice(0, 64).padEnd(64, "0"),
      boundAtMs: now - 1_000,
      settledAtMs: null,
    });
  });
  await batch.commit();
});

afterAll(async () => {
  await Promise.all(
    [
      "users",
      "redditReferralBindings",
      "redditReferralDailyCaps",
      "redditReferralSettlements",
      "jestAccountDeletionTombstones",
    ].map((collection) => db.recursiveDelete(db.collection(collection))),
  );
});

it("transactionally limits six concurrent settlements to five inviter rewards", async () => {
  /** Provides first behavior. */
  const first = await Promise.all(
    invitees.map((inviteeUid) => settleRedditReferralAfterAuthoritativeWin(inviteeUid, now, db)),
  );
  expect(first.reduce((total, result) => total + result.inviteeCoins, 0)).toBe(6 * REDDIT_REFERRAL_REWARD_COINS);
  expect(first.reduce((total, result) => total + result.inviterCoins, 0)).toBe(5 * REDDIT_REFERRAL_REWARD_COINS);
  expect((await db.doc(`users/${inviterUid}`).get()).data()?.coins).toBe(800);
  for (const inviteeUid of invitees) {
    expect((await db.doc(`users/${inviteeUid}`).get()).data()?.coins).toBe(425);
  }
  /** Provides caps behavior. */
  const caps = await db.collection("redditReferralDailyCaps").get();
  expect(caps.size).toBe(1);
  expect(caps.docs[0].data().count).toBe(5);
  expect((await db.collection("redditReferralSettlements").get()).size).toBe(6);

  /** Provides replay behavior. */
  const replay = await Promise.all(
    invitees.map((inviteeUid) => settleRedditReferralAfterAuthoritativeWin(inviteeUid, now + 1, db)),
  );
  expect(replay.every((result) => result.alreadySettled)).toBe(true);
  expect((await db.doc(`users/${inviterUid}`).get()).data()?.coins).toBe(800);
});
