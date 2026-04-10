/**
 * @fileoverview Hard Mode validation utilities.
 *
 * In Hard Mode any hint revealed by a previous guess must be used in
 * subsequent guesses:
 *  - Green letters must appear in the **same position**.
 *  - Yellow letters must appear **somewhere** in the guess.
 */

import type { SubmittedGuess } from "../hooks/types";

export interface HardModeConstraint {
  letter: string;
  /** Position index (0-based) for green constraints; undefined for yellow. */
  position?: number;
  type: "green" | "yellow";
}

export interface HardModeViolation {
  message: string;
}

/**
 * Derives the set of constraints that the next guess must satisfy.
 *
 * Processes every submitted guess so that the returned list reflects all
 * hints revealed so far.  Duplicate constraints are de-duplicated.
 */
export function getHardModeConstraints(
  guesses: SubmittedGuess[]
): HardModeConstraint[] {
  const constraints: HardModeConstraint[] = [];

  for (const { guess, feedback } of guesses) {
    for (let i = 0; i < feedback.length; i++) {
      const letter = guess[i].toUpperCase();
      const status = feedback[i];

      if (status === "green") {
        // Add only if this exact (letter, position) pair isn't already present
        const already = constraints.some(
          (c) => c.type === "green" && c.position === i && c.letter === letter
        );
        if (!already) {
          constraints.push({ letter, position: i, type: "green" });
        }
      } else if (status === "yellow") {
        // Add only if this letter isn't already constrained as yellow or green
        const already = constraints.some(
          (c) => c.letter === letter && (c.type === "yellow" || c.type === "green")
        );
        if (!already) {
          constraints.push({ letter, type: "yellow" });
        }
      }
    }
  }

  return constraints;
}

/**
 * Validates a guess against the hard-mode constraints derived from previous
 * guesses.  Returns the first violation found, or `null` if the guess is valid.
 *
 * @param guess  The proposed guess as an array of uppercase letters.
 * @param constraints  Constraints returned by `getHardModeConstraints`.
 */
export function validateHardModeGuess(
  guess: string[],
  constraints: HardModeConstraint[]
): HardModeViolation | null {
  const upper = guess.map((l) => l.toUpperCase());

  for (const constraint of constraints) {
    if (constraint.type === "green" && constraint.position !== undefined) {
      if (upper[constraint.position] !== constraint.letter) {
        const ordinal = ordinalPosition(constraint.position);
        return {
          message: `${ordinal} letter must be ${constraint.letter}`,
        };
      }
    } else if (constraint.type === "yellow") {
      if (!upper.includes(constraint.letter)) {
        return {
          message: `Guess must contain ${constraint.letter}`,
        };
      }
    }
  }

  return null;
}

function ordinalPosition(index: number): string {
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  return ordinals[index] ?? `${index + 1}th`;
}

