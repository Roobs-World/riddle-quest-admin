import type {SubmittedGuess} from "../hooks/types";

/**
 * Converts submitted guess feedback into a shareable emoji grid.
 *
 * @param submittedGuesses Submitted guesses with per-letter feedback states.
 * @returns Multiline emoji string representing each guess row.
 */
export const generateFeedbackEmojiGrid = (submittedGuesses: SubmittedGuess[]): string => {
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
        .join(""),
    )
    .join("\n");
};
