import {RACE_RULES} from "../../../../src/core/race/index.js";
import {parseRunRecord} from "../../race/raceSetupService";

/** An untouched scheduled record must not carry scoring even when history was omitted. */
const fixture = () => ({runId: "unscored", userId: "player", role: "creator", status: "scheduled",
  categoryId: "history", locale: "en", rulesVersion: RACE_RULES.version, deckId: "deck",
  riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`,
    text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0, guessesUsed: 0,
  hintUsed: false, revealedLetters: [], startedAtMs: 4000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});

/** Every persisted scoring input remains empty until the run is active. */
const corruptions = [{guessesUsed: 1}, {hintUsed: true}, {revealedLetters: [{index: 0, letter: "t"}]},
  {currentPosition: 1, correctCount: 1}, {hintPenaltyMs: 1000}, {skipPenaltyMs: 1000}];
it.each([undefined, 1].flatMap(recordVersion => corruptions.map(invalid => ({recordVersion, invalid}))))("rejects independently malformed countdown record %j", ({recordVersion, invalid}) => {
  expect(() => parseRunRecord({...fixture(), recordVersion, ...invalid})).toThrow("Stored Race to 10 run is invalid.");
});

it.each([undefined, 1])("retains untouched scheduled records and readiness metadata, version=%s", recordVersion => {
  expect(parseRunRecord({...fixture(), recordVersion})).toMatchObject({status: "scheduled", guessesUsed: 0});
  expect(parseRunRecord({...fixture(), recordVersion, readinessAcceptedAtMs: 1000,
    preparationExpiresAtMs: 2000})).toMatchObject({startedAtMs: 4000});
});
