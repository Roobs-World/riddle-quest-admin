import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES, type RequestRaceHintResponse} from "../../../../src/core/race/index.js";
import {requestRaceHintForUser, skipRaceRiddleForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";

/** Local demo storage is required for public replay acceptance regressions. */
let db: FirebaseFirestore.Firestore;
/** Original hint must remain replayable after later accepted progress. */
const input = {runId: "progress-run", riddleId: "q-0", requestId: "progress-hint"};
/** Individually parseable replies must still describe a possible accepted checkpoint. */
const corruptions: [string, (response: RequestRaceHintResponse) => void][] = [
  ["phantom score", response => {response.run.correctCount = 9;}],
  ["erased charge", response => {response.run.totalPenaltyMs = 0; response.run.adjustedElapsedMs = response.run.wallElapsedMs;}],
  ["invented charge", response => {response.run.totalPenaltyMs *= 2; response.run.adjustedElapsedMs += RACE_RULES.hintPenaltyMs;}],
  ["altered accepted history", response => {response.run.events[0].wallElapsedMs--; response.run.events[0].adjustedElapsedMs--;}],
  ["terminal reply before completion", response => {response.run.status = "completed"; response.run.currentRiddle = null;}],
  ["preparation after a hint", response => {response.run.status = "prepared";}],
  ["wrong clock sum", response => {response.run.adjustedElapsedMs++;}],
  ["unsafe clock", response => {response.run.wallElapsedMs = Number.MAX_SAFE_INTEGER + 1;
    response.run.adjustedElapsedMs = response.run.wallElapsedMs + response.run.totalPenaltyMs;}],
  ["future accepted clock", response => {response.run.serverNowMs = 9000;}],
];
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("receipt-progress-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/progress-run"));
  await db.doc("users/progress-player").set({displayName: "Player", coins: 100});
  await db.doc("raceRuns/progress-run").set({recordVersion: 1, runId: "progress-run", userId: "progress-player", role: "creator",
    status: "active", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "progress-deck",
    riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
      text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
    startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
});

it.each(corruptions)("rejects cached %s without changing accepted progress, then replays the explicitly repaired checkpoint", async (_name, corrupt) => {
  /** Real commands establish both the historical receipt and a newer canonical checkpoint. */
  const original = await requestRaceHintForUser("progress-player", input, {db, nowMs: 2000});
  await skipRaceRiddleForUser("progress-player", {...input, requestId: "progress-skip"}, {db, nowMs: 3000});
  /** Original persisted response is repair evidence, not newly generated authority. */
  const ref = db.doc(`raceRuns/progress-run/requests/${requestDocumentId("progress-player", input.requestId)}`);
  /** Complete receipt metadata remains intact; only response progress is damaged. */
  const receipt = (await ref.get()).data()!;
  /** Clone only the public checkpoint so TTL timestamp values remain intact. */
  const damaged: RequestRaceHintResponse = JSON.parse(JSON.stringify(receipt.response));
  corrupt(damaged);
  await ref.update({response: damaged});
  /** Accepted canonical progress cannot be replaced or charged by malformed replay. */
  const run = (await db.doc("raceRuns/progress-run").get()).data();
  /** Complete currency/progress snapshot catches dependent writes. */
  const account = (await db.doc("users/progress-player").get()).data();
  await expect(requestRaceHintForUser("progress-player", input, {db, nowMs: 4000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/progress-run").get()).data()).toEqual(run);
  expect((await db.doc("users/progress-player").get()).data()).toEqual(account);
  expect((await ref.get()).data()?.response).toEqual(damaged);
  await ref.update({response: receipt.response});
  expect(await Promise.all([0, 1].map(() => requestRaceHintForUser("progress-player", input, {db, nowMs: 5000}))))
    .toEqual([original, original]);
});
