import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {raceOutcome, raceOperationAtMs, type RaceRunRecord} from "../../race/raceEngine";
import {parseRunRecord} from "../../race/raceSetupService";

/** Canonical legacy recording supports sparse historical reward metadata. */
const terminal = (): RaceRunRecord => ({runId: "stored-settlement", userId: "player", role: "creator", status: "completed",
  result: "recorded", categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 9, correctCount: 10, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
  wallFinishMs: 5000, finishedAtMs: 6000});

it.each([
  {},
  {achievementProgressRecordedAtMs: 7000},
  {achievementProgressRecordedAtMs: 7000, settledAtMs: 8000},
  {settledAtMs: 8000, achievementOutcomePresentedAtMs: 9000},
  {recordVersion: 1, settledAtMs: 8000, achievementProgressRecordedAtMs: 8000},
])("preserves supported sparse historical settlement metadata: %j", metadata => {
  /** Settlement adds its reward-free canonical outcome, never inferred missing grants. */
  const run = {...terminal(), ...metadata, ...(metadata.settledAtMs ? {settledOutcome: raceOutcome(terminal(), 8000)} : {})};
  expect(parseRunRecord(run)).toEqual(run);
});

it.each(["prepared", "scheduled", "active", "abandoned"] as const)("rejects a grant attached to an unfinished %s creator", status => {
  /** No prior terminal result or old deadline expiry proves this early grant. */
  const {result: _result, finishedAtMs: _finish, wallFinishMs: _wall, ...run} = terminal();
  expect(() => parseRunRecord({...run, status, correctCount: 0, currentPosition: 0, startedAtMs: status === "prepared" ? 0 : 1000,
    ...(status === "prepared" ? {preparationExpiresAtMs: 30000} : {}), achievementProgressRecordedAtMs: 2000}))
    .toThrow("Stored Race to 10 run is invalid.");
});

it("requires a grant receipt even when retained awards contain zero currency", () => {
  expect(() => parseRunRecord({...terminal(), settledAtMs: 8000, settledOutcome: raceOutcome(terminal(), 8000),
    settlementAwards: {newlyUnlockedAchievementIds: [], achievementCoinsAwarded: 0}})).toThrow("Stored Race to 10 run is invalid.");
});

it("rejects modern grant progress without settlement while retaining the proven legacy terminal grant", () => {
  expect(parseRunRecord({...terminal(), achievementProgressRecordedAtMs: 7000})).toMatchObject({achievementProgressRecordedAtMs: 7000});
  expect(() => parseRunRecord({...terminal(), recordVersion: 1, achievementProgressRecordedAtMs: 7000}))
    .toThrow("Stored Race to 10 run is invalid.");
});

it("floors stale operations at both settlement and later reward presentation", () => {
  /** Presentation may be accepted after another transaction already settled the immutable result. */
  const run = {...terminal(), settledAtMs: 8000, settledOutcome: raceOutcome(terminal(), 8000),
    achievementProgressRecordedAtMs: 7000, achievementOutcomePresentedAtMs: 9000};
  expect(parseRunRecord(run)).toEqual(run);
  expect(raceOperationAtMs(run, 6500)).toBe(9000);
  expect(raceOperationAtMs(run, 10000)).toBe(10000);
});
