import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {RACE_RULES, type SubmitRaceGuessResponse} from "../../../../src/races/contracts/index.js";
import {submitRaceGuessForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";

/** Guess receipt regressions are confined to local demo storage. */
let db: FirebaseFirestore.Firestore;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("guess-receipt-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/guess-run"));
  await db.doc("users/guess-player").set({displayName: "Player", coins: 100});
  await db.doc("raceRuns/guess-run").set({recordVersion: 1, runId: "guess-run", userId: "guess-player", role: "creator", status: "active",
    categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "guess-deck",
    riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
      text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false,
    revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
});

it.each(["wrong colour", "correct colour", "automatic skip colour", "merged graphemes", "zero guesses", "exhausted guesses"])(
  "rejects a cached %s contradiction and restores the repaired original guess without another attempt", async kind => {
    if (kind === "automatic skip colour") await db.doc("raceRuns/guess-run").update({guessesUsed: 4});
    /** Genuine accepted wrong, correct or automatic-skip response establishes original feedback. */
    const input = {runId: "guess-run", riddleId: "q-0", requestId: "guess-original", guess: kind === "correct colour" ? "test" : "nope"};
    /** Original response is the only repair authority. */
    const original = await submitRaceGuessForUser("guess-player", input, {db, nowMs: 2000});
    /** Persisted response is modified without altering its owner or intent binding. */
    const ref = db.doc(`raceRuns/guess-run/requests/${requestDocumentId("guess-player", input.requestId)}`);
    /** Keep timestamp and binding metadata intact while damaging valid-shape feedback or attempt counts. */
    const receipt = (await ref.get()).data()!;
    /** Serializable copied response retains its original submitted letters. */
    const damaged: SubmitRaceGuessResponse = JSON.parse(JSON.stringify(receipt.response));
    if (kind.includes("colour")) damaged.feedback.forEach(letter => {letter.status = kind === "correct colour" ? "red" : "green";});
    else if (kind === "merged graphemes") damaged.feedback = [{letter: input.guess, status: "red"}];
    else {damaged.run.currentRiddle!.guessesUsed = kind === "zero guesses" ? 0 : RACE_RULES.maxGuessesPerRiddle;
      damaged.run.currentRiddle!.guessesRemaining = RACE_RULES.maxGuessesPerRiddle - damaged.run.currentRiddle!.guessesUsed;}
    await ref.update({response: damaged});
    /** Rejection must leave the real accepted attempt untouched. */
    const run = (await db.doc("raceRuns/guess-run").get()).data();
    /** Complete account comparison detects any duplicate achievement/economy writes. */
    const account = (await db.doc("users/guess-player").get()).data();
    await expect(submitRaceGuessForUser("guess-player", input, {db, nowMs: 3000})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc("raceRuns/guess-run").get()).data()).toEqual(run);
    expect((await db.doc("users/guess-player").get()).data()).toEqual(account);
    await ref.update({response: receipt.response});
    expect(await Promise.all([0, 1].map(() => submitRaceGuessForUser("guess-player", input, {db, nowMs: 4000}))))
      .toEqual([original, original]);
    await ref.update({commandBinding: FieldValue.delete()});
    expect(await submitRaceGuessForUser("guess-player", input, {db, nowMs: 5000})).toEqual(original);
  });

it.each([["I", "ı"], ["İ", "i"], ["ı", "I"], ["i", "İ"]])("uses Turkish casing for %s against %s on first acceptance and replay", async (guess, answer) => {
  /** Authored locale and answer are immutable for this accepted race. */
  const snapshot = (await db.doc("raceRuns/guess-run").get()).data()!;
  snapshot.locale = "tr";
  snapshot.riddles = snapshot.riddles.map((riddle: Record<string, unknown>) => ({...riddle, answer}));
  await db.doc("raceRuns/guess-run").set(snapshot);
  /** Locale-aware correctness must agree with the positional colours shown to the player. */
  const input = {runId: "guess-run", riddleId: "q-0", requestId: "guess-turkish", guess};
  /** First response and its exact replay must agree before another answer can be accepted. */
  const accepted = await submitRaceGuessForUser("guess-player", input, {db, nowMs: 2000});
  expect(accepted).toMatchObject({isCorrect: true, feedback: [{letter: guess, status: "green"}], run: {correctCount: 1}});
  expect(await submitRaceGuessForUser("guess-player", input, {db, nowMs: 3000})).toEqual(accepted);
});
