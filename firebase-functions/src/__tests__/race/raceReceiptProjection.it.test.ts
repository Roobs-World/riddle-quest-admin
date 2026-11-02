import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {RACE_RULES, type RequestRaceHintResponse} from "@riddle-quest/core/race";
import {requestRaceHintForUser, skipRaceRiddleForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";

/** Public receipt recovery uses only the local demo emulator. */
let db: FirebaseFirestore.Firestore;
/** Immutable original hint intent remains identical through corruption and repair. */
const input = {runId: "projection-run", riddleId: "q-0", requestId: "projection-hint", includeEvaluation: true};
/** Independent valid-shape mutations exercise immutable response authority, not transport parsing. */
const corruptions: [string, (response: RequestRaceHintResponse) => void][] = [
  ["ghost finish", response => {response.run.opponent!.adjustedFinishMs++;}],
  ["ghost history", response => {response.run.opponent!.events = [{sequence: 0, type: "correct", riddlePosition: 0,
    correctCount: 1, wallElapsedMs: 1000, totalPenaltyMs: 0, adjustedElapsedMs: 1000, penaltyAddedMs: 0}];}],
  ["challenge", response => {response.run.challengeId = "another-challenge";}],
  ["start", response => {response.run.startsAtMs!++;}],
  ["prompt text", response => {response.run.currentRiddle!.text = "A different clue";}],
  ["prompt answer", response => {response.run.currentRiddle!.evaluation!.answer = "xxxx";}],
  ["prompt length", response => {response.run.currentRiddle!.answerLength++;}],
  ["deck answer", response => {response.run.preloadedRiddles![1].evaluation.answer = "xxxx";}],
  ["deck hint", response => {response.run.preloadedRiddles![1].hint!.letter = "x";}],
  ["selected hint", response => {response.revealedLetter = "x";}],
  ["unrevealed selected hint", response => {response.index = 1; response.revealedLetter = "e";}],
  ["revealed hint", response => {response.run.currentRiddle!.revealedLetters[0].letter = "x";}],
];
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("receipt-projection-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/projection-run"));
  await db.doc("jestAccountDeletionTombstones/projection-creator").delete();
  await db.doc("users/projection-player").set({displayName: "Player", coins: 100});
  await db.doc("raceRuns/projection-run").set({recordVersion: 1, runId: "projection-run", userId: "projection-player", role: "challenger",
    status: "active", challengeId: "projection-challenge", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version,
    deckId: "projection-deck", riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
      text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
    startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
    opponent: {displayName: "Creator", subjectUserId: "projection-creator", adjustedFinishMs: 500000, events: []}});
});

it("rejects damaged gameplay before privacy scrubbing, then repairs the receipt using only neutral opponent identity", async () => {
  /** Original accepted reply carries the then-current linked opponent presentation. */
  const original = await requestRaceHintForUser("projection-player", input, {db, nowMs: 2000});
  /** Owned receipt is captured before deletion changes presentation permissions. */
  const ref = db.doc(`raceRuns/projection-run/requests/${requestDocumentId("projection-player", input.requestId)}`);
  /** Immutable gameplay remains unchanged even when the identity is permanently deleted. */
  const receipt = (await ref.get()).data()!;
  await db.doc("jestAccountDeletionTombstones/projection-creator").set({recreationBlocked: true});
  await ref.update({"response.run.opponent.adjustedFinishMs": 1});
  await expect(requestRaceHintForUser("projection-player", input, {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/projection-run").get()).data()?.opponent.subjectUserId).toBe("projection-creator");
  await ref.update({response: receipt.response});
  /** Retry commits the physical privacy scrub without replacing the accepted hint or its ghost. */
  const repaired = await requestRaceHintForUser("projection-player", input, {db, nowMs: 4000});
  expect(repaired).toEqual({...original, run: {...original.run, opponent: {...original.run.opponent!, displayName: "Riddle Quest player"}}});
  expect((await db.doc("raceRuns/projection-run").get()).data()?.opponent.subjectUserId).toBeUndefined();
  expect((await db.doc("raceRuns/projection-run").get()).data()?.hintPenaltyMs).toBe(RACE_RULES.hintPenaltyMs);
});

it.each(corruptions)("rejects a cached %s contradiction without charging again and resumes the repaired original receipt", async (_name, corrupt) => {
  /** Genuine accepted projection and persisted receipt are captured before injecting a valid-shape contradiction. */
  const original = await requestRaceHintForUser("projection-player", input, {db, nowMs: 2000});
  /** Current progress advances; a valid old receipt must remain historical rather than being replaced with today's question. */
  await skipRaceRiddleForUser("projection-player", {...input, requestId: "projection-skip"}, {db, nowMs: 3000});
  /** Persisted identity has already been minimized by the real mutation interface. */
  const ref = db.doc(`raceRuns/projection-run/requests/${requestDocumentId("projection-player", input.requestId)}`);
  /** Complete original storage response is repaired explicitly after rejection. */
  const receipt = (await ref.get()).data()!;
  /** Clone only the serializable public response so timestamp metadata stays intact. */
  const damaged: RequestRaceHintResponse = JSON.parse(JSON.stringify(receipt.response));
  corrupt(damaged);
  await ref.update({response: damaged});
  /** Authority and currency must survive replay rejection in full. */
  const run = (await db.doc("raceRuns/projection-run").get()).data();
  /** Independent account snapshot catches repeated progress or currency writes. */
  const account = (await db.doc("users/projection-player").get()).data();
  await expect(requestRaceHintForUser("projection-player", input, {db, nowMs: 4000})).rejects.toMatchObject({code: "data-loss"});
  expect((await db.doc("raceRuns/projection-run").get()).data()).toEqual(run);
  expect((await db.doc("users/projection-player").get()).data()).toEqual(account);
  expect((await ref.get()).data()?.response).toEqual(damaged);
  await ref.update({response: receipt.response});
  expect(await Promise.all([0, 1].map(() => requestRaceHintForUser("projection-player", input, {db, nowMs: 5000}))))
    .toEqual([original, original]);
  /** Valid unbound historical receipts retain the same immutable projection checks. */
  await ref.update({commandBinding: FieldValue.delete()});
  expect(await requestRaceHintForUser("projection-player", input, {db, nowMs: 6000})).toEqual(original);
});
