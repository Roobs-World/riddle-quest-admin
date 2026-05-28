/*
Read and validate the productPricing documents seeded by scripts/seedProductPricing.js
Usage:
  Set GOOGLE_APPLICATION_CREDENTIALS then:
    node scripts/checkProductPricing.js

Outputs a JSON list of docs and a short validation summary.
*/

const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Please set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON");
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection("productPricing").get();
    const docs = [];
    snap.forEach((d) => docs.push({id: d.id, data: d.data()}));

    console.log(JSON.stringify(docs, null, 2));

    const expected = [
      "com.roobsworld.riddlequest.coinpack1",
      "com.roobsworld.riddlequest.coinpack2",
      "com.roobsworld.riddlequest.coinpack3",
      "com.roobsworld.riddlequest.coinpack4",
      "com.roobsworld.riddlequest.coinpack5",
      "com.roobsworld.riddlequest.coinpack6",
    ];

    const foundIds = docs.map((d) => d.id).sort();
    const missing = expected.filter((e) => !foundIds.includes(e));
    const extra = foundIds.filter((f) => !expected.includes(f));

    let ok = true;
    if (missing.length) {
      console.error("Missing productPricing docs:", missing);
      ok = false;
    }
    if (extra.length) {
      console.warn("Extra productPricing docs found:", extra);
    }

    // Basic field validation
    const invalid = docs.filter((d) => {
      const data = d.data || d.data;
      if (!data) return true;
      if (typeof data.coins !== "number") return true;
      if (typeof data.productKey !== "string") return true;
      if (!Array.isArray(data.regionalPrices)) return true;
      return false;
    });

    if (invalid.length) {
      console.error(
        "Some docs failed basic schema checks:",
        invalid.map((d) => d.id),
      );
      ok = false;
    }

    console.log("\nSummary:");
    console.log("  docsFound:", docs.length);
    console.log("  missing:", missing.length ? missing : "none");
    console.log("  extra:", extra.length ? extra : "none");
    console.log("  invalidDocs:", invalid.length ? invalid.map((d) => d.id) : "none");

    process.exit(ok ? 0 : 2);
  } catch (err) {
    console.error("Error reading productPricing:", err);
    process.exit(3);
  }
}

run();
