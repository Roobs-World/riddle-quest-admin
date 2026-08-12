import {computeFeedback, lowerCaseGraphemes, splitGraphemes} from "@qwordly/core/game";
import {
  RACE_HINT_PENALTY_MS,
  RACE_MAX_ADJUSTED_TIME_MS,
  RACE_MAX_GUESSES_PER_RIDDLE,
  RACE_RULES,
  RACE_SKIP_PENALTY_MS,
  RACE_TARGET_CORRECT,
  type RaceCategoryId,
  type RaceGhostEvent,
  type RaceLocale,
  type RaceOutcome,
  type RaceRunStatus,
  type RaceRunView,
} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";

/** Immutable riddle content captured when an authoritative race run starts. */
export type RaceRiddleSnapshot = {
  /** Stores riddle id. */
  riddleId: string;
  /** Stores canonical riddle id. */
  canonicalRiddleId: string;
  /** Stores text. */
  text: string;
  /** Stores answer. */
  answer: string;
  /** Stores position. */
  position: number;
};

/** Opponent ghost data attached to a challenger run. */
export type RaceOpponentRecord = {
  /** Server-only subject used to remove identity snapshots after account deletion. */
  subjectUserId?: string;
  /** Stores display name. */
  displayName: string;
  /** Stores avatar url. */
  avatarUrl?: string | null;
  /** Stores adjusted finish ms. */
  adjustedFinishMs: number;
  /** Stores events. */
  events: RaceGhostEvent[];
};

/** Complete server-only state for an authoritative Race to 10 run. */
export type RaceRunRecord = {
  /** Stores run id. */
  runId: string;
  /** Stores user id. */
  userId: string;
  /** Stores challenge id. */
  challengeId?: string;
  /** Stores rivalry challenge id. */
  rivalryChallengeId?: string;
  /** Stores role. */
  role: "creator" | "challenger";
  /** Stores status. */
  status: RaceRunStatus;
  /** Stores result. */
  result?: RaceOutcome["result"] | null;
  /** Stores category id. */
  categoryId: RaceCategoryId;
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores rules version. */
  rulesVersion: typeof RACE_RULES.version;
  /** Stores deck id. */
  deckId: string;
  /** Stores riddles. */
  riddles: RaceRiddleSnapshot[];
  /** Stores current position. */
  currentPosition: number;
  /** Stores correct count. */
  correctCount: number;
  /** Stores guesses used. */
  guessesUsed: number;
  /** Stores hint used. */
  hintUsed: boolean;
  /** Stores revealed letters. */
  revealedLetters: Array<{index: number; letter: string}>;
  /** Stores started at ms. */
  startedAtMs: number;
  /** Stores finished at ms. */
  finishedAtMs?: number;
  /** Stores wall finish ms. */
  wallFinishMs?: number;
  /** Stores hint penalty ms. */
  hintPenaltyMs: number;
  /** Stores skip penalty ms. */
  skipPenaltyMs: number;
  /** Stores events. */
  events: RaceGhostEvent[];
  /** Stores opponent. */
  opponent?: RaceOpponentRecord;
  /** Stores rate limit window started at ms. */
  rateLimitWindowStartedAtMs?: number;
  /** Stores rate limit action count. */
  rateLimitActionCount?: number;
  /** Stores achievement progress recorded at ms. */
  achievementProgressRecordedAtMs?: number;
};

/** Derived wall-clock, penalty, and adjusted race durations. */
export type RaceClock = {
  /** Stores wall elapsed ms. */
  wallElapsedMs: number;
  /** Stores total penalty ms. */
  totalPenaltyMs: number;
  /** Stores adjusted elapsed ms. */
  adjustedElapsedMs: number;
};

/** Provides copy run behavior. */
const copyRun = (run: RaceRunRecord): RaceRunRecord => ({
  ...run,
  riddles: run.riddles.map((riddle) => ({...riddle})),
  revealedLetters: run.revealedLetters.map((letter) => ({...letter})),
  events: run.events.map((event) => ({...event})),
  opponent: run.opponent ? {...run.opponent, events: run.opponent.events.map((event) => ({...event}))} : undefined,
});

/** Calculates authoritative elapsed and penalty time for a race run. */
export function raceClock(run: RaceRunRecord, nowMs: number): RaceClock {
  const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
  const wallElapsedMs = run.wallFinishMs ?? Math.max(0, nowMs - run.startedAtMs);
  return {wallElapsedMs, totalPenaltyMs, adjustedElapsedMs: wallElapsedMs + totalPenaltyMs};
}

/** Provides finish run behavior. */
const finishRun = (
  run: RaceRunRecord,
  result: NonNullable<RaceRunRecord["result"]>,
  adjustedFinishMs: number,
): RaceRunRecord => {
  const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
  const wallFinishMs = Math.max(0, adjustedFinishMs - totalPenaltyMs);
  return {
    ...run,
    status: result === "timed_out" ? "timed_out" : "completed",
    result,
    wallFinishMs,
    finishedAtMs: run.startedAtMs + wallFinishMs,
  };
};

/** Refreshes time-dependent run state, including timeout and ghost completion. */
export function refreshRaceRun(input: RaceRunRecord, nowMs: number): RaceRunRecord {
  const run = copyRun(input);
  if (run.status !== "active") return run;
  const clock = raceClock(run, nowMs);
  if (clock.adjustedElapsedMs >= RACE_MAX_ADJUSTED_TIME_MS) {
    return finishRun(run, "timed_out", RACE_MAX_ADJUSTED_TIME_MS);
  }
  if (run.opponent && clock.adjustedElapsedMs > run.opponent.adjustedFinishMs) {
    return finishRun(run, "ghost_win", run.opponent.adjustedFinishMs);
  }
  return run;
}

/** Provides require active riddle behavior. */
const requireActiveRiddle = (run: RaceRunRecord, riddleId: string): RaceRiddleSnapshot => {
  if (run.status !== "active") {
    throw new HttpsError("failed-precondition", "This Race to 10 run is no longer active.");
  }
  const riddle = run.riddles[run.currentPosition];
  if (!riddle || riddle.riddleId !== riddleId) {
    throw new HttpsError("failed-precondition", "The submitted riddle is not the active race riddle.");
  }
  return riddle;
};

/** Provides append event behavior. */
const appendEvent = (
  run: RaceRunRecord,
  type: RaceGhostEvent["type"],
  nowMs: number,
  penaltyAddedMs: RaceGhostEvent["penaltyAddedMs"],
): void => {
  const clock = raceClock(run, nowMs);
  run.events.push({
    sequence: run.events.length,
    type,
    riddlePosition: run.currentPosition,
    wallElapsedMs: clock.wallElapsedMs,
    penaltyAddedMs,
    totalPenaltyMs: clock.totalPenaltyMs,
    adjustedElapsedMs: clock.adjustedElapsedMs,
    correctCount: run.correctCount,
  });
};

/** Provides advance riddle behavior. */
const advanceRiddle = (run: RaceRunRecord, nowMs: number): void => {
  run.currentPosition += 1;
  run.guessesUsed = 0;
  run.hintUsed = false;
  run.revealedLetters = [];
  if (run.currentPosition >= run.riddles.length && run.correctCount < RACE_TARGET_CORRECT) {
    const clock = raceClock(run, nowMs);
    Object.assign(run, finishRun(run, "timed_out", Math.min(clock.adjustedElapsedMs, RACE_MAX_ADJUSTED_TIME_MS)));
  }
};

/** Provides finalize after penalty behavior. */
const finalizeAfterPenalty = (run: RaceRunRecord, nowMs: number): RaceRunRecord => refreshRaceRun(run, nowMs);

/** Normalizes answer. */
const normalizeAnswer = (value: string, locale: RaceLocale): string =>
  lowerCaseGraphemes(value.trim(), locale).join("");

/** Applies and validates one guess against the current authoritative riddle. */
export function applyRaceGuess(
  input: RaceRunRecord,
  inputData: {riddleId: string; guess: string},
  nowMs: number,
): {
  run: RaceRunRecord;
  feedback: Array<{letter: string; status: "green" | "yellow" | "red"}>;
  isCorrect: boolean;
  autoSkipped: boolean;
} {
  const run = refreshRaceRun(input, nowMs);
  const riddle = requireActiveRiddle(run, inputData.riddleId);
  const guessLetters = splitGraphemes(inputData.guess.trim(), run.locale);
  const answerLetters = splitGraphemes(riddle.answer, run.locale);
  if (guessLetters.length !== answerLetters.length) {
    throw new HttpsError("invalid-argument", `Guess must contain exactly ${answerLetters.length} characters.`);
  }

  const statuses = computeFeedback(inputData.guess, riddle.answer);
  const feedback = guessLetters.map((letter, index) => ({letter, status: statuses[index]}));
  const isCorrect = normalizeAnswer(inputData.guess, run.locale) === normalizeAnswer(riddle.answer, run.locale);
  run.guessesUsed += 1;

  if (isCorrect) {
    run.correctCount += 1;
    appendEvent(run, "correct", nowMs, 0);
    if (run.correctCount >= RACE_TARGET_CORRECT) {
      const adjustedFinishMs = raceClock(run, nowMs).adjustedElapsedMs;
      const result: RaceOutcome["result"] = run.opponent
        ? adjustedFinishMs < run.opponent.adjustedFinishMs
          ? "player_win"
          : "tie"
        : "recorded";
      return {run: finishRun(run, result, adjustedFinishMs), feedback, isCorrect, autoSkipped: false};
    }
    advanceRiddle(run, nowMs);
    return {run, feedback, isCorrect, autoSkipped: false};
  }

  if (run.guessesUsed >= RACE_MAX_GUESSES_PER_RIDDLE) {
    run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
    appendEvent(run, "skip", nowMs, RACE_SKIP_PENALTY_MS);
    advanceRiddle(run, nowMs);
    return {run: finalizeAfterPenalty(run, nowMs), feedback, isCorrect, autoSkipped: true};
  }

  return {run, feedback, isCorrect, autoSkipped: false};
}

/** Reveals one server-selected letter and applies the configured hint penalty. */
export function applyRaceHint(
  input: RaceRunRecord,
  inputData: {riddleId: string},
  nowMs: number,
): {run: RaceRunRecord; revealedLetter: string; index: number} {
  const run = refreshRaceRun(input, nowMs);
  const riddle = requireActiveRiddle(run, inputData.riddleId);
  if (run.hintUsed) throw new HttpsError("failed-precondition", "The race hint for this riddle is already used.");

  const answer = splitGraphemes(riddle.answer, run.locale);
  const revealed = new Set(run.revealedLetters.map((letter) => letter.index));
  const index = answer.findIndex((_, candidateIndex) => !revealed.has(candidateIndex));
  if (index < 0) throw new HttpsError("failed-precondition", "No unrevealed race hint is available.");

  run.hintUsed = true;
  run.hintPenaltyMs += RACE_HINT_PENALTY_MS;
  const revealedLetter = answer[index];
  run.revealedLetters.push({index, letter: revealedLetter});
  appendEvent(run, "hint", nowMs, RACE_HINT_PENALTY_MS);
  return {run: finalizeAfterPenalty(run, nowMs), revealedLetter, index};
}

/** Skips the current riddle after a guess and applies the configured penalty. */
export function applyRaceSkip(input: RaceRunRecord, inputData: {riddleId: string}, nowMs: number): RaceRunRecord {
  const run = refreshRaceRun(input, nowMs);
  requireActiveRiddle(run, inputData.riddleId);
  if (run.guessesUsed < 1) {
    throw new HttpsError("failed-precondition", "Submit at least one guess before skipping a race riddle.");
  }
  run.skipPenaltyMs += RACE_SKIP_PENALTY_MS;
  appendEvent(run, "skip", nowMs, RACE_SKIP_PENALTY_MS);
  advanceRiddle(run, nowMs);
  return finalizeAfterPenalty(run, nowMs);
}

/** Marks an active run abandoned without producing a competitive result. */
export function abandonRaceRun(input: RaceRunRecord, nowMs: number): RaceRunRecord {
  const run = refreshRaceRun(input, nowMs);
  if (run.status === "abandoned") return run;
  if (run.status !== "active") {
    throw new HttpsError("failed-precondition", "This Race to 10 run already has a final result.");
  }
  const clock = raceClock(run, nowMs);
  return {
    ...run,
    status: "abandoned",
    result: null,
    wallFinishMs: clock.wallElapsedMs,
    finishedAtMs: nowMs,
  };
}

/** Projects server-only run state into the answer-safe client response. */
export function toRaceRunView(input: RaceRunRecord, nowMs: number): RaceRunView {
  const run = refreshRaceRun(input, nowMs);
  const clock = raceClock(run, nowMs);
  const current = run.status === "active" ? run.riddles[run.currentPosition] : undefined;
  const linkedOpponentIdentity = typeof run.opponent?.subjectUserId === "string" &&
    run.opponent.subjectUserId.length > 0;
  return {
    runId: run.runId,
    challengeId: run.challengeId,
    rivalryChallengeId: run.rivalryChallengeId,
    role: run.role,
    status: run.status,
    categoryId: run.categoryId,
    locale: run.locale,
    rules: RACE_RULES,
    correctCount: run.correctCount,
    wallElapsedMs: clock.wallElapsedMs,
    totalPenaltyMs: clock.totalPenaltyMs,
    adjustedElapsedMs: clock.adjustedElapsedMs,
    currentRiddle: current
      ? {
          riddleId: current.riddleId,
          text: current.text,
          answerLength: splitGraphemes(current.answer, run.locale).length,
          position: current.position,
          guessesUsed: run.guessesUsed,
          guessesRemaining: RACE_MAX_GUESSES_PER_RIDDLE - run.guessesUsed,
          hintAvailable: !run.hintUsed,
          revealedLetters: run.revealedLetters.map((letter) => ({...letter})),
        }
      : null,
    events: run.events.map((event) => ({...event})),
    opponent: run.opponent
      ? {
          displayName: linkedOpponentIdentity ? run.opponent.displayName : "Riddle Quest player",
          ...(linkedOpponentIdentity ? {avatarUrl: run.opponent.avatarUrl} : {}),
          adjustedFinishMs: run.opponent.adjustedFinishMs,
          events: run.opponent.events.map((event) => ({...event})),
        }
      : undefined,
  };
}

/** Produces the final public outcome for a completed authoritative run. */
export function raceOutcome(run: RaceRunRecord, nowMs: number): RaceOutcome {
  const refreshed = refreshRaceRun(run, nowMs);
  const clock = raceClock(refreshed, nowMs);
  const totalPenaltyMs = refreshed.hintPenaltyMs + refreshed.skipPenaltyMs;
  if (!refreshed.result || refreshed.status === "active") {
    throw new HttpsError("failed-precondition", "The Race to 10 run does not have a final outcome yet.");
  }
  return {
    runId: refreshed.runId,
    challengeId: refreshed.challengeId,
    result: refreshed.result,
    correctCount: refreshed.correctCount,
    wallFinishMs: clock.wallElapsedMs,
    hintPenaltyMs: refreshed.hintPenaltyMs,
    skipPenaltyMs: refreshed.skipPenaltyMs,
    totalPenaltyMs,
    adjustedFinishMs: clock.adjustedElapsedMs,
    opponentAdjustedFinishMs: refreshed.opponent?.adjustedFinishMs,
    publishable: refreshed.role === "creator" && refreshed.result === "recorded" && refreshed.correctCount === 10,
    rematchEligible: refreshed.role === "challenger" && refreshed.status === "completed",
    newlyUnlockedAchievementIds: [],
    achievementCoinsAwarded: 0,
  };
}
