import {RACE_RULES, type RaceGhostEvent} from "../../../../src/races/contracts/index.js";
import {parseRunRecord, parseChallengeRecord} from "../../race/raceSetupService";
import {applyRaceGuess, applyRaceHint, applyRaceSkip, refreshRaceRun, abandonRaceRun, type RaceRunRecord} from "../../race/runs/raceEngine";
import {buildRaceBotOpponent} from "../../race/matchmaking/raceBot";

/** Owned full deck supports authoritative scoring and legacy history verification. */
const fixture = (): RaceRunRecord => ({runId: "run", userId: "player", role: "creator", status: "active", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "deck", riddles: Array.from({length: 15}, (_, position) => ({riddleId: `q-${position}`,
    canonicalRiddleId: `c-${position}`, text: "A clue", answer: "test", position})), currentPosition: 0, correctCount: 0,
  guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []});
/** A genuine paid hint retains its charge and progress in both state and history. */
const hinted = (): RaceRunRecord => applyRaceHint(fixture(), {riddleId: "q-0"}, 2000).run;

it.each([
  {sequence: 1}, {riddlePosition: 15}, {riddlePosition: 1}, {correctCount: 1},
  {totalPenaltyMs: 0, adjustedElapsedMs: 1000},
  {wallElapsedMs: Number.MAX_SAFE_INTEGER + 1, adjustedElapsedMs: Number.MAX_SAFE_INTEGER + 16000},
])("rejects known history contradictory to sequence, question, score or safe charged clocks: %j", patch => {
  /** Other event fields remain canonical to isolate the inconsistent retained fact. */
  const run = hinted();
  expect(() => parseRunRecord({...run, events: [{...run.events[0], ...patch}]})).toThrow("Stored Race to 10 run is invalid");
});

it.each([
  {hintPenaltyMs: 0}, {hintPenaltyMs: 0, skipPenaltyMs: 15000}, {lastActionAtMs: 1500}, {lastActionAtMs: 999},
  {hintPenaltyMs: Number.MAX_SAFE_INTEGER, skipPenaltyMs: Number.MAX_SAFE_INTEGER},
])("rejects aggregate scoring or accepted clocks contradicting retained charges: %j", patch => {
  expect(() => parseRunRecord({...hinted(), ...patch})).toThrow("Stored Race to 10 run is invalid");
});

it.each([
  {wallElapsedMs: 500, adjustedElapsedMs: 30500}, {totalPenaltyMs: 15000, adjustedElapsedMs: 16000},
  {correctCount: 1}, {riddlePosition: 1}, {sequence: 0},
])("rejects reordered or contradictory successive hint events: %j", patch => {
  /** Genuine second hint establishes the canonical cumulative charge and same-question transition. */
  const twice = applyRaceHint(hinted(), {riddleId: "q-0"}, 3000).run;
  expect(() => parseRunRecord({...twice, events: [twice.events[0], {...twice.events[1], ...patch}]}))
    .toThrow("Stored Race to 10 run is invalid");
});

it("rejects a clearing event that leaves an active run on the cleared question", () => {
  /** Correct scoring advances the live prompt, while the final answer may retain its terminal question. */
  const run = applyRaceGuess(fixture(), {riddleId: "q-0", guess: "test"}, 2000).run;
  expect(() => parseRunRecord({...run, currentPosition: 0})).toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...run, events: [...run.events, {...run.events[0], sequence: 1}]}))
    .toThrow("Stored Race to 10 run is invalid");
});

it("bounds known hints by authored graphemes and the retained legacy rules", () => {
  /** Four real letters can be revealed once each; a fifth charged event cannot have been issued by the engine. */
  let run = fixture();
  for (let index = 0; index < 4; index++) run = applyRaceHint(run, {riddleId: "q-0"}, 2000 + index).run;
  expect(parseRunRecord(run)).toEqual(run);
  /** Individually well-shaped extra history still contradicts the owned answer's maximum hints. */
  const extra = {...run.events[3], sequence: 4, totalPenaltyMs: 75000, adjustedElapsedMs: 76003};
  expect(() => parseRunRecord({...run, hintPenaltyMs: 75000, events: [...run.events, extra]}))
    .toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...run, rulesSnapshot: {...RACE_RULES, maxHintsPerRiddle: 1}}))
    .toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...run, events: Array.from({length: 121}, (_, sequence) => ({...extra, sequence}))}))
    .toThrow("Stored Race to 10 run is invalid");
});

it("preserves real engine history across hints, guesses, paid/automatic skips, completion and abandonment", () => {
  /** Every accepted state crosses the production canonical storage reader. */
  let run = fixture();
  for (let position = 0; position < 10; position++) {
    run = applyRaceHint(run, {riddleId: `q-${position}`}, 2000 + position * 1000).run;
    expect(parseRunRecord(run)).toEqual(run);
    if (position === 0) {
      for (let attempt = 0; attempt < 5; attempt++) {
        run = applyRaceGuess(run, {riddleId: "q-0", guess: "xxxx"}, 2001 + attempt).run;
        expect(parseRunRecord(run)).toEqual(run);
      }
    } else run = position % 2 ? applyRaceSkip(run, {riddleId: `q-${position}`}, 2001 + position * 1000) :
      applyRaceGuess(run, {riddleId: `q-${position}`, guess: "test"}, 2001 + position * 1000).run;
    expect(parseRunRecord(run)).toEqual(run);
  }
  expect(run).toMatchObject({status: "completed", correctCount: 10});
  expect(parseRunRecord(abandonRaceRun(hinted(), 3000)).status).toBe("abandoned");
  /** A hint can trigger a deadline whose terminal clock legitimately clamps before its event. */
  const deadline = applyRaceHint({...fixture(), role: "challenger", opponent: {displayName: "Rival", adjustedFinishMs: 10000, events: []}},
    {riddleId: "q-0"}, 2000).run;
  expect(deadline.wallFinishMs).toBe(0);
  expect(parseRunRecord(deadline)).toEqual(deadline);
});

it("retains supported empty history and missing legacy prefixes without inventing their facts", () => {
  /** Pre-existing aggregate progress may predate retained scoring events. */
  const legacy = {...fixture(), currentPosition: 9, correctCount: 9, hintPenaltyMs: 15000};
  expect(parseRunRecord(legacy)).toEqual(legacy);
  /** The first newly retained event includes aggregate penalty and score offsets from that historical prefix. */
  const terminal = applyRaceSkip(legacy, {riddleId: "q-9"}, 2000);
  expect(parseRunRecord(terminal)).toEqual(terminal);
  /** Historical skips advanced the prompt without increasing successful-answer counts. */
  const events: RaceGhostEvent[] = [{sequence: 0, type: "skip", riddlePosition: 0, wallElapsedMs: 1000,
    penaltyAddedMs: 45000, totalPenaltyMs: 45000, adjustedElapsedMs: 46000, correctCount: 0},
  {sequence: 1, type: "correct", riddlePosition: 1, wallElapsedMs: 2000, penaltyAddedMs: 0,
    totalPenaltyMs: 45000, adjustedElapsedMs: 47000, correctCount: 1}];
  expect(parseRunRecord({...fixture(), currentPosition: 2, correctCount: 1, skipPenaltyMs: 45000, events}).events).toEqual(events);
});

it("validates archived recording charges and bounded opponent histories without requiring an invented legacy full score", () => {
  /** Complete creator recording retains its real scoring timeline and charged hints. */
  let run = hinted();
  for (let position = 0; position < 10; position++) run = applyRaceGuess(run, {riddleId: `q-${position}`, guess: "test"}, 3000 + position).run;
  /** Archive projection mirrors actual publication totals. */
  const challenge = {challengeId: "challenge", creatorId: "player", creatorRunId: "run", creatorSnapshot: {displayName: "Player"},
    categoryId: "history", locale: "en", deckId: "deck", canonicalRiddleIds: run.riddles.map(riddle => riddle.canonicalRiddleId),
    targetCorrect: 10, creatorWallFinishMs: run.wallFinishMs, creatorHintPenaltyMs: run.hintPenaltyMs, creatorSkipPenaltyMs: 0,
    creatorTotalPenaltyMs: run.hintPenaltyMs, creatorAdjustedFinishMs: run.wallFinishMs! + run.hintPenaltyMs,
    ghostEvents: run.events, rules: RACE_RULES, contentVersion: "content", status: "active", createdAtMs: 1000, expiresAtMs: 100000};
  expect(parseChallengeRecord(challenge).ghostEvents).toEqual(run.events);
  expect(() => parseChallengeRecord({...challenge, creatorHintPenaltyMs: 0, creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: run.wallFinishMs}))
    .toThrow("Stored Race to 10 challenge is invalid");
  expect(() => parseChallengeRecord({...challenge, creatorWallFinishMs: 0, creatorAdjustedFinishMs: run.hintPenaltyMs}))
    .toThrow("Stored Race to 10 challenge is invalid");
  expect(parseChallengeRecord({...challenge, ghostEvents: []}).ghostEvents).toEqual([]);
  /** Opponent timelines are constrained by their fixed finish even after source archive expiry. */
  const opponent = {displayName: "Rival", adjustedFinishMs: challenge.creatorAdjustedFinishMs, events: run.events};
  expect(parseRunRecord({...fixture(), role: "challenger", opponent}).opponent?.events).toEqual(run.events);
  expect(() => parseRunRecord({...fixture(), role: "challenger", opponent: {...opponent, adjustedFinishMs: 1000}}))
    .toThrow("Stored Race to 10 run is invalid");
});

it("retains synthetic ghost playback including its historical non-clearing skip semantics", () => {
  for (let index = 0; index < 50; index++) {
    /** Different deterministic seeds cover synthetic hints, skips and clean timelines. */
    const opponent = buildRaceBotOpponent({version: 1, userId: "player", requestId: "synthetic-request", locale: "en", categoryId: "history",
      requestedCategoryId: "history", performanceMs: 100000, createdAtMs: 1000, expiresAtMs: 61000}, `seed-${index}`, fixture().riddles);
    expect(parseRunRecord({...fixture(), role: "challenger", fallbackOfferId: "a".repeat(64), opponent}).opponent).toEqual(opponent);
  }
  expect(parseRunRecord(refreshRaceRun({...fixture(), role: "challenger"}, 301000)).status).toBe("timed_out");
});
