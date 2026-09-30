import {RACE_RULES} from "@qwordly/core/race";
import {raceDeckContentVersion, validateRaceDeckSnapshot} from "../../race/raceDeckSnapshot";
import {applyRaceHint, toRaceRunView, type RaceRunRecord} from "../../race/raceEngine";

/** Minimal authoritative run used to exercise archived rules and answer policy. */
const run = (): RaceRunRecord => ({
  runId: "run", userId: "player", role: "creator", status: "active", categoryId: "history", locale: "en",
  rulesVersion: "race10_v1", deckId: "deck", rulesSnapshot: {...RACE_RULES, maxHintsPerRiddle: 1},
  riddles: [{riddleId: "q", canonicalRiddleId: "q:1", position: 0, text: "What instrument?", answer: "piano"}],
  currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [],
  startedAtMs: 1_000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: [],
});

it("fingerprints actual immutable text and answers, not just catalog identifiers", () => {
  /** Provides content behavior. */
  const content = run().riddles;
  expect(raceDeckContentVersion(content)).not.toBe(raceDeckContentVersion([{...content[0], text: "Edited clue"}]));
  expect(raceDeckContentVersion(content)).not.toBe(raceDeckContentVersion([{...content[0], answer: "organ"}]));
});

it("rejects reordered or corrupt archived decks", () => {
  /** Provides content behavior. */
  const content = run().riddles;
  expect(() => validateRaceDeckSnapshot(content, ["different-id"])).toThrow("does not match");
  expect(() => validateRaceDeckSnapshot([], ["q:1"])).toThrow("unavailable");
  expect(() => validateRaceDeckSnapshot([null], ["q:1"])).toThrow("Invalid");
});

it("executes historical hint limits and projects the same stored rules", () => {
  /** Provides first behavior. */
  const first = applyRaceHint(run(), {riddleId: "q"}, 2_000).run;
  expect(toRaceRunView(first, 2_000).rules.maxHintsPerRiddle).toBe(1);
  expect(toRaceRunView(first, 2_000).currentRiddle?.hintAvailable).toBe(false);
  expect(() => applyRaceHint(first, {riddleId: "q"}, 3_000)).toThrow("No unrevealed race hint");
});

it("rejects duplicate physical or canonical identities in an otherwise ordered archive", () => {
  /** Distinct canonical positions cannot reuse one physical question identity. */
  const content = run().riddles;
  expect(() => validateRaceDeckSnapshot([content[0], {...content[0], canonicalRiddleId: "q:2", position: 1}], ["q:1", "q:2"])).toThrow("identities must be unique");
  expect(() => validateRaceDeckSnapshot([content[0], {...content[0], riddleId: "other", position: 1}], ["q:1", "q:1"])).toThrow("unavailable");
});

it("enforces a server-owned answer policy even when the caller asks for evaluation data", () => {
  /** Provides view behavior. */
  const view = toRaceRunView({...run(), evaluationPolicy: "server-only"}, 2_000, true);
  expect(view.preloadedRiddles).toBeUndefined();
  expect(view.currentRiddle?.evaluation).toBeUndefined();
  expect(toRaceRunView({...run(), evaluationPolicy: "preloaded"}, 2_000, true).preloadedRiddles).toHaveLength(1);
});
