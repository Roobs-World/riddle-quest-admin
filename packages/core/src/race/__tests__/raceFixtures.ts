import {
  RACE_DECK_SIZE,
  RACE_HINT_PENALTY_MS,
  RACE_SKIP_PENALTY_MS,
  type RaceGhostEvent,
  type RaceRiddlePrompt,
} from "../raceSchemas";

/** Creates prompt. */
const createPrompt = (position: number): RaceRiddlePrompt => ({
  riddleId: `history-en-${String(position + 1).padStart(2, "0")}`,
  text: `Deterministic history fixture ${position + 1}`,
  answerLength: 5,
  position,
  guessesUsed: 0,
  guessesRemaining: 5,
  hintAvailable: true,
  revealedLetters: [],
});

/** Defines the english race deck fixture value. */
export const ENGLISH_RACE_DECK_FIXTURE = Array.from({length: RACE_DECK_SIZE}, (_, position) => createPrompt(position));

/** Defines the ghost timeline fixture value. */
export const GHOST_TIMELINE_FIXTURE: RaceGhostEvent[] = [
  {
    sequence: 0,
    type: "correct",
    riddlePosition: 0,
    wallElapsedMs: 8_000,
    penaltyAddedMs: 0,
    totalPenaltyMs: 0,
    adjustedElapsedMs: 8_000,
    correctCount: 1,
  },
  {
    sequence: 1,
    type: "hint",
    riddlePosition: 1,
    wallElapsedMs: 16_000,
    penaltyAddedMs: RACE_HINT_PENALTY_MS,
    totalPenaltyMs: RACE_HINT_PENALTY_MS,
    adjustedElapsedMs: 31_000,
    correctCount: 1,
  },
  {
    sequence: 2,
    type: "correct",
    riddlePosition: 1,
    wallElapsedMs: 24_000,
    penaltyAddedMs: 0,
    totalPenaltyMs: RACE_HINT_PENALTY_MS,
    adjustedElapsedMs: 39_000,
    correctCount: 2,
  },
  {
    sequence: 3,
    type: "skip",
    riddlePosition: 2,
    wallElapsedMs: 30_000,
    penaltyAddedMs: RACE_SKIP_PENALTY_MS,
    totalPenaltyMs: RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS,
    adjustedElapsedMs: 90_000,
    correctCount: 2,
  },
  ...Array.from({length: 8}, (_, index): RaceGhostEvent => {
    /** Provides correct count behavior. */
    const correctCount = index + 3;
    /** Provides wall elapsed ms behavior. */
    const wallElapsedMs = 40_000 + index * 10_000;
    return {
      sequence: index + 4,
      type: "correct",
      riddlePosition: index + 3,
      wallElapsedMs,
      penaltyAddedMs: 0,
      totalPenaltyMs: RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS,
      adjustedElapsedMs: wallElapsedMs + RACE_HINT_PENALTY_MS + RACE_SKIP_PENALTY_MS,
      correctCount,
    };
  }),
];
