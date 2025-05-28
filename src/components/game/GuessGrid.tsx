import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import type { SubmittedGuess, Feedback } from "../../hooks/types"; // Import Feedback type from types.ts

/**
 * Define the structure for the entire guess grid.
 * @property {SubmittedGuess[]} guesses - An array of submitted guesses with their feedback.
 * @property {string[]} currentGuess - The letters of the current guess being entered by the user.
 * @property {number} answerLength - The length of the answer.
 */
type GuessGridProps = {
  guesses: SubmittedGuess[]; // Now accepts SubmittedGuess[]
  currentGuess: string[];
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
  // Combine submitted guesses and the current guess for display
  const displayRows: { letters: (string | null)[]; feedback: Feedback[] }[] =
    guesses.map((sg) => ({ letters: sg.guess, feedback: sg.feedback }));

  // Add the current guess to the next available row if there are less than 6 submitted guesses
  if (displayRows.length < 6) {
    const currentRowLetters: (string | null)[] = Array(answerLength).fill(null);
    currentGuess.forEach((letter, index) => {
      currentRowLetters[index] = letter;
    });
    // For the current guess row, feedback is null for all cells initially
    const currentRowFeedback: Feedback[] = Array(answerLength).fill(null);
    displayRows.push({
      letters: currentRowLetters,
      feedback: currentRowFeedback,
    });
  }

  // Fill the remaining rows with empty cells up to 6 rows
  while (displayRows.length < 6) {
    displayRows.push({
      letters: Array(answerLength).fill(null),
      feedback: Array(answerLength).fill(null),
    });
  }

  // Animation shared value for shaking
  const shakeAnimation = useSharedValue(0);

  // Effect to trigger shake animation when shakeKey changes
  useEffect(() => {
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withSpring(10, { damping: 8, stiffness: 100 }),
      withSpring(-10, { damping: 8, stiffness: 100 }),
      withSpring(0, { damping: 8, stiffness: 100 })
    );
  }, [shakeKey, shakeAnimation]); // Depend on shakeKey and shakeAnimation

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
        return "bg-primary-orange"; // Primary Orange for correct letter wrong position
      case "red":
        return "bg-red-500"; // Red for incorrect letter
      default:
        return "bg-transparent"; // Default background for empty or current cells
    }
  };

  /**
   * Function to determine cell border color.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @param {string | null} letter - The letter in the cell.
   * @param {boolean} isCurrentGuessRow - Indicates if the cell is in the current guess row.
   * @returns {string} The Tailwind CSS class string for the border color.
   */
  const getCellBorderColor = (
    feedback: Feedback,
    letter: string | null,
    isCurrentGuessRow: boolean
  ) => {
    if (feedback) return "border-transparent"; // No border if there's feedback
    if (isCurrentGuessRow && letter !== null) return "border-gray-600"; // Darker border for cells with letters in current guess
    return "border-gray-400"; // Default border for empty cells or submitted without feedback yet
  };

  /**
   * Function to determine text color based on feedback.
   * @param {Feedback} feedback - The feedback for a specific letter cell.
   * @param {string | null} letter - The letter in the cell.
   * @returns {string} The Tailwind CSS class string for the text color.
   */
  const getCellTextColor = (feedback: Feedback, letter: string | null) => {
    if (feedback) return "text-white"; // White text for colored feedback cells
    if (letter !== null) return "text-gray-800"; // Dark text for letters in current guess
    return "text-gray-800"; // Default text color for empty cells (shouldn't be visible)
  };

  return (
    <View className="w-full items-center py-4 flex-grow">
      {displayRows.map((row, rowIndex) => {
        const isCurrentGuessRow =
          rowIndex === guesses.length && guesses.length < 6;

        // Apply animation style only to the current guess row
        const animatedStyle = isCurrentGuessRow
          ? { transform: [{ translateX: shakeAnimation }] }
          : {};

        return (
          <Animated.View
            key={rowIndex}
            className="flex-row justify-center mb-1"
            style={animatedStyle}
          >
            {row.letters.map((letter, cellIndex) => {
              const feedback = row.feedback[cellIndex];
              const backgroundColor = getCellBackgroundColor(feedback);
              const borderColor = getCellBorderColor(
                feedback,
                letter,
                isCurrentGuessRow
              );
              const textColor = getCellTextColor(feedback, letter);
              return (
                <View
                  key={cellIndex}
                  className={`w-14 h-14 m-[2px] border ${borderColor} items-center justify-center rounded ${backgroundColor}`}
                >
                  <Text className={`text-2xl font-bold uppercase ${textColor}`}>
                    {letter}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        );
      })}
    </View>
  );
};

export default GuessGrid;
