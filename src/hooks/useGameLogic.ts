import { useState } from "react";
import type { SubmittedGuess } from "./types"; // Assuming you will create a types file for this
import functions from "@react-native-firebase/functions";

export type Feedback = "green" | "yellow" | "red";

interface UseGameLogicProps {
  riddleId: string;
  gameMode: "challenge" | "classic";
}

const useGameLogic = ({ riddleId, gameMode }: UseGameLogicProps) => {
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);

  const processGuess = async (guess: string[]) => {
    const currentGuessString = guess.join("");

    const maxGuesses = gameMode === "challenge" ? 6 : 5;

    try {
      const submitGuessCallable = functions().httpsCallable("submitGuess");
      const result = await submitGuessCallable({
        guess: currentGuessString,
        riddleId,
        gameMode,
        attempts: guesses.length + 1,
      });
      const {
        feedback: serverFeedback,
        isCorrect,
        correctAnswer,
        coinsEarned,
      } = result.data as {
        feedback: { letter: string; status: Feedback }[]; // Corrected server feedback type
        isCorrect: boolean;
        correctAnswer?: string;
        coinsEarned?: number;
      };

      // Transform serverFeedback to the client-side Feedback[] type
      const clientFeedback: Feedback[] = serverFeedback.map(
        (item) => item.status
      );

      const newSubmittedGuess: SubmittedGuess = {
        guess: guess,
        feedback: clientFeedback, // Use transformed feedback
      };

      setGuesses((prevGuesses) => [...prevGuesses, newSubmittedGuess]);
      setCurrentGuess([]);

      if (isCorrect) {
        console.log("You won!");
        setGameOver(true);
        return {
          outcome: "win",
          feedback: clientFeedback, // Use transformed feedback
          coinsEarned: coinsEarned,
          correctAnswer: correctAnswer,
        };
      } else if (guesses.length + 1 >= maxGuesses) {
        console.log("You lost!");
        setGameOver(true);
        return {
          outcome: "loss",
          feedback: clientFeedback, // Use transformed feedback
          correctAnswer: correctAnswer,
          coinsEarned: coinsEarned, // Typically 0 on loss, but pass if backend sends it
          canOfferRewardedAd: true, // Added flag
        };
      }

      console.log(
        "Submitted guess:",
        currentGuessString,
        "Feedback:",
        clientFeedback // Use transformed feedback
      );
      return { outcome: "continue", feedback: clientFeedback }; // Use transformed feedback
    } catch (error) {
      console.error("Error submitting guess:", error);
      throw error;
    }
  };

  // Function to reset the game state
  const resetGame = () => {
    setGuesses([]);
    setCurrentGuess([]);
    setGameOver(false);
  };

  // Expose state and functions needed by the component
  return {
    guesses,
    currentGuess,
    gameOver,
    setCurrentGuess,
    processGuess,
    resetGame,
    // removed isWin, // Assuming isWin is returned by useGameLogic now
  };
};

export default useGameLogic;
