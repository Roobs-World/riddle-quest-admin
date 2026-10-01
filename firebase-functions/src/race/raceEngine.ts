import {computeFeedback, lowerCaseGraphemes, splitGraphemes} from "@qwordly/core/game";
import {
  RACE_RULES,
  type RaceCategoryId,
  type RaceGhostEvent,
  type RaceLocale,
  type RaceOutcome,
  type RaceRunStatus,
  type RaceRunView,
  type RaceRules,
} from "@qwordly/core/race";
import {HttpsError} from "firebase-functions/v2/https";

/** Bounds unscored deck preparation so repeatedly postponing readiness cannot extend one attempt. */
export const RACE_PREPARATION_WINDOW_MS = 30_000;
/** Server-scheduled countdown duration after readiness is accepted. */
export const RACE_START_LEAD_MS = 3_000;

/** Immutable riddle content captured when an authoritative race run starts. */
export type RaceRiddleSnapshot = {
  /** Archived server-authored difficulty used only for the versioned matching heuristic. */
  difficultyBand?: "easy" | "medium" | "hard";
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
  /** Internal synthetic rival marker; never projected to the player. */
  kind?: "bot";
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
  /** Owner-bound empty-pool receipt consumed by this immutable run. */
  fallbackOfferId?: string;
  /** Server-issued discovery receipt used only for owner-bound funnel attribution. */
  matchOfferId?: string;
  /** Server-only immutable source recording digest, independent of presentation and catalog tokens. */
  recordingFingerprint?: string;
  /** Storage contract revision; absent on supported legacy records. */
  recordVersion?: 1;
  /** Expiring unscored preparation; absent on legacy immediately-active runs. */
  preparationExpiresAtMs?: number;
  /** First accepted readiness clock, distinct from the future scored start. */
  readinessAcceptedAtMs?: number;
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
  /** Immutable rules executed by this run, including historical hint limits. */
  rulesSnapshot?: RaceRules;
  /** Exact immutable deck content fingerprint. */
  contentVersion?: string;
  /** Server-selected answer exposure policy for this recording. */
  evaluationPolicy?: "preloaded" | "server-only";
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
  /** Legacy first-hint marker retained for existing persisted runs. */
  hintUsed: boolean;
  /** Stores revealed letters. */
  revealedLetters: Array<{
    /** Stores index. */
    index: number; /** Stores letter. */
    /** Stores letter. */
    letter: string;
  }>;
  /** Stores started at ms. */
  startedAtMs: number;
  /** Latest accepted command clock, including wrong guesses that append no scoring event. */
  lastActionAtMs?: number;
  /** Indexed unattended-settlement deadline for a challenger run. */
  deadlineAtMs?: number;
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
  /** Immutable canonical terminal outcome recorded by settlement. */
  settledOutcome?: RaceOutcome;
  /** Idempotency marker for all terminal settlement paths. */
  settledAtMs?: number;
  /** Granted owner rewards retained until their first outcome presentation. */
  settlementAwards?: Pick<RaceOutcome, "newlyUnlockedAchievementIds" | "achievementCoinsAwarded">;
  /** Reward presentation marker, independent of the currency grant receipt. */
  achievementOutcomePresentedAtMs?: number;
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

/** Resolves immutable per-run rules; legacy runs retain their original supported version. */
export const raceRules = (run: RaceRunRecord): RaceRules => run.rulesSnapshot ?? RACE_RULES;

/** Prevents reordered commands and reads from preceding already accepted server progress. */
export function raceOperationAtMs(run: RaceRunRecord, sampledAtMs: number): number {
  /** Historical scoring events provide a floor for records predating the command marker. */
  const eventWallMs = run.events.reduce((latest, event) => Math.max(latest, event.wallElapsedMs), 0);
  /** Historical scheduled runs use the same fixed lead-in even before this marker existed. */
  const readinessAtMs = run.readinessAcceptedAtMs ?? (run.status === "scheduled" ? Math.max(0, run.startedAtMs - RACE_START_LEAD_MS) : 0);
  return Math.max(sampledAtMs, run.lastActionAtMs ?? 0, run.events.length ? run.startedAtMs + eventWallMs : 0,
    readinessAtMs, run.status === "active" ? run.startedAtMs : 0, run.status === "abandoned" ? run.finishedAtMs ?? 0 : 0,
    run.settledAtMs ?? 0, run.achievementProgressRecordedAtMs ?? 0, run.achievementOutcomePresentedAtMs ?? 0);
}

/** Recognizes old outcome grants which left active storage after an immutable deadline had already elapsed. */
export function raceHasLegacyTerminalGrant(run: Pick<RaceRunRecord, "recordVersion" | "achievementProgressRecordedAtMs" | "status" |
  "startedAtMs" | "hintPenaltyMs" | "skipPenaltyMs" | "rulesSnapshot" | "opponent">): boolean {
  if (run.recordVersion !== undefined || run.achievementProgressRecordedAtMs === undefined ||
    !["active", "completed", "timed_out"].includes(run.status) || run.achievementProgressRecordedAtMs < run.startedAtMs) return false;
  /** Prior outcome code applied the maximum to both roles and used strict ghost expiry. */
  const adjustedAtGrant = run.achievementProgressRecordedAtMs - run.startedAtMs + run.hintPenaltyMs + run.skipPenaltyMs;
  return Number.isSafeInteger(adjustedAtGrant) && (adjustedAtGrant >= (run.rulesSnapshot ?? RACE_RULES).maxAdjustedTimeMs ||
    run.opponent !== undefined && adjustedAtGrant > run.opponent.adjustedFinishMs);
}

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
  /** Provides total penalty ms behavior. */
  const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
  /** Provides wall elapsed ms behavior. */
  const wallElapsedMs = run.wallFinishMs ?? (run.status === "prepared" ? 0 : Math.max(0, raceOperationAtMs(run, nowMs) - run.startedAtMs));
  return {wallElapsedMs, totalPenaltyMs, adjustedElapsedMs: wallElapsedMs + totalPenaltyMs};
}

/** Computes the next authoritative ghost/maximum-time deadline after penalties. */
export function raceDeadlineAtMs(run: RaceRunRecord): number | undefined {
  if (run.status === "prepared") return run.preparationExpiresAtMs;
  if (!["active", "scheduled"].includes(run.status)) return undefined;
  if (run.role === "creator") return undefined;
  /** Provides maximum behavior. */
  const maximum = raceRules(run).maxAdjustedTimeMs;
  /** Provides target behavior. */
  const target = Math.min(maximum, run.opponent ? run.opponent.adjustedFinishMs + 1 : maximum);
  return run.startedAtMs + Math.max(0, target - run.hintPenaltyMs - run.skipPenaltyMs);
}

/** Provides finish run behavior. */
const finishRun = (
  run: RaceRunRecord,
  result: NonNullable<RaceRunRecord["result"]>,
  adjustedFinishMs: number,
): RaceRunRecord => {
  /** Provides total penalty ms behavior. */
  const totalPenaltyMs = run.hintPenaltyMs + run.skipPenaltyMs;
  /** Provides wall finish ms behavior. */
  const wallFinishMs = Math.max(0, adjustedFinishMs - totalPenaltyMs);
  return {
    ...run,
    status: result === "timed_out" ? "timed_out" : "completed",
    result,
    wallFinishMs,
    finishedAtMs: run.startedAtMs + wallFinishMs,
  };
};

/** Completes a run once the tenth riddle has been cleared, whether answered or skipped. */
const finishCompletedRun = (run: RaceRunRecord, nowMs: number): RaceRunRecord => {
  /** Adjusted finish time after any penalty attached to the clearing action. */
  const adjustedFinishMs = raceClock(run, nowMs).adjustedElapsedMs;
  /** Competitive result determined against the immutable opponent finish time. */
  const result: RaceOutcome["result"] = run.opponent
    ? adjustedFinishMs < run.opponent.adjustedFinishMs
      ? "player_win"
      : adjustedFinishMs === run.opponent.adjustedFinishMs ? "tie" : "ghost_win"
    : "recorded";
  return finishRun(run, result, adjustedFinishMs);
};

/** Refreshes time-dependent run state, including timeout and ghost completion. */
export function refreshRaceRun(input: RaceRunRecord, nowMs: number): RaceRunRecord {
  /** Scheduling and deadlines share the same accepted-progress floor as scoring. */
  const operationAtMs = raceOperationAtMs(input, nowMs);
  /** Provides run behavior. */
  const run = copyRun(input);
  if (run.status === "prepared") {
    if (run.preparationExpiresAtMs !== undefined && operationAtMs >= run.preparationExpiresAtMs) {
      return {...run, status: "abandoned", result: null, wallFinishMs: 0, finishedAtMs: operationAtMs};
    }
    return run;
  }
  if (run.status === "scheduled" && operationAtMs >= run.startedAtMs) run.status = "active";
  if (run.status !== "active") return run;
  /** Provides clock behavior. */
  const clock = raceClock(run, run.status === "active" && raceHasLegacyTerminalGrant(run) ? run.achievementProgressRecordedAtMs! : nowMs);
  if ((run.role === "challenger" || raceHasLegacyTerminalGrant(run)) && clock.adjustedElapsedMs >= raceRules(run).maxAdjustedTimeMs) {
    return finishRun(run, "timed_out", raceRules(run).maxAdjustedTimeMs);
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
  /** Provides riddle behavior. */
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
  /** Provides clock behavior. */
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
  if (run.currentPosition >= run.riddles.length && run.correctCount < raceRules(run).targetCorrect) {
    /** Provides clock behavior. */
    const clock = raceClock(run, nowMs);
    Object.assign(run, finishRun(run, "timed_out", Math.min(clock.adjustedElapsedMs, raceRules(run).maxAdjustedTimeMs)));
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
  inputData: {
    /** Stores riddle id. */
    riddleId: string; /** Stores guess. */
    /** Stores guess. */
    guess: string;
  },
  nowMs: number,
): {
  /** Stores run. */
  run: RaceRunRecord;
  /** Stores feedback. */
  feedback: Array<{
    /** Stores letter. */
    letter: string; /** Stores status. */
    /** Stores status. */
    status: "green" | "yellow" | "red";
  }>;
  /** Stores is correct. */
  isCorrect: boolean;
  /** Stores auto skipped. */
  autoSkipped: boolean;
} {
  /** Provides run behavior. */
  const run = refreshRaceRun(input, nowMs);
  /** Provides riddle behavior. */
  const riddle = requireActiveRiddle(run, inputData.riddleId);
  /** Provides guess letters behavior. */
  const guessLetters = splitGraphemes(inputData.guess.trim(), run.locale);
  /** Provides answer letters behavior. */
  const answerLetters = splitGraphemes(riddle.answer, run.locale);
  if (guessLetters.length !== answerLetters.length) {
    throw new HttpsError("invalid-argument", `Guess must contain exactly ${answerLetters.length} characters.`);
  }

  /** Provides statuses behavior. */
  const statuses = computeFeedback(inputData.guess.trim(), riddle.answer, run.locale);
  /** Provides feedback behavior. */
  const feedback = guessLetters.map((letter, index) => ({letter, status: statuses[index]}));
  /** Indicates whether is correct. */
  const isCorrect = normalizeAnswer(inputData.guess, run.locale) === normalizeAnswer(riddle.answer, run.locale);
  run.guessesUsed += 1;

  if (isCorrect) {
    run.correctCount += 1;
    appendEvent(run, "correct", nowMs, 0);
    if (run.correctCount >= raceRules(run).targetCorrect) {
      return {run: finishCompletedRun(run, nowMs), feedback, isCorrect, autoSkipped: false};
    }
    advanceRiddle(run, nowMs);
    return {run, feedback, isCorrect, autoSkipped: false};
  }

  if (run.guessesUsed >= raceRules(run).maxGuessesPerRiddle) {
    run.skipPenaltyMs += raceRules(run).skipPenaltyMs;
    run.correctCount += 1;
    appendEvent(run, "skip", nowMs, raceRules(run).skipPenaltyMs);
    if (run.correctCount >= raceRules(run).targetCorrect) {
      return {run: finishCompletedRun(run, nowMs), feedback, isCorrect, autoSkipped: true};
    }
    advanceRiddle(run, nowMs);
    return {run: finalizeAfterPenalty(run, nowMs), feedback, isCorrect, autoSkipped: true};
  }

  return {run, feedback, isCorrect, autoSkipped: false};
}

/** Reveals one server-selected letter and applies the configured hint penalty. */
export function applyRaceHint(
  input: RaceRunRecord,
  inputData: {
    /** Stores riddle id. */
    riddleId: string;
  },
  nowMs: number,
): {
  /** Stores run. */
  run: RaceRunRecord; /** Stores revealed letter. */
  /** Stores revealed letter. */
  revealedLetter: string; /** Stores index. */
  /** Stores index. */
  index: number;
} {
  /** Provides run behavior. */
  const run = refreshRaceRun(input, nowMs);
  /** Provides riddle behavior. */
  const riddle = requireActiveRiddle(run, inputData.riddleId);
  /** Provides answer behavior. */
  const answer = splitGraphemes(riddle.answer, run.locale);
  /** Provides revealed behavior. */
  const revealed = new Set(run.revealedLetters.map((letter) => letter.index));
  /** Provides index behavior. */
  const index = answer.findIndex((_, candidateIndex) => !revealed.has(candidateIndex));
  if (run.revealedLetters.length >= raceRules(run).maxHintsPerRiddle || index < 0) throw new HttpsError("failed-precondition", "No unrevealed race hint is available.");

  run.hintUsed = true;
  run.hintPenaltyMs += raceRules(run).hintPenaltyMs;
  /** Provides revealed letter behavior. */
  const revealedLetter = answer[index];
  run.revealedLetters.push({index, letter: revealedLetter});
  appendEvent(run, "hint", nowMs, raceRules(run).hintPenaltyMs);
  return {run: finalizeAfterPenalty(run, nowMs), revealedLetter, index};
}

/** Skips the current riddle after a guess and applies the configured penalty. */
export function applyRaceSkip(
  input: RaceRunRecord,
  inputData: {
    /** Stores riddle id. */
    riddleId: string;
  },
  nowMs: number,
): RaceRunRecord {
  /** Provides run behavior. */
  const run = refreshRaceRun(input, nowMs);
  requireActiveRiddle(run, inputData.riddleId);
  run.skipPenaltyMs += raceRules(run).skipPenaltyMs;
  run.correctCount += 1;
  appendEvent(run, "skip", nowMs, raceRules(run).skipPenaltyMs);
  if (run.correctCount >= raceRules(run).targetCorrect) return finishCompletedRun(run, nowMs);
  advanceRiddle(run, nowMs);
  return finalizeAfterPenalty(run, nowMs);
}

/** Marks an active run abandoned without producing a competitive result. */
export function abandonRaceRun(input: RaceRunRecord, nowMs: number): RaceRunRecord {
  /** Provides run behavior. */
  const run = refreshRaceRun(input, nowMs);
  if (run.status === "abandoned") return run;
  if (!["prepared", "scheduled", "active"].includes(run.status)) {
    throw new HttpsError("failed-precondition", "This Race to 10 run already has a final result.");
  }
  /** Provides clock behavior. */
  const clock = raceClock(run, nowMs);
  return {
    ...run,
    status: "abandoned",
    result: null,
    wallFinishMs: clock.wallElapsedMs,
    finishedAtMs: raceOperationAtMs(run, nowMs),
  };
}

/** Projects server-only run state, optionally including the complete immutable evaluation deck. */
export function toRaceRunView(input: RaceRunRecord, nowMs: number, includeEvaluation = false): RaceRunView {
  /** Provides run behavior. */
  const run = refreshRaceRun(input, nowMs);
  includeEvaluation = includeEvaluation && run.evaluationPolicy !== "server-only";
  /** Provides clock behavior. */
  const clock = raceClock(run, nowMs);
  /** Provides current behavior. */
  const current = ["prepared", "scheduled", "active"].includes(run.status) ? run.riddles[run.currentPosition] : undefined;
  /** Provides linked opponent identity behavior. */
  const linkedOpponentIdentity =
    typeof run.opponent?.subjectUserId === "string" && run.opponent.subjectUserId.length > 0;
  return {
    runId: run.runId,
    challengeId: run.challengeId,
    rivalryChallengeId: run.rivalryChallengeId,
    role: run.role,
    status: run.status,
    serverNowMs: raceOperationAtMs(run, nowMs),
    ...(run.status !== "prepared" ? {startsAtMs: run.startedAtMs} : {}),
    ...(run.preparationExpiresAtMs !== undefined ? {preparationExpiresAtMs: run.preparationExpiresAtMs} : {}),
    categoryId: run.categoryId,
    locale: run.locale,
    rules: raceRules(run),
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
          guessesRemaining: raceRules(run).maxGuessesPerRiddle - run.guessesUsed,
          hintAvailable: run.revealedLetters.length < Math.min(raceRules(run).maxHintsPerRiddle, splitGraphemes(current.answer, run.locale).length),
          revealedLetters: run.revealedLetters.map((letter) => ({...letter})),
          ...(includeEvaluation ? {evaluation: {answer: current.answer, locale: run.locale}} : {}),
        }
      : null,
    ...(includeEvaluation
      ? {
          preloadedRiddles: run.riddles.map((riddle) => ({
            /** Graphemes are computed once so the exact server hint is available before play. */
            hint: {index: 0, letter: splitGraphemes(riddle.answer, run.locale)[0]},
            riddleId: riddle.riddleId,
            text: riddle.text,
            answerLength: splitGraphemes(riddle.answer, run.locale).length,
            position: riddle.position,
            evaluation: {answer: riddle.answer, locale: run.locale},
          })),
        }
      : {}),
    events: run.events.map((event) => ({...event})),
    opponent: run.opponent
      ? {
          displayName: linkedOpponentIdentity || run.opponent.kind === "bot" ? run.opponent.displayName : "Riddle Quest player",
          ...(linkedOpponentIdentity ? {avatarUrl: run.opponent.avatarUrl} : {}),
          adjustedFinishMs: run.opponent.adjustedFinishMs,
          events: run.opponent.events.map((event) => ({...event})),
        }
      : undefined,
  };
}

/** Produces the final public outcome for a completed authoritative run. */
export function raceOutcome(run: RaceRunRecord, nowMs: number): RaceOutcome {
  /** Provides refreshed behavior. */
  const refreshed = refreshRaceRun(run, nowMs);
  /** Provides clock behavior. */
  const clock = raceClock(refreshed, nowMs);
  /** Provides total penalty ms behavior. */
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
    publishable: refreshed.role === "creator" && refreshed.result === "recorded" && refreshed.correctCount === raceRules(refreshed).targetCorrect,
    rematchEligible: refreshed.role === "challenger" && refreshed.status === "completed",
    newlyUnlockedAchievementIds: [],
    achievementCoinsAwarded: 0,
  };
}
