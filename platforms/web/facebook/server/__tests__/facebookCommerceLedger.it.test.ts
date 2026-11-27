import {ACCOUNT_DELETION_COLLECTION} from "../../../../../firebase-functions/src/shared/accountDeletion";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {grantVerifiedFacebookPurchase, refundVerifiedFacebookPurchase} from "../facebookCommerceLedger";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Renders the uid interface. */
const UID = `facebook_${"c".repeat(40)}`;
/** Defines the product id value. */
const PRODUCT_ID = "com.roobsworld.riddlequest.coinpack1";
/** Provides collections behavior. */
const collections = [
  "users",
  "facebookCommerceAccounts",
  "facebookCommerceReceipts",
  "facebookCommerceRefunds",
  ACCOUNT_DELETION_COLLECTION,
];
/** Provides db behavior. */
let db: FirebaseFirestore.Firestore;

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({projectId: PROJECT_ID});
  db = getFirestore();
  await Promise.all(collections.map((collection) => db.recursiveDelete(db.collection(collection))));
});

afterAll(async () => {
  await Promise.all(collections.map((collection) => db.recursiveDelete(db.collection(collection))));
});

it("converges concurrent purchase and refund replays without duplicating balance or debt", async () => {
  await db.doc(`users/${UID}`).set({coins: 300});
  /** Provides purchase behavior. */
  const purchase = {
    uid: UID,
    paymentId: "concurrent-payment-1",
    productId: PRODUCT_ID,
    purchaseToken: "concurrent-provider-token-1",
    purchasedAtMs: Date.UTC(2026, 7, 19),
  };
  /** Provides grants behavior. */
  const grants = await Promise.all(Array.from({length: 8}, () => grantVerifiedFacebookPurchase(db, purchase)));
  expect(grants.filter(({alreadyProcessed}) => !alreadyProcessed)).toHaveLength(1);
  expect(grants.filter(({alreadyProcessed}) => alreadyProcessed)).toHaveLength(7);
  expect((await db.doc(`users/${UID}`).get()).data()?.coins).toBe(550);
  expect((await db.collection("facebookCommerceReceipts").get()).size).toBe(1);

  // Simulate spending most of the purchased pack before the provider refund.
  await db.doc(`users/${UID}`).update({coins: 100});
  /** Provides refund behavior. */
  const refund = {
    eventId: "concurrent-refund-1",
    paymentId: purchase.paymentId,
    productId: PRODUCT_ID,
    refundedAtMs: Date.UTC(2026, 7, 20),
  };
  /** Provides refunds behavior. */
  const refunds = await Promise.all(Array.from({length: 8}, () => refundVerifiedFacebookPurchase(db, refund)));
  expect(refunds.filter(({alreadyProcessed}) => !alreadyProcessed)).toHaveLength(1);
  expect(refunds.reduce((total, result) => total + result.coinsRemoved, 0)).toBe(100);
  expect((await db.doc(`users/${UID}`).get()).data()?.coins).toBe(0);
  expect((await db.doc(`facebookCommerceAccounts/${UID}`).get()).data()).toMatchObject({coinDebt: 150});
  expect((await db.collection("facebookCommerceRefunds").get()).size).toBe(1);

  await expect(grantVerifiedFacebookPurchase(db, purchase)).resolves.toMatchObject({
    alreadyProcessed: true,
    coins: 0,
    coinDebt: 150,
  });

  /** Provides receipt behavior. */
  const receipt = (await db.collection("facebookCommerceReceipts").limit(1).get()).docs[0];
  /** Provides receipt data behavior. */
  const receiptData = receipt.data();
  await receipt.ref.set({
    provider: "facebook",
    replayProtection: true,
    productId: PRODUCT_ID,
    paymentIdHash: receipt.id,
    purchaseTokenHash: receiptData.purchaseTokenHash,
    refundedAtMs: receiptData.refundedAtMs,
  });
  await Promise.all([db.doc(`users/${UID}`).delete(), db.doc(`facebookCommerceAccounts/${UID}`).delete()]);
  /** Deletes d refund. */
  const deletedRefund = {...refund, eventId: "post-deletion-refund"};
  /** Deletes d retries. */
  const deletedRetries = await Promise.all(
    Array.from({length: 8}, () => refundVerifiedFacebookPurchase(db, deletedRefund)),
  );
  expect(deletedRetries.every(({accountDeleted, uid}) => accountDeleted && uid === null)).toBe(true);
  expect(deletedRetries.filter(({alreadyProcessed}) => !alreadyProcessed)).toHaveLength(1);
  expect((await db.doc(`users/${UID}`).get()).exists).toBe(false);
  expect((await db.doc(`facebookCommerceAccounts/${UID}`).get()).exists).toBe(false);
  expect((await db.collection("facebookCommerceRefunds").get()).size).toBe(2);
});
