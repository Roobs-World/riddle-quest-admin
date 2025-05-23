export interface SubmittedGuess {
  guess: string[]; // The letters of the guess
  feedback: Feedback[]; // Feedback for each letter
}

export type Feedback = "green" | "yellow" | "red";

export type GameOutcome = "win" | "loss" | null;
