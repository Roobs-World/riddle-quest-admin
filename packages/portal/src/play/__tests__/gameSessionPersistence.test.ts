import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession, gameSessionReducer} from "../gameSession";
import {createSavedGame} from "../game/hooks";

/** Provides riddle behavior. */
const riddle = {
  riddleId: "classic-persistence-1",
  sessionToken: "00000000-0000-4000-8000-000000000004",
  text: "What has keys but cannot open doors?",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
};

describe("game session persistence", () => {
  it("persists an unacknowledged terminal outcome and clears it only after acknowledgement", () => {
    expect(createSavedGame(createInitialGameSession(), 100)).toBeNull();

    /** Completes d. */
    let completed = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    for (const letter of ["P", "I", "A", "N", "O"]) {
      completed = gameSessionReducer(completed, {type: "typeLetter", letter});
    }
    completed = gameSessionReducer(completed, {type: "guessRequested"});
    completed = gameSessionReducer(completed, {
      type: "guessResolved",
      feedback: {guess: ["P", "I", "A", "N", "O"], feedback: ["green", "green", "green", "green", "green"]},
      attempts: 1,
      isCorrect: true,
      gameOver: true,
      canContinue: false,
    });
    expect(createSavedGame(completed, 100)).toMatchObject({
      schemaVersion: 1,
      savedAt: 100,
      riddleId: riddle.riddleId,
      sessionToken: riddle.sessionToken,
      pendingOutcome: {
        id: `${riddle.sessionToken}-win-1`,
        kind: "win",
        riddleId: riddle.riddleId,
        sessionToken: riddle.sessionToken,
        attempts: 1,
        isCorrect: true,
      },
    });

    completed = gameSessionReducer(completed, {type: "completionAcknowledged"});
    expect(createSavedGame(completed, 101)).toBeNull();
  });

  it("creates a stable versioned snapshot for an active session", () => {
    /** Provides active behavior. */
    let active = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    active = gameSessionReducer(active, {type: "typeLetter", letter: "P"});

    expect(createSavedGame(active, 123_456)).toEqual({
      schemaVersion: 1,
      savedAt: 123_456,
      riddleId: riddle.riddleId,
      sessionToken: riddle.sessionToken,
      gameMode: "classic",
      currentLetters: ["P", "", "", "", ""],
      activeSlotIndex: 1,
      hintRevealedIndices: [],
      guesses: [],
      engineSnapshot: active.engineSnapshot,
      awaitingContinue: false,
      letterStates: {},
    });
  });

  it("persists the bounded Continue decision state", () => {
    /** Provides awaiting behavior. */
    const awaiting = gameSessionReducer(createInitialGameSession(), {
      type: "loadRiddle",
      riddle: {...riddle, attemptsUsed: 5, awaitingContinue: true},
    });

    expect(createSavedGame(awaiting, 123_456)).toMatchObject({
      awaitingContinue: true,
      engineSnapshot: {attemptsUsed: 5, hasUsedContinue: false, gameOver: false},
    });
  });

  it("restores a dropped decline completion without racing a reopened Continue modal", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides awaiting behavior. */
    let awaiting = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    awaiting = gameSessionReducer(awaiting, {type: "declineContinue"});
    /** Saves d. */
    const saved = createSavedGame(awaiting, 123_456);
    if (!saved) throw new Error("Expected the pending decline to remain retryable.");

    /** Provides reloaded behavior. */
    let reloaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    reloaded = gameSessionReducer(reloaded, {
      type: "restoreSession",
      currentLetters: saved.currentLetters,
      activeSlotIndex: saved.activeSlotIndex,
      hintRevealedIndices: saved.hintRevealedIndices,
      guesses: saved.guesses,
      engineSnapshot: saved.engineSnapshot,
      awaitingContinue: saved.awaitingContinue,
      letterStates: saved.letterStates,
      pendingOutcome: saved.pendingOutcome,
    });

    expect(saved).toMatchObject({awaitingContinue: false, pendingOutcome: {kind: "loss", attempts: 5}});
    expect(reloaded.modal).toBeNull();
    expect(reloaded.lastOutcome).toMatchObject({kind: "loss", attempts: 5});
    expect(reloaded.engineSnapshot?.gameOver).toBe(true);
  });

  it("discards a stale saved decline when another tab already bought Continue", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides awaiting behavior. */
    let awaiting = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    awaiting = gameSessionReducer(awaiting, {type: "declineContinue"});
    /** Saves d. */
    const saved = createSavedGame(awaiting, 123_456);
    if (!saved) throw new Error("Expected a saved decline race fixture.");

    /** Provides continued riddle behavior. */
    const continuedRiddle = {
      ...riddle,
      attemptsUsed: 5,
      hasUsedContinue: true,
      awaitingContinue: false,
    };
    /** Provides reloaded behavior. */
    let reloaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: continuedRiddle});
    reloaded = gameSessionReducer(reloaded, {
      type: "restoreSession",
      currentLetters: saved.currentLetters,
      activeSlotIndex: saved.activeSlotIndex,
      hintRevealedIndices: saved.hintRevealedIndices,
      guesses: saved.guesses,
      engineSnapshot: saved.engineSnapshot,
      awaitingContinue: saved.awaitingContinue,
      letterStates: saved.letterStates,
      pendingOutcome: saved.pendingOutcome,
    });

    expect(reloaded.lastOutcome).toBeNull();
    expect(reloaded.modal).toBeNull();
    expect(reloaded.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: true, gameOver: false});
    for (const letter of ["P", "I", "A", "N", "O"]) {
      reloaded = gameSessionReducer(reloaded, {type: "typeLetter", letter});
    }
    reloaded = gameSessionReducer(reloaded, {type: "guessRequested"});
    expect(reloaded.guessPending).toBe(true);
    reloaded = gameSessionReducer(reloaded, {
      type: "guessResolved",
      feedback: {guess: ["P", "I", "A", "N", "O"], feedback: ["green", "green", "green", "green", "green"]},
      attempts: 6,
      isCorrect: true,
      gameOver: true,
      canContinue: false,
    });
    expect(reloaded.lastOutcome).toMatchObject({kind: "win", attempts: 6});
  });
});
