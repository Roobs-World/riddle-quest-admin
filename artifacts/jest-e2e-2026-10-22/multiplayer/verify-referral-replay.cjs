const assert = require("node:assert/strict");
const path = require("node:path");
const {createRequire} = require("node:module");
const load = createRequire(path.resolve("firebase-functions/package.json"));
assert.match(process.env.FIRESTORE_EMULATOR_HOST || "", /^127\.0\.0\.1:19799$/);
const projectId = "demo-rq-e2e-referrals";
const {initializeApp, deleteApp} = load("firebase-admin/app");
const {getFirestore} = load("firebase-admin/firestore");
const {grantJestReferralRewards} = load(path.resolve("firebase-functions/lib/jest/jestReferralGrant.js"));
const {createJestReferralRewardId} = load(path.resolve("firebase-functions/lib/jest/jestReferralReceipts.js"));
const {jestFirebaseUid} = load(path.resolve("firebase-functions/lib/jest/jestSecurity.js"));
const {JEST_REFERRAL_REWARD_COINS} = load("@qwordly/core/referrals");
const app = initializeApp({projectId}, "referral-replay-verification");
const db = getFirestore(app);
const inviter = "local-verification-inviter", invitee = "local-verification-invitee";
const conversions = [{playerId:invitee, joinedAt:"2026-10-22T00:00:00.000Z", reference:"riddle_quest_friend_challenge_v2"}];
const inviterRef = db.doc(`users/${jestFirebaseUid(inviter)}`);
const inviteeRef = db.doc(`users/${jestFirebaseUid(invitee)}`);
const receiptRef = db.doc(`jestReferralRewards/${createJestReferralRewardId(inviter, invitee)}`);
async function clear() {
  for (const collection of ["users","jestReferralRewards","jestReferralVerifications","jestAccountDeletionTombstones"])
    await db.recursiveDelete(db.collection(collection));
}
(async()=>{
 try {
  await clear(); await inviterRef.set({coins:100}); await inviteeRef.set({coins:200});
  const failedDb = {collection:db.collection.bind(db),runTransaction:async()=>{throw new Error("simulated pre-commit request failure");}};
  await assert.rejects(()=>grantJestReferralRewards(failedDb,inviter,conversions,conversions), /pre-commit/);
  assert.equal((await receiptRef.get()).exists,false);
  assert.equal((await inviterRef.get()).get("coins"),100);
  console.log("PASS failed pre-commit attempt leaves no receipt or wallet mutation");
  const first = await grantJestReferralRewards(db,inviter,conversions,conversions);
  assert.equal(first.rewardsGranted,1);
  console.log("PASS later reconciliation grants the previously uncommitted conversion");
  const replay = await Promise.all(Array.from({length:3},()=>grantJestReferralRewards(db,inviter,conversions,conversions)));
  assert.ok(replay.every(result=>result.rewardsGranted===0));
  assert.equal((await inviterRef.get()).get("coins"),100+JEST_REFERRAL_REWARD_COINS);
  assert.equal((await inviteeRef.get()).get("coins"),200+JEST_REFERRAL_REWARD_COINS);
  assert.equal((await db.collection("jestReferralRewards").get()).size,1);
  console.log("PASS ignored/lost success response plus concurrent replay credits both wallets exactly once");
 } finally {await clear(); await db.terminate(); await deleteApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
