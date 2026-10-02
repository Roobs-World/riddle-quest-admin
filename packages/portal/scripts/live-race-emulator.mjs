import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

/** Real authority seam for the injected browser harness; never contacts production. */
export async function createLiveRaceEmulator() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Live browser tests require Firestore emulator");
  const projectId = process.env.GCLOUD_PROJECT ?? "demo-riddle-quest-live-browser";
  if (!projectId.startsWith("demo-")) throw new Error("Live browser fixtures require a demo project");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const require = createRequire(path.join(root, "firebase-functions/package.json"));
  const {getApps, initializeApp} = require("firebase-admin/app");
  if (!getApps().length) initializeApp({projectId});
  const {getFirestore} = require("firebase-admin/firestore");
  const db = getFirestore();
  const {joinLiveRaceForUser, updateLiveRaceForUser} = require(path.join(root, "firebase-functions/lib/race/raceLiveService.js"));
  const {JoinLiveRaceSchema, UpdateLiveRaceSchema} = require("@qwordly/core/race");
  const users = {Alice: `jest_${"a".repeat(40)}`, Bob: `jest_${"b".repeat(40)}`};
  const tickets = new Map();
  async function clear() {
    for (const collection of ["liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "users", "localizedRiddles/en/riddles"])
      await db.recursiveDelete(db.collection(collection));
    tickets.clear();
  }
  async function reset() {
    await clear();
    const batch = db.batch();
    for (const [name, uid] of Object.entries(users)) batch.set(db.doc(`users/${uid}`), {
      username: name, coins: 100, avatarUrl: `https://live-race.invalid/${name}.svg`,
    });
    for (const categoryId of ["history", "mixed"]) for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/${categoryId}-${index}`), {
      riddleId: `${categoryId}-${index}`, canonicalRiddleId: `${categoryId}:${index}`, categoryId,
      text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
      difficultyBand: (["easy", "medium", "hard"])[index % 3], raceEligible: true, qualityVersion: "human_review_v1",
    });
    await batch.commit();
  }
  async function call(operation, input) {
    const {user, ...command} = input;
    const uid = users[user];
    if (!uid) throw new Error("Unknown browser fixture owner");
    const result = operation === "join"
      ? await joinLiveRaceForUser(uid, JoinLiveRaceSchema.parse(command), {db})
      : await updateLiveRaceForUser(uid, UpdateLiveRaceSchema.parse(command), {db});
    tickets.set(user, result.ticketId);
    return result;
  }
  async function answer(user) {
    const ticket = (await db.doc(`liveRaceTickets/${tickets.get(user)}`).get()).data();
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data();
    const run = match.runs[match.tickets[0] === tickets.get(user) ? 0 : 1];
    return run.riddles[run.currentPosition].answer;
  }
  async function expireSearch(user) {
    await db.doc(`liveRaceTickets/${tickets.get(user)}`).update({createdAtMs: Date.now() - 60000});
  }
  async function balances() {
    const values = await db.getAll(...Object.values(users).map(uid => db.doc(`users/${uid}`)));
    return values.map(value => value.data().coins);
  }
  return {reset, clear, call, answer, expireSearch, balances};
}
