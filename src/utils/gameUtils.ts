import type { SubmittedGuess, Feedback } from "../hooks/types";

export const generateFeedbackEmojiGrid = (
  submittedGuesses: SubmittedGuess[]
): string => {
  return submittedGuesses
    .map((guess) =>
      guess.feedback
        .map((fb) => {
          switch (fb) {
            case "green":
              return "🟩";
            case "yellow":
              return "🟨";
            case "red":
              return "⬜️";
            default:
              return "⬜️";
          }
        })
        .join("")
    )
    .join("\n");
};
