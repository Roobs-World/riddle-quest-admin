import {computeLetterStates} from "../computeLetterStates";
import type {ScoredGuess} from "../types";

function makeGuess(word: string, feedbacks: ("green" | "yellow" | "red")[]): ScoredGuess {
  return {guess: word.split(""), feedback: feedbacks};
}

describe("computeLetterStates", () => {
  it("returns empty object when no guesses", () => {
    expect(computeLetterStates([])).toEqual({});
  });

  it("maps each letter to its feedback state from a single guess", () => {
    const guesses = [makeGuess("hello", ["green", "red", "yellow", "red", "green"])];
    const states = computeLetterStates(guesses);
    expect(states.h).toBe("green");
    expect(states.e).toBe("red");
    expect(states.l).toBe("yellow");
    expect(states.o).toBe("green");
  });

  it("green beats yellow and red across guesses", () => {
    const guesses = [
      makeGuess("apple", ["yellow", "red", "red", "red", "red"]),
      makeGuess("avail", ["green", "red", "red", "red", "red"]),
    ];
    expect(computeLetterStates(guesses).a).toBe("green");
  });
});
