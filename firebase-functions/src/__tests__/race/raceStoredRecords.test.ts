import {RACE_RULES} from "@qwordly/core/race";
import {parseRunRecord, parseChallengeRecord} from "../../race/raceSetupService";

/** A valid legacy run exercises every engine input without depending on Firestore. */
const run = {runId: "run", userId: "player", role: "challenger", status: "active", categoryId: "history", locale: "en",
  rulesVersion: RACE_RULES.version, deckId: "deck", riddles: [{riddleId: "question", canonicalRiddleId: "canonical",
    text: "A question", answer: "answer", position: 0}], currentPosition: 0, correctCount: 0,
  guessesUsed: 0, hintUsed: false, revealedLetters: [], startedAtMs: 1000, hintPenaltyMs: 0, skipPenaltyMs: 0, events: []};
/** A supported legacy challenge has neither explicit language nor the latest hint-limit field. */
const challenge = {challengeId: "challenge", creatorId: "creator", creatorRunId: "creator-run", creatorSnapshot: {displayName: "Creator"},
  categoryId: "history", deckId: "deck", canonicalRiddleIds: ["canonical"], targetCorrect: 10, creatorWallFinishMs: 10000,
  creatorHintPenaltyMs: 0, creatorSkipPenaltyMs: 0, creatorTotalPenaltyMs: 0, creatorAdjustedFinishMs: 10000,
  ghostEvents: [], rules: {...RACE_RULES, maxHintsPerRiddle: undefined}, contentVersion: "legacy-content", status: "active",
  createdAtMs: 1000, expiresAtMs: 100000};

it("normalizes supported legacy challenge fields while retaining storage extension metadata", () => {
  expect(parseChallengeRecord({...challenge, retentionMetadata: {pinned: true}})).toMatchObject({locale: "en",
    rules: {maxHintsPerRiddle: 1}, retentionMetadata: {pinned: true}});
  expect(parseRunRecord(run)).toEqual(run);
});

it.each([
  {categoryId: "unknown"}, {locale: "unknown"}, {status: "unknown"}, {startedAtMs: NaN}, {hintPenaltyMs: -1},
  {lastActionAtMs: -1}, {lastActionAtMs: NaN}, {lastActionAtMs: Number.MAX_SAFE_INTEGER + 1},
  {skipPenaltyMs: Infinity}, {correctCount: 11}, {currentPosition: -1}, {guessesUsed: 6}, {recordVersion: 2},
  {userId: "other/account"}, {revealedLetters: [{index: -1, letter: "a"}]},
  {opponent: {displayName: "Rival", adjustedFinishMs: -1, events: []}}, {evaluationPolicy: "client-selected"}, {recordingFingerprint: "not-a-digest"},
  {recordingFingerprint: "a".repeat(64)}, {recordingFingerprint: "a".repeat(64), role: "creator", challengeId: "challenge"},
])("rejects malformed run scoring/identity data %j", invalid => {
  expect(() => parseRunRecord({...run, ...invalid})).toThrow("Stored Race to 10 run is invalid");
});

it.each([
  {categoryId: "unknown"}, {expiresAtMs: NaN}, {expiresAtMs: 1000}, {createdAtMs: -1}, {recordingPerformanceMs: -1},
  {creatorAdjustedFinishMs: Infinity}, {status: "unknown"}, {scope: "unknown"}, {recordVersion: 2},
  {creatorId: "other/account"}, {canonicalRiddleIds: [123]}, {targetCorrect: 11},
])("rejects malformed matchmaking data %j", invalid => {
  expect(() => parseChallengeRecord({...challenge, ...invalid})).toThrow("Stored Race to 10 challenge is invalid");
});

it("keeps answer-bearing validation errors out of public diagnostics", () => {
  expect(() => parseRunRecord({...run, riddles: [{...run.riddles[0], answer: {secret: "unpublished-answer"}}]}))
    .toThrow("Stored Race to 10 run is invalid");
});


it("binds supported canonical records to their storage document before dependent writes", () => {
  expect(parseRunRecord(run, "run")).toEqual(run);
  expect(parseChallengeRecord(challenge, "challenge").challengeId).toBe("challenge");
  expect(() => parseRunRecord(run, "other-run")).toThrow("Stored race run identity does not match its document");
  expect(() => parseChallengeRecord(challenge, "other-challenge")).toThrow("Stored race challenge identity does not match its document");
});

it.each([
  {riddles: [{...run.riddles[0], position: 1}]},
  {riddles: [run.riddles[0], {...run.riddles[0], position: 1}]},
  {currentPosition: 1}, {startedAtMs: Number.MAX_SAFE_INTEGER + 1},
  {result: "recorded"}, {finishedAtMs: 2000}, {wallFinishMs: 1000}, {correctCount: 10},
  {status: "prepared"}, {status: "timed_out", result: "recorded"}, {status: "abandoned", result: "recorded"},
  {revealedLetters: [{index: 100, letter: "a"}]}, {revealedLetters: [{index: 0, letter: "z"}]},
  {revealedLetters: [{index: 0, letter: "a"}, {index: 0, letter: "a"}]},
])("rejects contradictory deck positions or unsafe clocks %j", invalid => {
  expect(() => parseRunRecord({...run, ...invalid})).toThrow("Stored Race to 10 run is invalid");
});

it.each([
  {canonicalRiddleIds: ["canonical", "canonical"]}, {creatorTotalPenaltyMs: 1}, {creatorAdjustedFinishMs: 9999},
  {riddles: [{...run.riddles[0], canonicalRiddleId: "another"}]},
])("rejects contradictory recording identity and timing totals %j", invalid => {
  expect(() => parseChallengeRecord({...challenge, ...invalid})).toThrow("Stored Race to 10 challenge is invalid");
});

it("binds every settled outcome measurement and identity to its parent run", () => {
  /** Realistic completed creator state has ten distinct ordered questions and an immutable outcome. */
  const terminal = {...run, role: "creator", status: "completed", result: "recorded", correctCount: 10, currentPosition: 9,
    riddles: Array.from({length: 10}, (_, position) => ({...run.riddles[0], riddleId: `q-${position}`, canonicalRiddleId: `c-${position}`, position})),
    wallFinishMs: 10000, finishedAtMs: 11000, settledAtMs: 12000,
    settledOutcome: {runId: "run", result: "recorded", correctCount: 10, wallFinishMs: 10000, hintPenaltyMs: 0,
      skipPenaltyMs: 0, totalPenaltyMs: 0, adjustedFinishMs: 10000, publishable: true, rematchEligible: false,
      newlyUnlockedAchievementIds: [], achievementCoinsAwarded: 0}};
  expect(parseRunRecord(terminal)).toEqual(terminal);
  for (const invalid of [{runId: "other"}, {challengeId: "other"}, {result: "player_win"}, {correctCount: 9},
    {wallFinishMs: 9999}, {hintPenaltyMs: 1}, {skipPenaltyMs: 1}, {totalPenaltyMs: 1}, {adjustedFinishMs: 9999},
    {publishable: false}, {rematchEligible: true}, {opponentAdjustedFinishMs: 10000}]) {
    expect(() => parseRunRecord({...terminal, settledOutcome: {...terminal.settledOutcome, ...invalid}})).toThrow("Stored Race to 10 run is invalid");
  }
  expect(() => parseRunRecord({...terminal, settledAtMs: 10000})).toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...terminal, settledOutcome: undefined})).toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...terminal, status: "active"})).toThrow("Stored Race to 10 run is invalid");
  expect(() => parseRunRecord({...terminal, finishedAtMs: 10999})).toThrow("Stored Race to 10 run is invalid");
});


it("accepts legacy history gaps but refuses contradictory stored guess rows", () => {
  expect(parseRunRecord({...run, guessesUsed: 3, guessHistory: ["aaaaaa"]})).toMatchObject({guessesUsed: 3, guessHistory: ["aaaaaa"]});
  for (const invalid of [{guessesUsed: 0, guessHistory: ["aaaaaa"]}, {guessesUsed: 1, guessHistory: ["short"]},
    {guessesUsed: 1, guessHistory: ["aaaaaa", "bbbbbb"]}])
    expect(() => parseRunRecord({...run, ...invalid})).toThrow("Stored Race to 10 run is invalid");
});
