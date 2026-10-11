import {splitGraphemes, type Feedback, type ScoredGuess} from "@qwordly/core/game";
import type {RaceOutcome, RaceRunView} from "@qwordly/core/race";

/** Non-null riddle prompt presented during an active race. */
type RaceRiddle = NonNullable<RaceRunView["currentRiddle"]>;

/** Formats milliseconds as the minute-and-tenths display used by Race to 10. */
export const formatRaceTime = (milliseconds: number): string => {
  /** Round the entire duration once so the last tenth carries into the minute field. */
  const tenths = Math.round(Math.max(0, milliseconds) / 100);
  return `${Math.floor(tenths / 600)}:${Math.floor(tenths % 600 / 10).toString().padStart(2, "0")}.${tenths % 10}`;
};

/** Creates an editable answer attempt populated with server-revealed letters. */
export const createRaceAttempt = (riddle: RaceRiddle | null): string[] => {
  if (!riddle) return [];
  /** Server-authoritative letters indexed by their answer position. */
  const revealed = new Map(riddle.revealedLetters.map(({index, letter}) => [index, letter]));
  return Array.from({length: riddle.answerLength}, (_, index) => revealed.get(index) ?? "");
};

/** Finds the first answer slot that has not been revealed by the server. */
export const findFirstEditableRaceSlot = (riddle: RaceRiddle | null): number => {
  if (!riddle) return 0;
  /** Answer positions already fixed by server-authoritative hints. */
  const revealed = new Set(riddle.revealedLetters.map(({index}) => index));
  return (
    Array.from({length: riddle.answerLength}, (_, position) => position).find((position) => !revealed.has(position)) ??
    0
  );
};

/** Immediately advances to the already-downloaded next riddle while the server records the skip. */
export const projectInstantRaceSkip = (run: RaceRunView): RaceRunView | null => {
  if (run.status !== "active" || !run.currentRiddle || !run.preloadedRiddles) return null;
  /** Cleared-riddle count shown immediately while the authoritative mutation is in flight. */
  const correctCount = Math.min(run.rules.targetCorrect, run.correctCount + 1);
  /** Immutable prompt selected from the deck downloaded before the countdown completed. */
  const next = run.preloadedRiddles[run.currentRiddle.position + 1];
  return {
    ...run,
    status: correctCount >= run.rules.targetCorrect ? "completed" : next ? "active" : "timed_out",
    correctCount,
    totalPenaltyMs: run.totalPenaltyMs + run.rules.skipPenaltyMs,
    adjustedElapsedMs: run.adjustedElapsedMs + run.rules.skipPenaltyMs,
    currentRiddle: correctCount < run.rules.targetCorrect && next
      ? {
          ...next,
          guessesUsed: 0,
          guessesRemaining: run.rules.maxGuessesPerRiddle,
          hintAvailable: true,
          revealedLetters: [],
        }
      : null,
  };
};

/** Shows the next downloaded riddle as soon as a correct guess is submitted. */
export const projectInstantCorrectGuess = (run: RaceRunView): RaceRunView | null => {
  if (run.status !== "active" || !run.currentRiddle || !run.preloadedRiddles ||
    run.correctCount + 1 >= run.rules.targetCorrect) return null;
  /** Provides next behavior. */
  const next = run.preloadedRiddles[run.currentRiddle.position + 1];
  if (!next) return null;
  return {
    ...run,
    correctCount: run.correctCount + 1,
    currentRiddle: {
      ...next,
      guessesUsed: 0,
      guessesRemaining: run.rules.maxGuessesPerRiddle,
      hintAvailable: true,
      revealedLetters: [],
    },
  };
};

/** Immediately reveals the next preloaded answer letter while the server records the hint. */
export const projectInstantRaceHint = (run: RaceRunView): RaceRunView | null => {
  if (run.status !== "active" || !run.currentRiddle?.hintAvailable || !run.preloadedRiddles) return null;
  /** Match the server's first-unrevealed-letter rule for every hint request. */
  const preloaded = run.preloadedRiddles[run.currentRiddle.position];
  if (!preloaded) return null;
  /** Preloaded answer divided into the same graphemes as the server. */
  const answer = splitGraphemes(preloaded.evaluation.answer, preloaded.evaluation.locale);
  /** Positions already revealed in this riddle. */
  const revealed = new Set(run.currentRiddle.revealedLetters.map((letter) => letter.index));
  if (revealed.size >= run.rules.maxHintsPerRiddle) return null;
  /** First still-hidden answer position. */
  const index = answer.findIndex((_, candidateIndex) => !revealed.has(candidateIndex));
  if (index < 0) return null;
  /** Letter and position displayed while the request is in flight. */
  const hint = {index, letter: answer[index]};
  return {
    ...run,
    totalPenaltyMs: run.totalPenaltyMs + run.rules.hintPenaltyMs,
    adjustedElapsedMs: run.adjustedElapsedMs + run.rules.hintPenaltyMs,
    currentRiddle: {
      ...run.currentRiddle,
      hintAvailable: revealed.size + 1 < Math.min(answer.length, run.rules.maxHintsPerRiddle),
      revealedLetters: [...run.currentRiddle.revealedLetters, hint],
    },
  };
};

/** Advances active server clocks locally, preserving confirmed terminal clocks without clamping. */
export const getAdjustedRaceTime = (run: RaceRunView | null, receivedAtMs: number, nowMs = Date.now()): number =>
  run
    ? run.role === "challenger" && run.status === "active"
      ? Math.min(
          run.rules.maxAdjustedTimeMs,
          run.adjustedElapsedMs + nowMs - receivedAtMs,
        )
      : run.adjustedElapsedMs + (run.status === "active" ? nowMs - receivedAtMs : 0)
    : 0;

/** Projects a terminal result that is already determined by authoritative run data. */
export const projectRaceOutcome = (run: RaceRunView, adjustedNow: number): RaceOutcome | null => {
  if (["abandoned", "prepared", "scheduled"].includes(run.status)) return null;
  /** Whether the challenger adjusted-time limit has conclusively elapsed. */
  const timedOut = run.status === "timed_out" ||
    (run.role === "challenger" && run.status === "active" && adjustedNow >= run.rules.maxAdjustedTimeMs);
  /** Whether the server-issued opponent time has conclusively elapsed. */
  const opponentFinished = Boolean(
    run.opponent && run.status === "active" && adjustedNow > run.opponent.adjustedFinishMs,
  );
  if (run.status === "active" && !timedOut && !opponentFinished) return null;
  /** Final result implied by the authoritative status, score, role, and opponent time. */
  const result: RaceOutcome["result"] = timedOut
    ? "timed_out"
    : run.role === "creator"
      ? "recorded"
      : run.correctCount < run.rules.targetCorrect
        ? "ghost_win"
        : run.opponent && run.adjustedElapsedMs < run.opponent.adjustedFinishMs
          ? "player_win"
          : run.opponent && run.adjustedElapsedMs > run.opponent.adjustedFinishMs
            ? "ghost_win"
            : "tie";
  /** Exact adjusted finish time fixed by the applicable terminal rule. */
  const adjustedFinishMs = run.status === "timed_out"
    ? run.adjustedElapsedMs
    : timedOut
      ? run.rules.maxAdjustedTimeMs
    : opponentFinished
      ? run.opponent!.adjustedFinishMs
      : run.adjustedElapsedMs;
  /** Penalties split from the authoritative event history for immediate result presentation. */
  const hintPenaltyMs = run.events
    .filter((event) => event.type === "hint")
    .reduce((total, event) => total + event.penaltyAddedMs, 0);
  /** Skip penalties split from the authoritative event history for immediate result presentation. */
  const skipPenaltyMs = run.events
    .filter((event) => event.type === "skip")
    .reduce((total, event) => total + event.penaltyAddedMs, 0);
  return {
    runId: run.runId,
    challengeId: run.challengeId,
    result,
    correctCount: run.correctCount,
    wallFinishMs: Math.max(0, adjustedFinishMs - run.totalPenaltyMs),
    hintPenaltyMs,
    skipPenaltyMs,
    totalPenaltyMs: run.totalPenaltyMs,
    adjustedFinishMs,
    opponentAdjustedFinishMs: run.opponent?.adjustedFinishMs,
    publishable: result === "recorded" && run.correctCount === run.rules.targetCorrect,
    rematchEligible: result === "player_win" || result === "ghost_win" || result === "tie",
    newlyUnlockedAchievementIds: [],
    achievementCoinsAwarded: 0,
  };
};

/** Applies a confirmed outcome to the latest public run view. */
export const applyRaceOutcome = (run: RaceRunView, outcome: RaceOutcome): RaceRunView => ({
  ...run,
  status: outcome.result === "timed_out" ? "timed_out" : "completed",
  correctCount: outcome.correctCount,
  wallElapsedMs: outcome.wallFinishMs,
  totalPenaltyMs: outcome.totalPenaltyMs,
  adjustedElapsedMs: outcome.adjustedFinishMs,
  currentRiddle: null,
});

/** Confirmed presence outranks absence, and a correct position outranks presence. */
const raceFeedbackStrength: Record<Feedback, number> = {red: 0, yellow: 1, green: 2};

/** Stable content key for a confirmed guess history, so equal histories from separate polls compare equal. */
export const confirmedGuessesKey = (guesses: readonly ScoredGuess[] | undefined): string =>
  guesses ? guesses.map(({guess, feedback}) => `${guess.join("\u0000")}\u0001${feedback.join(",")}`).join("\u0002") : "";

/** Keeps the strongest server-scored feedback observed for each keyboard letter. */
export const getRaceLetterStates = (guesses: readonly ScoredGuess[]): Record<string, Feedback> => {
  /** Provides states behavior. */
  const states: Record<string, Feedback> = {};
  for (const scoredGuess of guesses) {
    scoredGuess.guess.forEach((letter, index) => {
      /** Provides status behavior. */
      const status = scoredGuess.feedback[index];
      if (!letter || !status || (raceFeedbackStrength[states[letter.toLowerCase()]] ?? 0) > (raceFeedbackStrength[status] ?? 0)) return;
      states[letter.toLowerCase()] = status;
    });
  }
  return states;
};
