import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";

/** Real authority seam for the injected browser harness; never contacts production. */
export async function createLiveRaceEmulator({provider = "jest"} = {}) {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Live browser tests require Firestore emulator");
  const projectId = process.env.GCLOUD_PROJECT ?? "demo-riddle-quest-live-browser";
  if (!projectId.startsWith("demo-")) throw new Error("Live browser fixtures require a demo project");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const require = createRequire(path.join(root, "firebase-functions/package.json"));
  const {getApps, initializeApp} = require("firebase-admin/app");
  if (!getApps().length) initializeApp({projectId});
  const {getFirestore} = require("firebase-admin/firestore");
  const db = getFirestore();
  const {joinLiveRaceForUser, updateLiveRaceForUser} = require(path.join(root, "firebase-functions/lib/firebase-functions/src/race/live/raceLiveService.js"));
  const {getLiveRaceChallengeForUser} = require(path.join(root, "firebase-functions/lib/firebase-functions/src/race/invitations/raceLiveInvitation.js"));
  const {sendLiveRaceChallengeForUser, listLiveRaceChallengesForUser} = require(path.join(root, "firebase-functions/lib/firebase-functions/src/race/invitations/raceLiveChallengeNotifications.js"));
  const {createUsernameReservationFields} = require(path.join(root, "firebase-functions/lib/firebase-functions/src/profile/usernameReservations.js"));
  const {JoinLiveRaceSchema, UpdateLiveRaceSchema} = require(path.join(root, "firebase-functions/lib/src/races/contracts/index.js"));
  const users = {Alice: `${provider}_${"a".repeat(40)}`, Bob: `${provider}_${"b".repeat(40)}`};
  const tickets = new Map();
  let clockOffsetMs = 0, lastCommitAtMs = 0;
  async function clear() {
    for (const collection of ["jestAccountDeletionTombstones", "liveRaceSignals", "liveRaceTickets", "liveRaceMatches", "liveRaceQueues", "liveRacePlayers", "users", "usernameReservations", "liveRacePushOutbox", "localizedRiddles/en/riddles"])
      await db.recursiveDelete(db.collection(collection));
    tickets.clear();
  }
  async function reset() {
    await clear();
    clockOffsetMs = 0;
    const batch = db.batch();
    for (const [name, uid] of Object.entries(users)) batch.set(db.doc(`users/${uid}`), {
      username: name, coins: 100, avatarUrl: `https://live-race.invalid/${name}.svg`, ...createUsernameReservationFields(name),
    });
    for (const [name, uid] of Object.entries(users)) batch.set(db.doc(`usernameReservations/${createUsernameReservationFields(name).usernameReservationId}`), {userId: uid, username: name});
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
    if (operation === "challenge") return getLiveRaceChallengeForUser(uid, command.challengeId, {db});
    if (operation === "sendChallenge") return sendLiveRaceChallengeForUser(db, uid, command);
    if (operation === "inbox") return listLiveRaceChallengesForUser(db, uid);
    const result = operation === "join"
      ? await joinLiveRaceForUser(uid, JoinLiveRaceSchema.parse(command), {db, nowMs: Date.now() + clockOffsetMs})
      : await updateLiveRaceForUser(uid, UpdateLiveRaceSchema.parse(command), {db, nowMs: Date.now() + clockOffsetMs});
    if (command.action === "guess") lastCommitAtMs = Date.now();
    tickets.set(user, result.ticketId);
    return result;
  }
  async function answer(user) {
    const ticket = (await db.doc(`liveRaceTickets/${tickets.get(user)}`).get()).data();
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data();
    const run = match.runs[match.tickets[0] === tickets.get(user) ? 0 : 1];
    return run.riddles[run.currentPosition].answer;
  }
  async function expireSearch(user, elapsedMs = 60000) {
    await db.doc(`liveRaceTickets/${tickets.get(user)}`).update({createdAtMs: Date.now() - elapsedMs});
  }
  async function balances() {
    const values = await db.getAll(...Object.values(users).map(uid => db.doc(`users/${uid}`)));
    return values.map(value => value.data().coins);
  }
  async function publicMatchEvidence() {
    const seats = await Promise.all(Object.entries(users).map(async ([name, uid]) => {
      const account = (await db.doc(`users/${uid}`).get()).data();
      const reservation = account?.usernameReservationId ?
        (await db.doc(`usernameReservations/${account.usernameReservationId}`).get()).data() : undefined;
      const ticketId = tickets.get(name);
      const ticket = ticketId ? (await db.doc(`liveRaceTickets/${ticketId}`).get()).data() : undefined;
      return {name, registered: reservation?.userId === uid, uid, ticketId,
        ownerId: ticket?.userId, privateChallenge: Boolean(ticket?.privateChallenge), matchId: ticket?.matchId};
    }));
    const matchId = seats[0]?.matchId;
    const match = matchId ? (await db.doc(`liveRaceMatches/${matchId}`).get()).data() : undefined;
    const queues = await db.collection("liveRaceQueues").get();
    return {seats, match: match ? {tickets: match.tickets, participantIds: match.participantIds,
      startsAtMs: match.startsAtMs, humanPlayers: match.players.every(player => player.bot === false)} : null,
    queuedTicketIds: queues.docs.flatMap(queue => queue.data().tickets ?? [])};
  }
  /** Advances only the injected server clock to the finished player's adjusted deadline. */
  async function expireFinishWindow(user) {
    const ticket = (await db.doc(`liveRaceTickets/${tickets.get(user)}`).get()).data();
    const match = (await db.doc(`liveRaceMatches/${ticket.matchId}`).get()).data();
    const run = match.runs[match.tickets[0] === tickets.get(user) ? 0 : 1];
    if (run.status !== "completed") throw new Error("Finish-window fixture requires a completed run");
    clockOffsetMs = run.finishedAtMs + run.hintPenaltyMs + run.skipPenaltyMs - Date.now();
  }
  return {observe(user, ticketId, onChange, onComplete) {
    if (tickets.get(user) !== ticketId) throw new Error("Unknown live seat");
    const {streamLiveRaceChanges} = require(path.join(root, "firebase-functions/lib/firebase-functions/src/race/live/raceLiveStream.js"));
    const controller = new AbortController();
    void streamLiveRaceChanges(db, users[user], ticketId, {signal:controller.signal,sendChunk:async chunk=>onChange(chunk)}, 45_000).then(()=>onComplete?.(), error=>onComplete?.(error));
    return ()=>controller.abort();
  }, lastCommitAt:()=>lastCommitAtMs, reset, clear, call, answer, expireSearch, expireFinishWindow, balances, publicMatchEvidence};
}
