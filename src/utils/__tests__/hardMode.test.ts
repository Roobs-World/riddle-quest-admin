import {
  getHardModeConstraints,
  validateHardModeGuess,
} from "../hardMode";
import type { SubmittedGuess } from "../../hooks/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeGuess(word: string, feedbacks: ("green" | "yellow" | "red")[]): SubmittedGuess {
  return { guess: word.split(""), feedback: feedbacks };
}

// ─────────────────────────────────────────────────────────────────────────────
// getHardModeConstraints
// ─────────────────────────────────────────────────────────────────────────────

describe("getHardModeConstraints", () => {
  it("returns empty array when no guesses have been made", () => {
    expect(getHardModeConstraints([])).toEqual([]);
  });

  it("extracts green constraints with position", () => {
    const guesses = [makeGuess("APPLE", ["green", "red", "red", "red", "red"])];
    const constraints = getHardModeConstraints(guesses);
    expect(constraints).toEqual([{ letter: "A", position: 0, type: "green" }]);
  });

  it("extracts yellow constraints without position", () => {
    const guesses = [makeGuess("APPLE", ["red", "yellow", "red", "red", "red"])];
    const constraints = getHardModeConstraints(guesses);
    expect(constraints).toEqual([{ letter: "P", type: "yellow" }]);
  });

  it("ignores red letters", () => {
    const guesses = [makeGuess("APPLE", ["red", "red", "red", "red", "red"])];
    expect(getHardModeConstraints(guesses)).toEqual([]);
  });

  it("accumulates constraints across multiple guesses", () => {
    const guesses = [
      makeGuess("APPLE", ["green", "red", "red", "red", "red"]),
      makeGuess("ALONE", ["red", "red", "red", "yellow", "red"]),
    ];
    const constraints = getHardModeConstraints(guesses);
    expect(constraints).toHaveLength(2);
    expect(constraints).toContainEqual({ letter: "A", position: 0, type: "green" });
    expect(constraints).toContainEqual({ letter: "N", type: "yellow" });
  });

  it("de-duplicates identical green constraints", () => {
    const guesses = [
      makeGuess("APPLE", ["green", "red", "red", "red", "red"]),
      makeGuess("ABOVE", ["green", "red", "red", "red", "red"]),
    ];
    const constraints = getHardModeConstraints(guesses);
    const greenAs = constraints.filter((c) => c.type === "green" && c.letter === "A");
    expect(greenAs).toHaveLength(1);
  });

  it("de-duplicates identical yellow constraints", () => {
    const guesses = [
      makeGuess("APPLE", ["red", "yellow", "red", "red", "red"]),
      makeGuess("OPERA", ["red", "yellow", "red", "red", "red"]),
    ];
    const constraints = getHardModeConstraints(guesses);
    const yellowPs = constraints.filter((c) => c.type === "yellow" && c.letter === "P");
    expect(yellowPs).toHaveLength(1);
  });

  it("does not add a yellow constraint when the letter is already green", () => {
    const guesses = [
      makeGuess("APPLE", ["green", "red", "red", "red", "red"]),
      makeGuess("ABOVE", ["yellow", "red", "red", "red", "red"]),
    ];
    const constraints = getHardModeConstraints(guesses);
    // Only the green constraint for A should exist, no yellow A
    const aConstraints = constraints.filter((c) => c.letter === "A");
    expect(aConstraints).toHaveLength(1);
    expect(aConstraints[0].type).toBe("green");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateHardModeGuess
// ─────────────────────────────────────────────────────────────────────────────

describe("validateHardModeGuess", () => {
  it("returns null when there are no constraints", () => {
    expect(validateHardModeGuess(["H", "E", "L", "L", "O"], [])).toBeNull();
  });

  it("returns null when all constraints are satisfied", () => {
    const constraints = [
      { letter: "A", position: 0, type: "green" as const },
      { letter: "P", type: "yellow" as const },
    ];
    expect(validateHardModeGuess(["A", "P", "R", "I", "L"], constraints)).toBeNull();
  });

  it("returns a violation when a green letter is in the wrong position", () => {
    const constraints = [{ letter: "A", position: 0, type: "green" as const }];
    const violation = validateHardModeGuess(["B", "A", "K", "E", "D"], constraints);
    expect(violation).not.toBeNull();
    expect(violation?.message).toMatch(/1st letter must be A/i);
  });

  it("returns a violation when a yellow letter is missing entirely", () => {
    const constraints = [{ letter: "P", type: "yellow" as const }];
    const violation = validateHardModeGuess(["H", "E", "L", "L", "O"], constraints);
    expect(violation).not.toBeNull();
    expect(violation?.message).toMatch(/must contain P/i);
  });

  it("is case-insensitive for guess input", () => {
    const constraints = [{ letter: "A", position: 0, type: "green" as const }];
    expect(validateHardModeGuess(["a", "p", "p", "l", "e"], constraints)).toBeNull();
  });

  it("uses ordinal labels for positions 1-5", () => {
    const positions = [
      { pos: 0, label: "1st" },
      { pos: 1, label: "2nd" },
      { pos: 2, label: "3rd" },
      { pos: 3, label: "4th" },
      { pos: 4, label: "5th" },
    ];
    for (const { pos, label } of positions) {
      const constraints = [{ letter: "A", position: pos, type: "green" as const }];
      const guess = ["B", "B", "B", "B", "B"];
      const violation = validateHardModeGuess(guess, constraints);
      expect(violation?.message).toContain(label);
    }
  });

  it("returns the first violation when multiple constraints are broken", () => {
    const constraints = [
      { letter: "A", position: 0, type: "green" as const },
      { letter: "P", type: "yellow" as const },
    ];
    // Neither A at 0 nor P anywhere
    const violation = validateHardModeGuess(["B", "B", "B", "B", "B"], constraints);
    expect(violation).not.toBeNull();
    // Should report the first constraint (green A)
    expect(violation?.message).toMatch(/1st letter must be A/i);
  });
});
