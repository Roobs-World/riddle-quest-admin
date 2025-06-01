import React from "react";
import { View, StyleSheet } from "react-native";
import RiddleText from "./RiddleText";
import GuessGrid from "./GuessGrid";
import { SubmittedGuess, Feedback } from "../../hooks/types";

interface GameBoardProps {
  riddleText: string;
  guesses: string[];
  currentGuess: string;
  feedback: { letter: string; status: "green" | "yellow" | "red" }[][];
  answerLength: number;
  shakeKey?: number;
}

/**
 * Game board component following Single Responsibility Principle
 * Responsible for displaying the game board (riddle and guess grid)
 */
const GameBoard: React.FC<GameBoardProps> = ({
  riddleText,
  guesses,
  currentGuess,
  feedback,
  answerLength,
  shakeKey = 0,
}) => {
  // Transform guesses and feedback into SubmittedGuess format expected by GuessGrid
  const submittedGuesses: SubmittedGuess[] = guesses.map((guess, index) => ({
    guess: guess.split(""), // Convert string to array of letters
    feedback:
      feedback[index]?.map((f) => {
        // Map our feedback format to GuessGrid's expected format
        return f.status as Feedback; // Cast to Feedback type since we know it's valid
      }) || [],
  }));

  // Convert currentGuess string to array of letters
  const currentGuessArray = currentGuess.split("");

  return (
    <View style={styles.container}>
      <View style={styles.riddleContainer}>
        <RiddleText riddleText={riddleText} />
      </View>

      <View style={styles.gridContainer}>
        <GuessGrid
          guesses={submittedGuesses}
          currentGuess={currentGuessArray}
          shakeKey={shakeKey}
          answerLength={answerLength}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gridContainer: {
    flex: 1,
    justifyContent: "center",
  },
  riddleContainer: {
    marginBottom: 20,
    minHeight: 80,
  },
});

export default GameBoard;
