import React from "react";
import { View, Text } from "react-native";

import type { SubmittedGuess, Feedback } from "../../hooks/types"; // Import Feedback type from types.ts
import { scale } from "../../utils/responsive";
import { NUM_GUESSES } from "src/utils/constants";

/**
 * Define the structure for the entire guess grid.
 * @property {SubmittedGuess[]} guesses - An array of submitted guesses with their feedback.
 * @property {string[]} currentGuess - The current guess being typed by the user.
 * @property {number} answerLength - The length of the answer.
 * @property {number} shakeKey - Kept for backwards compatibility but not used for animation
 */
type GuessGridProps = {
  guesses: SubmittedGuess[];
  currentGuess: string[];
  answerLength: number;
};

/**
 * The component that displays the guess grid for the Wordle-style game.
 * It shows submitted guesses with feedback and the current guess being entered.
 * Optimized version without animations for better performance.
 *
 * @param {GuessGridProps} props - The props for the component.
 * @returns {React.FC<GuessGridProps>} The rendered GuessGrid component.
 */
const GuessGrid: React.FC<GuessGridProps> = ({
  guesses,
  currentGuess,
  answerLength,
}) => {
  // Responsive sizes
  const TILE_SIZE = scale(56);
  const TILE_MARGIN = scale(2);
  const ROW_HEIGHT = TILE_SIZE + TILE_MARGIN * 2 + scale(4);

  // Combine submitted guesses and the current guess for display
  const displayRows: { letters: (string | null)[]; feedback: Feedback[] }[] =
    guesses.map((sg) => ({ letters: sg.guess, feedback: sg.feedback }));

  // Add the current guess being typed to the next row if there's space and it's not empty
  if (displayRows.length < 3 && currentGuess.length > 0) {
    const currentGuessRow: (string | null)[] = [...currentGuess];
    // Fill remaining slots with null to match answerLength
    while (currentGuessRow.length < answerLength) {
      currentGuessRow.push(null);
    }
    displayRows.push({
      letters: currentGuessRow,
      feedback: Array(answerLength).fill(null),
    });
  }

  // Fill the remaining rows with empty cells up to 3 rows
  while (displayRows.length < NUM_GUESSES) {
    displayRows.push({
      letters: Array(answerLength).fill(null),
      feedback: Array(answerLength).fill(null),
    });
  }

  /**
   * Function to determine cell background color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @returns {string} The Tailwind CSS class string for the background color.
   */
  const getCellBackgroundColor = (feedback: Feedback) => {
    switch (feedback) {
      case "green":
        return "bg-green-500";
      case "yellow":
        return "bg-yellow-500";
      case "red":
        return "bg-red-500";
      default:
        return "bg-key-bg";
    }
  };

  return (
    <View
      className="w-full items-center justify-center"
      style={{
        height: "36%",
        minHeight: "36%",
        maxHeight: "36%",
        width: "100%",
      }}
    >
      {/* Container for the grid rows with proper vertical alignment */}
      <View className="w-full items-center">
        {displayRows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            className="flex-row justify-center items-center"
            style={{ height: ROW_HEIGHT }}
          >
            {row.letters.map((letter, cellIndex) => {
              const feedback = row.feedback[cellIndex];
              const backgroundColor = getCellBackgroundColor(feedback);
              return (
                <View
                  key={cellIndex}
                  className={`border-key-border border-2 items-center justify-center rounded-full ${backgroundColor}`}
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    margin: TILE_MARGIN,
                  }}
                >
                  <Text
                    className={`font-bold uppercase text-key-border`}
                    style={{
                      fontSize: scale(24),
                      lineHeight: scale(28), // Added line-height for better vertical alignment
                    }}
                  >
                    {letter}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

export default GuessGrid;
