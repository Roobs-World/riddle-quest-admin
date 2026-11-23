import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES, type SubmitRaceGuessResponse} from "@riddle-quest/core/race";
import {submitRaceGuessForUser} from "../../race/raceService";
import {requestDocumentId} from "../../race/raceSetupService";

/** Clock replay acceptance uses only demo emulator storage. */
let db: FirebaseFirestore.Firestore;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("receipt-clock-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await db.recursiveDelete(db.doc("raceRuns/receipt-clock-run"));
  await db.doc("users/receipt-clock-player").set({displayName: "Player", coins: 100});
});

describe.each([false, true])("cached clock authority, recordVersion1=%s", versioned => {
  it.each(["elapsed", "sample", "before-start", "omitted-start"])("rejects contradictory %s then replays explicit repair", async kind => {
    await db.doc("raceRuns/receipt-clock-run").set({...(versioned ? {recordVersion: 1} : {}), runId: "receipt-clock-run",
      userId: "receipt-clock-player", role: "creator", status: "active", categoryId: "history", locale: "en",
      rulesVersion: RACE_RULES.version, deckId: "clock-deck", riddles: Array.from({length: 15}, (_, position) => ({
        riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`, text: "A clue", answer: "test", position})),
      currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000,
      hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
    /** Real wrong guesses establish a historical reply and newer accepted progress without scoring events. */
    const input = {runId: "receipt-clock-run", riddleId: "q-0", requestId: "clock-guess", guess: "nope"};
    /** Original reply must remain replayable after explicit repair. */
    const original = await submitRaceGuessForUser("receipt-clock-player", input, {db, nowMs: 2000});
    await submitRaceGuessForUser("receipt-clock-player", {...input, requestId: "clock-next"}, {db, nowMs: 3000});
    /** Canonical intent and TTL remain untouched while one public clock relationship is damaged. */
    const ref = db.doc(`raceRuns/receipt-clock-run/requests/${requestDocumentId("receipt-clock-player", input.requestId)}`);
    /** Untampered cached authority envelope. */
    const receipt = (await ref.get()).data()!;
    /** Corruption preserves all unrelated response fields and intent. */
    const damaged: SubmitRaceGuessResponse = JSON.parse(JSON.stringify(receipt.response));
    if (kind === "elapsed" || kind === "omitted-start") {
      damaged.run.wallElapsedMs += 1000; damaged.run.adjustedElapsedMs += 1000;
      if (kind === "omitted-start") delete damaged.run.startsAtMs;
    } else damaged.run.serverNowMs = kind === "sample" ? 1500 : 500;
    await ref.update({response: damaged});
    /** Rejection cannot consume another guess, change currency or silently repair stored evidence. */
    const run = (await db.doc("raceRuns/receipt-clock-run").get()).data();
    /** Currency snapshot must remain unchanged on corrupt replay rejection. */
    const account = (await db.doc("users/receipt-clock-player").get()).data();
    await expect(submitRaceGuessForUser("receipt-clock-player", input, {db, nowMs: 4000})).rejects.toMatchObject({code: "data-loss"});
    expect((await db.doc("raceRuns/receipt-clock-run").get()).data()).toEqual(run);
    expect((await db.doc("users/receipt-clock-player").get()).data()).toEqual(account);
    expect((await ref.get()).data()?.response).toEqual(damaged);
    await ref.update({response: receipt.response});
    expect(await Promise.all([0, 1].map(() => submitRaceGuessForUser("receipt-clock-player", input, {db, nowMs: 5000}))))
      .toEqual([original, original]);
  });
});
