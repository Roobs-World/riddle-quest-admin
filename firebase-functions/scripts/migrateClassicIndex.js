const admin = require("firebase-admin");
const serviceAccount = require("../Riddle Quest-admin-sdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  console.log("Querying users with classicIndex: 0...");

  const snapshot = await db
    .collection("users")
    .where("progress.classicIndex", "==", 0)
    .get();

  if (snapshot.empty) {
    console.log("No users with classicIndex: 0 found. Nothing to migrate.");
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} user(s) to update.`);

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { "progress.classicIndex": 1 });
  });

  await batch.commit();
  console.log(`Done. Updated ${snapshot.size} user(s) to classicIndex: 1.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
