import React from "react";
import { View, Text } from "react-native";

// Define the feedback types for each letter
type Feedback = "green" | "yellow" | "gray" | null;

// Define the structure for a submitted guess with feedback
interface SubmittedGuess {
  guess: string[]; // The 5 letters of the guess
  feedback: Feedback[]; // Feedback for each letter
}

// Define the structure for a single guess row (5 letters or null for empty cells)
type GuessRow = (string | null)[];

// Define the structure for the entire guess grid
type GuessGridProps = {
  guesses: SubmittedGuess[]; // Now accepts SubmittedGuess[]
  currentGuess: string[];
};

const GuessGrid: React.FC<GuessGridProps> = ({ guesses, currentGuess }) => {
  // Combine submitted guesses and the current guess for display
  const displayRows: { letters: (string | null)[]; feedback: Feedback[] }[] =
    guesses.map((sg) => ({ letters: sg.guess, feedback: sg.feedback }));

  // Add the current guess to the next available row if there are less than 6 submitted guesses
  if (displayRows.length < 6) {
    const currentRowLetters: (string | null)[] = Array(5).fill(null);
    currentGuess.forEach((letter, index) => {
      currentRowLetters[index] = letter;
    });
    // For the current guess row, feedback is null for all cells initially
    const currentRowFeedback: Feedback[] = Array(5).fill(null);
    displayRows.push({
      letters: currentRowLetters,
      feedback: currentRowFeedback,
    });
  }

  // Fill the remaining rows with empty cells up to 6 rows
  while (displayRows.length < 6) {
    displayRows.push({
      letters: Array(5).fill(null),
      feedback: Array(5).fill(null),
    });
  }

  // Function to determine cell background color based on feedback
  const getCellBackgroundColor = (feedback: Feedback) => {
    switch (feedback) {
      case "green":
        return "bg-green-500"; // Green for correct letter and position
      case "yellow":
        return "bg-primary-orange"; // Primary Orange for correct letter wrong position
      case "gray":
        return "bg-gray-500"; // Gray for incorrect letter
      default:
        return "bg-transparent"; // Default background for empty or current cells
    }
  };

  // Function to determine cell border color
  const getCellBorderColor = (
    feedback: Feedback,
    letter: string | null,
    isCurrentGuessRow: boolean
  ) => {
    if (feedback) return "border-transparent"; // No border if there's feedback
    if (isCurrentGuessRow && letter !== null) return "border-gray-600"; // Darker border for cells with letters in current guess
    return "border-gray-400"; // Default border for empty cells or submitted without feedback yet
  };

  // Function to determine text color based on feedback
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
        return (
          <View key={rowIndex} className="flex-row justify-center mb-1">
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
          </View>
        );
      })}
    </View>
  );
};

export default GuessGrid;
