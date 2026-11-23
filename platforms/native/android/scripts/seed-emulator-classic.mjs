#!/usr/bin/env node
/**
 * Seeds the local Firestore emulator with Classic riddles from the bundled
 * content pack so hosted play can be exercised on a device without touching
 * production. Refuses to run unless FIRESTORE_EMULATOR_HOST is set.
 *
 * Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 node scripts/seed-emulator-classic.mjs [count]
 */
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageDirectory, "../../..");
/** firebase-admin ships with the backend package; the Android package never depends on it. */
const requireFromFunctions = createRequire(join(repositoryRoot, "firebase-functions/package.json"));
const {initializeApp} = requireFromFunctions("firebase-admin/app");
const {getFirestore} = requireFromFunctions("firebase-admin/firestore");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.stderr.write("Refusing to seed: FIRESTORE_EMULATOR_HOST is not set, so this would write to production.\n");
  process.exit(1);
}
const count = Number(process.argv[2] ?? 20);
const projectId = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
const content = JSON.parse(readFileSync(join(repositoryRoot, "src/web/playable/generated/youtube-content-v1.json"), "utf8"));
const english = content.packs.en;
/** Hosted single-player answers must be one to seven Latin letters and must not appear in the clue. */
const playable = content.classicOrder
  .map((id) => ({id, ...english[id]}))
  .filter(({text, answer}) => /^[a-z]{1,7}$/u.test(answer) && !text.toLowerCase().includes(answer.toLowerCase()))
  .slice(0, count);

const app = initializeApp({projectId});
const db = getFirestore(app);
const collection = db.collection("localizedRiddles").doc("en").collection("riddles");
const batch = db.batch();
playable.forEach(({id, text, answer, difficultyBand}, index) => {
  batch.set(collection.doc(id), {riddleId: id, text, answer, difficultyBand, classicIndex: index + 1, category: "classic"});
});
// Multiplayer uses the same reviewed bundled pack, with its category and quality metadata.
// These emulator-only records are not eligible for Classic unless the ordered seed above assigns an index.
Object.entries(english).forEach(([id, item]) => {
  batch.set(collection.doc(id), {riddleId: id, canonicalRiddleId: id, text: item.text, answer: item.answer,
    categoryId: item.categoryId, difficultyBand: item.difficultyBand, raceEligible: true, qualityVersion: "human_review_v1"}, {merge: true});
});
batch.set(db.doc("raceConfig/rollout"), {enabled: true, percentage: 100, allowlistHashes: []});
// Production completed the username-reservation migration; a fresh emulator has no marker, so renames would be refused.
batch.set(db.collection("usernameReservationMigrations").doc("v1"), {complete: true});
await batch.commit();
process.stdout.write(`Seeded ${playable.length} Classic riddles and ${Object.keys(english).length} multiplayer riddles into ${process.env.FIRESTORE_EMULATOR_HOST} (${projectId}); first answer "${playable[0]?.answer}"\n`);
