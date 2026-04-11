// firebase-functions/src/validation/requestSchemas.ts

// Based on usage in submitGuessLogic.ts
export type FeedbackColorValue = "green" | "yellow" | "red";

export interface FeedbackItem {
  letter: string;
  status: FeedbackColorValue;
}

export interface SubmitGuessRequestData {
  guess: string;
  riddleId: string;
  gameMode: "challenge" | "classic";
  attempts: number;
}

export interface SubmitGuessAuthContext {
  uid: string;
  isAnonymous?: boolean;
}

export interface SubmitGuessResponseData {
  feedback: FeedbackItem[];
  isCorrect: boolean;
  correctAnswer?: string; // Optional, as it's only sent on game over
  coinsEarned?: number; // Optional, as it's only sent if coins are earned
}

// You might have other request/response types for other functions.
// Add them here as needed.
