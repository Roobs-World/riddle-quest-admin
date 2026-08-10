import {describe, expect, it} from "@jest/globals";
import {createInitialGameSession, gameSessionReducer} from "../gameSession";
import {createSavedGame} from "../game/hooks";

const riddle = {
  riddleId: "classic-persistence-1",
  text: "What has keys but cannot open doors?",
  answer: "piano",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
};

describe("game session persistence", () => {
  it("does not persist an unloaded or completed session", () => {
    expect(createSavedGame(createInitialGameSession(), 100)).toBeNull();

    let completed = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    for (const letter of ["P", "I", "A", "N", "O"]) {
      completed = gameSessionReducer(completed, {type: "typeLetter", letter});
    }
    completed = gameSessionReducer(completed, {type: "submitGuess"});
    expect(createSavedGame(completed, 100)).toBeNull();
  });

  it("creates a stable versioned snapshot for an active session", () => {
    let active = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    active = gameSessionReducer(active, {type: "typeLetter", letter: "P"});

    expect(createSavedGame(active, 123_456)).toEqual({
      schemaVersion: 1,
      savedAt: 123_456,
      riddleId: riddle.riddleId,
      gameMode: "classic",
      currentLetters: ["P", "", "", "", ""],
      activeSlotIndex: 1,
      hintRevealedIndices: [],
      guesses: [],
      engineSnapshot: active.engineSnapshot,
      letterStates: {},
    });
  });
});
