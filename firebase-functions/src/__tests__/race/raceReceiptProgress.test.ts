import {RACE_RULES} from "@qwordly/core/race";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, abandonRaceRun, toRaceRunView, type RaceRunRecord} from "../../race/raceEngine";
import {assertRaceMutationReceipt} from "../../race/raceRequestBinding";

/** Real engine transitions provide compatibility evidence for terminal and historical checkpoints. */
const fixture = (): RaceRunRecord => ({recordVersion: 1, runId: "progress", userId: "player", role: "creator", status: "active",
  categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false,
  revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
/** Original owned scoring question and receipt intent. */
const input = {runId: "progress", riddleId: "q-0", requestId: "progress-action"};

it("accepts a paid hint whose deadline clamps the final wall clock before its accepted event", () => {
  /** The hint charge alone crosses the immutable ghost deadline. */
  const source = {...fixture(), role: "challenger" as const, opponent: {displayName: "Creator", adjustedFinishMs: 10000, events: []}};
  /** Terminal wall time can clamp backwards even though the accepted event remains later. */
  const result = applyRaceHint(source, input, 2000);
  expect(result.run.wallFinishMs).toBeLessThan(result.run.events[0].wallElapsedMs);
  expect(() => assertRaceMutationReceipt({run: toRaceRunView(result.run, 2000), revealedLetter: result.revealedLetter, index: result.index},
    {kind: "hint", input}, result.run, true)).not.toThrow();
});

it("accepts a paid skip crossing the maximum with a legitimately clamped terminal clock", () => {
  /** Maximum duration precedes this ghost's finish. */
  const source = {...fixture(), role: "challenger" as const, opponent: {displayName: "Creator", adjustedFinishMs: 500000, events: []}};
  /** Penalty causes timeout without moving the known accepted event backwards. */
  const result = applyRaceSkip(source, input, 290000);
  expect(result).toMatchObject({status: "timed_out", correctCount: 1, currentPosition: 1});
  expect(result.wallFinishMs).toBeLessThan(result.events[0].wallElapsedMs);
  expect(() => assertRaceMutationReceipt({run: toRaceRunView(result, 290000), penaltyAddedMs: RACE_RULES.skipPenaltyMs},
    {kind: "skip", input}, result, true)).not.toThrow();
});

it.each(["correct", "skip"] as const)("accepts the final %s clearing action which remains on question ten", method => {
  /** Earlier progress is already owned even when retained history is sparse. */
  const source = {...fixture(), correctCount: 9, currentPosition: 9};
  /** Final action does not advance to a nonexistent eleventh required clearing checkpoint. */
  const request = {...input, riddleId: "q-9", guess: "test"};
  if (method === "correct") {
    /** Feedback and terminal state are produced by the actual engine. */
    const result = applyRaceGuess(source, request, 2000);
    expect(() => assertRaceMutationReceipt({...result, run: toRaceRunView(result.run, 2000)}, {kind: "guess", input: request}, result.run, true))
      .not.toThrow();
  } else {
    /** A paid final clear is also a complete recording under the retained scoring rules. */
    const result = applyRaceSkip(source, request, 2000);
    expect(() => assertRaceMutationReceipt({run: toRaceRunView(result, 2000), penaltyAddedMs: RACE_RULES.skipPenaltyMs},
      {kind: "skip", input: request}, result, true)).not.toThrow();
  }
});

it.each(["prepared", "scheduled", "active"] as const)("accepts %s abandonment without a scored result or editable prompt", status => {
  /** Unscored lifecycle states carry no invented progress. */
  const source = {...fixture(), status, ...(status === "prepared" ? {startedAtMs: 0, preparationExpiresAtMs: 30000} :
    status === "scheduled" ? {startedAtMs: 5000} : {})};
  /** Abandonment retains its original accepted clock and no current question. */
  const result = abandonRaceRun(source, 2000);
  expect(() => assertRaceMutationReceipt({run: toRaceRunView(result, 2000), result: null}, {kind: "abandon", input}, result, true)).not.toThrow();
});
