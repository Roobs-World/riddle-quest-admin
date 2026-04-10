import { computeLetterStates } from "../letterStates";
import type { SubmittedGuess } from "../../hooks/types";

function makeGuess(
  word: string,
  feedbacks: ("green" | "yellow" | "red")[]
): SubmittedGuess {
  return { guess: word.split(""), feedback: feedbacks };
}

describe("computeLetterStates", () => {
  it("returns empty object when no guesses", () => {
    expect(computeLetterStates([])).toEqual({});
  });

  it("maps each letter to its feedback state from a single guess", () => {
    const guesses = [makeGuess("hello", ["green", "red", "yellow", "red", "green"])];
    const states = computeLetterStates(guesses);
    expect(states["h"]).toBe("green");
    expect(states["e"]).toBe("red");
    expect(states["l"]).toBe("yellow"); // first l wins (index 2), red at index 3 is lower priority
    expect(states["o"]).toBe("green");
  });

  it("uses lowercase keys regardless of guess casing", () => {
    const guesses = [makeGuess("APPLE", ["green", "red", "red", "red", "red"])];
    const states = computeLetterStates(guesses);
    expect(states["a"]).toBe("green");
    expect(states["p"]).toBe("red");
  });

  it("green beats yellow and red", () => {
    const guesses = [
      makeGuess("apple", ["yellow", "red", "red", "red", "red"]), // a=yellow
      makeGuess("avail", ["green", "red", "red", "red", "red"]),  // a=green
    ];
    expect(computeLetterStates(guesses)["a"]).toBe("green");
  });

  it("yellow beats red", () => {
    const guesses = [
      makeGuess("apple", ["red", "red", "red", "red", "red"]),  // p=red
      makeGuess("opera", ["red", "yellow", "red", "red", "red"]), // p=yellow
    ];
    expect(computeLetterStates(guesses)["p"]).toBe("yellow");
  });

  it("green is never downgraded by a subsequent yellow or red", () => {
    const guesses = [
      makeGuess("apple", ["green", "red", "red", "red", "red"]), // a=green
      makeGuess("arrow", ["yellow", "red", "red", "red", "red"]), // a=yellow
      makeGuess("axe12", ["red", "red", "red", "red", "red"]),   // a=red (fake word for test)
    ];
    expect(computeLetterStates(guesses)["a"]).toBe("green");
  });

  it("accumulates letters across multiple guesses", () => {
    const guesses = [
      makeGuess("crane", ["red", "red", "green", "yellow", "red"]),
      makeGuess("light", ["yellow", "red", "green", "red", "red"]),
    ];
    const states = computeLetterStates(guesses);
    expect(states["a"]).toBe("green");  // from 'crane' index 2
    expect(states["n"]).toBe("yellow"); // from 'crane' index 3
    expect(states["l"]).toBe("yellow"); // from 'light' index 0
    expect(states["g"]).toBe("green");  // from 'light' index 2
    expect(states["i"]).toBe("red");    // from 'light' index 1
  });

  it("handles duplicate letters — keeps highest priority across all occurrences", () => {
    // 'l' appears twice in hello: index 2 (yellow) and index 3 (red)
    const guesses = [makeGuess("hello", ["red", "red", "yellow", "red", "red"])];
    expect(computeLetterStates(guesses)["l"]).toBe("yellow");
  });

  it("handles a full game scenario — only tracks letters present in guesses", () => {
    const guesses = [
      makeGuess("crane", ["red", "red", "green", "yellow", "red"]),
    ];
    const states = computeLetterStates(guesses);
    // Letters not in any guess should not be in the map
    expect(states["b"]).toBeUndefined();
    expect(states["z"]).toBeUndefined();
  });
});

