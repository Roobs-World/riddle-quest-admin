import {RACE_RULES} from "../../../../src/core/race/index.js";
import {parseRunRecord} from "../../race/raceSetupService";
import type {RaceRunRecord} from "../../race/raceEngine";

/** Actual untouched countdown cancellation carries an action before scored start. */
const fixture = (): RaceRunRecord => ({runId: "clock-validation", userId: "clock-player", role: "creator", status: "abandoned",
  recordVersion: 1, categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "clock-deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false,
  revealedLetters: [], startedAtMs: 8000, preparationExpiresAtMs: 30000, readinessAcceptedAtMs: 5000,
  lastActionAtMs: 6000, finishedAtMs: 6000, wallFinishMs: 0, result: null, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});

it("accepts untouched countdown cancellation and legacy absence of the readiness marker", () => {
  expect(parseRunRecord(fixture(), "clock-validation")).toMatchObject({readinessAcceptedAtMs: 5000, lastActionAtMs: 6000});
  /** Historical cancellation keeps its accepted action time even without readiness metadata. */
  const {readinessAcceptedAtMs: _readiness, ...legacy} = fixture();
  expect(parseRunRecord(legacy, "clock-validation").status).toBe("abandoned");
});

it.each([
  {readinessAcceptedAtMs: 6000}, {readinessAcceptedAtMs: 30000, startedAtMs: 33000},
  {lastActionAtMs: 4999, finishedAtMs: 4999}, {finishedAtMs: 4999},
  {status: "active", finishedAtMs: undefined, wallFinishMs: undefined},
  {correctCount: 1, currentPosition: 1}, {guessesUsed: 1}, {hintPenaltyMs: 15000},
  {wallFinishMs: 1}, {finishedAtMs: 6500},
])("rejects inconsistent readiness or pre-start scoring: %j", overrides => {
  expect(() => parseRunRecord({...fixture(), ...overrides}, "clock-validation")).toThrow("Stored Race to 10 run is invalid.");
});
