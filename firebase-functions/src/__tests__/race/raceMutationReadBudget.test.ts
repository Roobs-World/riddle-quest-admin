import {deleteApp, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {submitRaceGuessForUser} from "../../race/raceService";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Reference factory for deterministic transactions; this suite never contacts production. */
const app = initializeApp({projectId: "demo-race-read-budget"}, "race-read-budget");
/** Real document references do not perform network reads by themselves. */
const db = getFirestore(app);
/** Wrong-answer fixture traverses real privacy, interaction and active-run settlement. */
const run: RaceRunRecord = {
  runId: "run-1", userId: "player-1", challengeId: "challenge-1", role: "challenger", status: "active",
  categoryId: "history", locale: "en", rulesVersion: "race10_v1", deckId: "deck-1",
  riddles: [{riddleId: "q-1", canonicalRiddleId: "q:1", text: "A test clue", answer: "test", position: 0}],
  currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  opponent: {subjectUserId: "creator-1", displayName: "Creator", adjustedFinishMs: 10000, events: []},
};
/** All live opponent guards must be read again on each retry. */
const guards = ["jestAccountDeletionTombstones/creator-1", "users/player-1/blockedRivals/creator-1", "users/creator-1/blockedRivals/player-1"];
/** Drives the public guess service with independently observed transaction snapshots. */
async function guess(attempts: number, blockedOnRetry = false) {
  /** Read counts below the application transaction boundary. */
  const reads: Array<Map<string, number>> = [];
  /** Emulates Firebase's independent callback attempts. */
  const spy = jest.spyOn(db, "runTransaction").mockImplementation(async callback => {
    /** Only the final attempt supplies the returned receipt. */
    let result: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      /** Snapshot-local transport counters. */
      const counts = new Map<string, number>(); reads.push(counts);
      /** Minimal transport leaves business policy and scoring implementations intact. */
      const transaction = {
        get: jest.fn(async (ref: FirebaseFirestore.DocumentReference) => {
          counts.set(ref.path, (counts.get(ref.path) ?? 0) + 1);
          /** A rival can block the owner between retry snapshots. */
          const exists = ref.path === "raceRuns/run-1" || blockedOnRetry && attempt > 0 && ref.path === guards[2];
          return {id: ref.id, exists, data: () => ref.path === "raceRuns/run-1" ? run : {}};
        }),
        set: jest.fn(), create: jest.fn(), update: jest.fn(),
      } as unknown as FirebaseFirestore.Transaction;
      result = await callback(transaction);
    }
    return result as never;
  });
  try {
    return {response: await submitRaceGuessForUser("player-1", {
      runId: "run-1", requestId: "guess-1", riddleId: "q-1", guess: "xxxx", includeEvaluation: false,
    }, {db, nowMs: 2000}), reads};
  } finally {spy.mockRestore();}
}

afterAll(() => deleteApp(app));
it("checks opponent deletion and both blocks once per real guess transaction snapshot", async () => {
  /** Wrong answer stays active while exercising every interaction guard and settlement. */
  const {response, reads} = await guess(1);
  expect(response).toMatchObject({isCorrect: false, run: {status: "active", correctCount: 0}});
  for (const guard of guards) expect(reads[0].get(guard)).toBe(1);
});
it("rechecks guard snapshots on retry and rejects a newly blocked interaction", async () => {
  await expect(guess(2, true)).rejects.toMatchObject({code: "permission-denied"});
});
it("uses independent guard reads for every retry of a successful first attempt", async () => {
  /** A retried callback must independently validate live authority. */
  const {reads} = await guess(2);
  expect(reads).toHaveLength(2);
  for (const attempt of reads) for (const guard of guards) expect(attempt.get(guard)).toBe(1);
});
