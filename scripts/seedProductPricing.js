/*
Seed Firestore `productPricing` collection with coin pack entries.

Usage:
  Set `GOOGLE_APPLICATION_CREDENTIALS` to your service account JSON path, then:

  node scripts/seedProductPricing.js

This script uses the default application credentials (service account) to
initialize the Admin SDK and upserts documents in `productPricing`.
*/

const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Please set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file.");
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

const products = [
  {
    productId: "com.roobsworld.riddlequest.coinpack1",
    productKey: "COIN_PACK_TINY",
    coins: 250,
    sortOrder: 1,
    featuredOrder: 1,
    featuredBadge: "STARTER",
    regionalPrices: [{currency: "USD", displayPrice: "$0.99"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack2",
    productKey: "COIN_PACK_SMALL",
    coins: 550,
    sortOrder: 2,
    featuredOrder: null,
    regionalPrices: [{currency: "USD", displayPrice: "$1.99"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack3",
    productKey: "COIN_PACK_MID",
    coins: 900,
    sortOrder: 3,
    featuredOrder: null,
    regionalPrices: [{currency: "USD", displayPrice: "$2.99"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack4",
    productKey: "COIN_PACK_LARGE",
    coins: 1600,
    sortOrder: 4,
    featuredOrder: 2,
    featuredBadge: "POPULAR",
    regionalPrices: [{currency: "USD", displayPrice: "$4.99"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack5",
    productKey: "COIN_PACK_HUGE",
    coins: 3400,
    sortOrder: 5,
    featuredOrder: null,
    regionalPrices: [{currency: "USD", displayPrice: "$9.99"}],
  },
  {
    productId: "com.roobsworld.riddlequest.coinpack6",
    productKey: "COIN_PACK_MEGA",
    coins: 7000,
    sortOrder: 6,
    featuredOrder: 3,
    featuredBadge: "BEST VALUE",
    regionalPrices: [{currency: "USD", displayPrice: "$19.99"}],
  },
];

async function seed() {
  try {
    for (const p of products) {
      const docRef = db.collection("productPricing").doc(p.productId);
      await docRef.set(p, {merge: true});
      console.log(`Upserted productPricing/${p.productId}`);
    }
    console.log("Product pricing seed complete.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed productPricing:", err);
    process.exit(2);
  }
}

seed();
