import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import type { SubmittedGuess, Feedback } from "../../hooks/types"; // Import Feedback type from types.ts
import { scale } from "../../utils/responsive";
import { styles } from "../../styles";

/**
 * Define the structure for the entire guess grid.
 * @property {SubmittedGuess[]} guesses - An array of submitted guesses with their feedback.
 * @property {string[]} currentGuess - The current guess being typed by the user.
 * @property {number} answerLength - The length of the answer.
 * @property {number} shakeKey - Added shakeKey prop
 */
type GuessGridProps = {
  guesses: SubmittedGuess[]; // Now accepts SubmittedGuess[]
  currentGuess: string[]; // Add currentGuess prop
  shakeKey: number; // Added shakeKey prop
  answerLength: number; // Add answerLength prop
};

/**
 * The component that displays the guess grid for the Wordle-style game.
 * It shows submitted guesses with feedback and the current guess being entered.
 *
 * @param {GuessGridProps} props - The props for the component.
 * @returns {React.FC<GuessGridProps>} The rendered GuessGrid component.
 */
const GuessGrid: React.FC<GuessGridProps> = ({
  guesses,
  currentGuess,
  shakeKey,
  answerLength,
}) => {
  // Responsive sizes
  const TILE_SIZE = scale(56); // Base size 56px
  const TILE_MARGIN = scale(2); // Base margin 2px
  const ROW_HEIGHT = TILE_SIZE + TILE_MARGIN * 2 + scale(4); // Tile + margins + mb-1 (4px)

  // Animation shared value for shaking
  const shakeAnimation = useSharedValue(0);

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
  while (displayRows.length < 3) {
    displayRows.push({
      letters: Array(answerLength).fill(null),
      feedback: Array(answerLength).fill(null),
    });
  }

  // Effect to trigger shake animation when shakeKey changes
  useEffect(() => {
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withSpring(10, { damping: 8, stiffness: 100 }),
      withSpring(-10, { damping: 8, stiffness: 100 }),
      withSpring(0, { damping: 8, stiffness: 100 })
    );
  }, [shakeKey, shakeAnimation]);

  // Reset shattering state when guesses reset (new game)
  useEffect(() => {
    if (guesses.length === 0) {
      // Reset logic if needed
    }
  }, [guesses.length]);

  /**
   * Function to determine cell background color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @returns {string} The Tailwind CSS class string for the background color.
   */
  const getCellBackgroundColor = (feedback: Feedback) => {
    switch (feedback) {
      case "green":
        return "bg-green-500"; // Green for correct letter and position
      case "yellow":
        return "bg-yellow-500"; // Yellow for correct letter wrong position
      case "red":
        return "bg-red-500"; // Red for incorrect letter
      default:
        return "bg-transparent"; // Default background for empty or current cells
    }
  };

  /**
   * Function to determine cell border color.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @returns {string} The Tailwind CSS class string for the border color.
   */
  const getCellBorderColor = (feedback: Feedback) => {
    if (feedback) return "border-transparent"; // No border if there's feedback
    return "border-gray-400"; // Default border for empty cells
  };

  /**
   * Function to determine text color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @param {string | null} letter - The letter in the cell.
   * @returns {string} The Tailwind CSS class string for the text color.
   */
  const getCellTextColor = (feedback: Feedback, letter: string | null) => {
    if (feedback) return "text-white"; // White text for colored feedback cells (submitted)
    if (letter !== null) return "text-white"; // White text for letters being typed
    return "text-transparent"; // Transparent for empty cells (no letters shown)
  };

  return (
    <View className="w-full items-center py-4 mb-4 flex-grow">
      {/* Masking container that clips content sliding upward */}
      <View className="w-full relative" style={styles.maskingContainer}>
        {displayRows.map((row, rowIndex) => {
          // Apply shake animation to the most recent submitted guess
          const isLastSubmittedRow =
            rowIndex === guesses.length - 1 && guesses.length > 0;

          // Apply shake animation only to last submitted row
          const animatedStyle = isLastSubmittedRow
            ? { transform: [{ translateX: shakeAnimation }] }
            : {};

          return (
            <Animated.View
              key={rowIndex}
              className="flex-row justify-center mb-1"
              style={[
                animatedStyle,
                { height: ROW_HEIGHT }, // Fixed height for consistent spacing
              ]}
            >
              {row.letters.map((letter, cellIndex) => {
                const feedback = row.feedback[cellIndex];
                const backgroundColor = getCellBackgroundColor(feedback);
                const borderColor = getCellBorderColor(feedback);
                const textColor = getCellTextColor(feedback, letter);
                return (
                  <View
                    key={cellIndex}
                    className={`border ${borderColor} items-center justify-center rounded ${backgroundColor}`}
                    style={{
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                      margin: TILE_MARGIN,
                    }}
                  >
                    <Text
                      className={`font-bold uppercase ${textColor}`}
                      style={{
                        fontSize: scale(24), // Responsive font size
                      }}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

export default GuessGrid;
