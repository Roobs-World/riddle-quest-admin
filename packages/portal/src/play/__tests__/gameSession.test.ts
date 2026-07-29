import {describe, expect, it} from "@jest/globals";
import {
  createInitialGameSession,
  gameSessionReducer,
  getCurrentGuessValue,
  type GameSessionAction,
  type GameSessionState,
} from "../gameSession";

const riddle = {
  riddleId: "classic-1",
  text: "What has keys but cannot open doors?",
  answer: "piano",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
};

const reduce = (state: GameSessionState, action: GameSessionAction) => gameSessionReducer(state, action);

describe("game session reducer", () => {
  it("loads a riddle and wins with a correct guess", () => {
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (const letter of ["P", "I", "A", "N", "O"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    expect(getCurrentGuessValue(state)).toBe("piano");

    state = reduce(state, {type: "submitGuess"});

    expect(state.modal).toBe("victory");
    expect(state.lastOutcome).toEqual(
      expect.objectContaining({
        kind: "win",
        riddleId: "classic-1",
        isCorrect: true,
      }),
    );
    expect(state.letterStates.p).toBe("green");
  });

  it("can reveal a hinted letter and update coins", () => {
    let state = reduce(createInitialGameSession(), {
      type: "hostInit",
      locale: "en",
      gameMode: "classic",
      user: null,
      profile: {
        username: "Guest",
        coins: 100,
        level: 1,
        xp: 0,
        winStreak: 0,
        gamesPlayed: 0,
        wins: 0,
        achievements: [],
        classicIndex: 1,
      },
      products: [],
    });
    state = reduce(state, {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A", newCoins: 75});

    expect(state.currentLetters[2]).toBe("A");
    expect(state.profile?.coins).toBe(75);
  });

  it("grants a continue by resetting local attempts", () => {
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      for (const letter of ["C", "L", "O", "C", "K"]) {
        state = reduce(state, {type: "typeLetter", letter});
      }
      state = reduce(state, {type: "submitGuess"});
    }

    expect(state.modal).toBe("continue");
    state = reduce(state, {type: "continueGranted"});

    expect(state.modal).toBeNull();
    expect(state.guesses).toHaveLength(0);

    for (const letter of ["C", "L", "O", "C", "K"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    state = reduce(state, {type: "submitGuess"});

    expect(state.modal).toBe("loss");
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "loss", attempts: 6}));
  });

  it("locks hinted slots while allowing non-sequential editing", () => {
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A"});
    state = reduce(state, {type: "selectSlot", index: 4});
    state = reduce(state, {type: "typeLetter", letter: "O"});
    state = reduce(state, {type: "selectSlot", index: 0});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    state = reduce(state, {type: "selectSlot", index: 2});
    state = reduce(state, {type: "typeLetter", letter: "X"});

    expect(state.currentLetters).toEqual(["P", "X", "A", "", "O"]);
    expect(state.hintRevealedIndices).toEqual([2]);
  });
});
