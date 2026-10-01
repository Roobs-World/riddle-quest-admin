import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {RACE_RULES} from "@qwordly/core/race";
import {readyRaceRunForUser, resumeRaceRunForUser, submitRaceGuessForUser} from "../../race/raceService";

/** Isolated emulator storage proves malformed countdowns cannot become scored authority. */
let db: FirebaseFirestore.Firestore;
/** Countdown contents use valid individual fields but no accepted player progress. */
const fixture = (versioned: boolean) => ({runId: "unscored-run", userId: "unscored-player", role: "creator", status: "scheduled",
  ...(versioned ? {recordVersion: 1} : {}), categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 4000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("unscored-authority-tests-require-emulator");
  if (!getApps().length) initializeApp({projectId: "demo-riddle-quest-multiplayer"});
  db = getFirestore();
});
beforeEach(async () => {
  await Promise.all(["raceRuns", "users", "jestAccountDeletionTombstones", "racePerformanceOutbox", "raceSettlementOutbox"]
    .map(name => db.recursiveDelete(db.collection(name))));
  await db.doc("users/unscored-player").set({displayName: "Player", coins: 0});
});

describe.each([false, true])("rejecting unscored stored authority, versioned=%s", versioned => {
  it.each(["ready", "resume", "guess"] as const)("does not promote fabricated countdown progress through %s after the clock starts", async operation => {
    for (const invalid of [{guessesUsed: 1}, {currentPosition: 1, correctCount: 1}, {hintUsed: true}]) {
      /** Reject before refreshing the expired countdown to active or creating request receipts. */
      const before = {...fixture(versioned), ...invalid};
      await db.doc("raceRuns/unscored-run").set(before);
      /** Even a valid command on the current question cannot legitimize corrupted preparation. */
      const request = {runId: "unscored-run", requestId: "unscored-command", riddleId: `q-${before.currentPosition}`, guess: "test"};
      await expect(operation === "ready" ? readyRaceRunForUser("unscored-player", request, {db, nowMs: 9000}) :
        operation === "resume" ? resumeRaceRunForUser("unscored-player", request.runId, {db, nowMs: 9000}) :
          submitRaceGuessForUser("unscored-player", request, {db, nowMs: 9000})).rejects.toThrow("Stored Race to 10 run is invalid.");
      expect((await db.doc("raceRuns/unscored-run").get()).data()).toEqual(before);
      expect((await db.collection("raceRuns/unscored-run/requests").get()).empty).toBe(true);
      expect((await db.doc("users/unscored-player").get()).data()?.coins).toBe(0);
      expect((await db.collection("raceSettlementOutbox").get()).empty).toBe(true);
      expect((await db.collection("racePerformanceOutbox").get()).empty).toBe(true);
    }
  });
});
