import {deleteApp, getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {grantVerifiedRedditOrder, refundVerifiedRedditOrder} from "../reddit/redditCommerceLedger";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const UID = `reddit_${"c".repeat(40)}`;
let db: FirebaseFirestore.Firestore;
const collections = ["users", "redditCommerceAccounts", "redditCommerceReceipts", "redditCommerceRefunds", "accountDeletionOperations"];

beforeAll(async () => {
  process.env.REDDIT_APPROVED_FEATURES = "commerce";
  process.env.REDDIT_COMMERCE_SANDBOX_ENABLED = "1";
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name))));
});
afterAll(async () => {
  delete process.env.REDDIT_APPROVED_FEATURES;
  delete process.env.REDDIT_COMMERCE_SANDBOX_ENABLED;
  await Promise.all(collections.map((name) => db.recursiveDelete(db.collection(name))));
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

it("converges receipt and refund contention without double grant and repays hidden debt", async () => {
  await db.doc(`users/${UID}`).set({coins: 300});
  const order = {uid: UID, orderId: "contended-order", productId: "riddle_quest_coins_250" as const,
    environment: "sandbox" as const, purchasedAtMs: 1_000};
  const grants = await Promise.all(Array.from({length: 16}, () => grantVerifiedRedditOrder(db, order)));
  expect(grants.filter(({alreadyProcessed}) => !alreadyProcessed)).toHaveLength(1);
  expect((await db.doc(`users/${UID}`).get()).data()?.coins).toBe(550);
  expect((await db.collection("redditCommerceReceipts").get()).size).toBe(1);

  await db.doc(`users/${UID}`).update({coins: 50});
  const refund = {orderId: order.orderId, productId: order.productId,
    environment: order.environment, refundedAtMs: 2_000};
  const refunds = await Promise.all(Array.from({length: 12}, () => refundVerifiedRedditOrder(db, refund)));
  expect(refunds.filter(({alreadyProcessed}) => !alreadyProcessed)).toHaveLength(1);
  expect((await db.doc(`users/${UID}`).get()).data()?.coins).toBe(0);
  expect((await db.doc(`redditCommerceAccounts/${UID}`).get()).data()?.coinDebt).toBe(200);
  expect((await db.collection("redditCommerceRefunds").get()).size).toBe(1);

  await grantVerifiedRedditOrder(db, {uid: UID, orderId: "future-order",
    productId: "riddle_quest_coins_550", environment: "sandbox", purchasedAtMs: 3_000});
  expect((await db.doc(`users/${UID}`).get()).data()?.coins).toBe(350);
  expect((await db.doc(`redditCommerceAccounts/${UID}`).get()).data()?.coinDebt).toBe(0);
});
