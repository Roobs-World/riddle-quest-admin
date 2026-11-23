import {RACE_RULES} from "../../../../src/races/contracts/index.js";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, raceOutcome, refreshRaceRun, type RaceRunRecord} from "../../race/runs/raceEngine";
import {parseRunRecord} from "../../race/raceSetupService";

/** Valid legacy storage without a rules snapshot or a populated event history. */
const fixture = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run", userId: "player", role: "challenger", status: "active", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "deck", riddles: Array.from({length: 15}, (_, position) => ({
    riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`, text: "A clue", answer: "test", position,
  })), currentPosition: 0, correctCount: 0, guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000,
  hintPenaltyMs: 0, skipPenaltyMs: 0, events: [], opponent: {displayName: "Rival", adjustedFinishMs: 10000, events: []}, ...overrides,
});

/** Copies the engine's projection, including a false result, to test self-consistent corrupt settlement receipts. */
const settled = (run: RaceRunRecord): RaceRunRecord => ({...run,
  settledAtMs: Number.MAX_SAFE_INTEGER, settledOutcome: raceOutcome(run, Number.MAX_SAFE_INTEGER),
});

it.each([false, true])("rejects contradictory terminal results even with matching settlement: %s", hasSettlement => {
  /** Fully cleared challenger whose actual time is faster than the immutable ghost. */
  const complete = fixture({status: "completed", result: "player_win", correctCount: 10, currentPosition: 9,
    wallFinishMs: 5000, finishedAtMs: 6000});
  /** Unfinished challenger loss clamped to the opponent's finish by the engine. */
  const partial = {...complete, correctCount: 4, currentPosition: 4, result: "ghost_win" as const, wallFinishMs: 10000, finishedAtMs: 11000};
  /** Each false record remains individually schema-shaped and arithmetically coherent. */
  const invalid: RaceRunRecord[] = [
    {...complete, result: "ghost_win"}, {...complete, result: "tie"}, {...complete, result: "recorded"},
    {...complete, role: "creator", opponent: undefined},
    {...complete, status: "timed_out", result: "timed_out"},
    {...partial, result: "player_win"}, {...partial, result: "tie"}, {...partial, result: "recorded", opponent: undefined},
    {...partial, wallFinishMs: 9000, finishedAtMs: 10000}, {...partial, opponent: undefined},
    {...partial, opponent: {...partial.opponent!, adjustedFinishMs: RACE_RULES.maxAdjustedTimeMs},
      wallFinishMs: RACE_RULES.maxAdjustedTimeMs, finishedAtMs: 1000 + RACE_RULES.maxAdjustedTimeMs},
    {...partial, hintPenaltyMs: RACE_RULES.maxAdjustedTimeMs, wallFinishMs: 0, finishedAtMs: 1000},
    {...partial, status: "timed_out", result: "timed_out"},
    {...partial, role: "creator", status: "timed_out", result: "timed_out", opponent: undefined,
      wallFinishMs: RACE_RULES.maxAdjustedTimeMs, finishedAtMs: 1000 + RACE_RULES.maxAdjustedTimeMs},
    {...partial, status: "timed_out", result: "timed_out", currentPosition: 15,
      wallFinishMs: RACE_RULES.maxAdjustedTimeMs + 1, finishedAtMs: 1001 + RACE_RULES.maxAdjustedTimeMs},
    {...complete, hintPenaltyMs: Number.MAX_SAFE_INTEGER},
    {...complete, lastActionAtMs: 7000},
    {...complete, events: [{sequence: 0, type: "correct", riddlePosition: 0, wallElapsedMs: 6000,
      penaltyAddedMs: 0, totalPenaltyMs: 0, adjustedElapsedMs: 6000, correctCount: 1}]},
  ];
  for (const run of invalid) expect(() => parseRunRecord(hasSettlement ? settled(run) : run))
    .toThrow("Stored Race to 10 run is invalid");
});

it("accepts real engine finishes, including exact ties and tenth-skip overshoots", () => {
  /** Nine cleared questions permit the next action to complete the race. */
  const last = fixture({correctCount: 9, currentPosition: 9});
  /** Tenth skip can finish above the active maximum after pre-existing penalties. */
  const overLimit = fixture({correctCount: 9, currentPosition: 9, hintPenaltyMs: RACE_RULES.maxAdjustedTimeMs - 15000,
    opponent: {displayName: "Rival", adjustedFinishMs: RACE_RULES.maxAdjustedTimeMs - 5000, events: []}});
  /** Real engine outputs cover competitive, solo, ghost and penalty deadline semantics. */
  const runs = [
    applyRaceGuess(last, {riddleId: "q-9", guess: "test"}, 6000).run,
    applyRaceGuess(last, {riddleId: "q-9", guess: "test"}, 11000).run,
    applyRaceSkip(last, {riddleId: "q-9"}, 2000),
    applyRaceSkip(overLimit, {riddleId: "q-9"}, 1001),
    applyRaceGuess({...last, role: "creator", opponent: undefined}, {riddleId: "q-9", guess: "test"}, 6000).run,
    applyRaceGuess({...last, opponent: undefined}, {riddleId: "q-9", guess: "test"}, 6000).run,
    refreshRaceRun(fixture(), 11001),
    applyRaceHint(fixture(), {riddleId: "q-0"}, 1001).run,
    refreshRaceRun(fixture({opponent: {...last.opponent!, adjustedFinishMs: RACE_RULES.maxAdjustedTimeMs}}), 1000 + RACE_RULES.maxAdjustedTimeMs),
    applyRaceSkip({...overLimit, correctCount: 0, currentPosition: 0}, {riddleId: "q-0"}, 1001),
  ];
  expect(runs.map(run => run.result)).toEqual(["player_win", "tie", "ghost_win", "ghost_win", "recorded", "recorded",
    "ghost_win", "ghost_win", "timed_out", "timed_out"]);
  for (const run of runs) {
    expect(parseRunRecord(run)).toEqual(run);
    expect(parseRunRecord(settled(run))).toEqual(settled(run));
  }
});

it.each(["creator", "challenger"] as const)("preserves early exhaustion of short legacy %s decks", role => {
  /** Legacy snapshots may contain fewer than ten questions, causing an early timed-out result. */
  const short = fixture({role, opponent: role === "creator" ? undefined : fixture().opponent, riddles: [fixture().riddles[0]]});
  /** Exhaustion is determined by the engine before the later ghost deadline. */
  const terminal = applyRaceGuess(short, {riddleId: "q-0", guess: "test"}, 1500).run;
  expect(terminal).toMatchObject({status: "timed_out", correctCount: 1, currentPosition: 1, wallFinishMs: 500});
  expect(parseRunRecord(terminal)).toEqual(terminal);
  expect(parseRunRecord(settled(terminal))).toEqual(settled(terminal));
});
