import { useState, useCallback } from "react";
import type { SubmittedGuess } from "./types"; // Assuming you will create a types file for this
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";

export type Feedback = "green" | "yellow" | "red";

interface UseGameLogicProps {
  riddleId: string;
  gameMode: "challenge" | "classic" | "tutorial";
}

const useGameLogic = ({ riddleId, gameMode }: UseGameLogicProps) => {
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [hasUsedContinue, setHasUsedContinue] = useState(false);

  // Constants for the new 3-attempt system
  const INITIAL_ATTEMPTS = 3;
  const CONTINUE_ATTEMPTS = 3; // Additional attempts after watching ad or spending coins

  const processGuess = async (guess: string[]) => {
    const currentGuessString = guess.join("");

    // Calculate max attempts based on whether user has used continue option
    const maxAttempts = hasUsedContinue
      ? INITIAL_ATTEMPTS + CONTINUE_ATTEMPTS
      : INITIAL_ATTEMPTS;
    const currentAttempt = attemptsUsed + 1;

    try {
      const submitGuessCallable = getFunctions(getApp()).httpsCallable(
        "submitGuess"
      );
      const result = await submitGuessCallable({
        guess: currentGuessString,
        riddleId,
        gameMode,
        attempts: guesses.length + 1, // Use actual number of guesses + 1 for current attempt
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
      setAttemptsUsed(currentAttempt);

      if (isCorrect) {
        console.log("You won!");
        setGameOver(true);
        return {
          outcome: "win",
          feedback: clientFeedback, // Use transformed feedback
          coinsEarned: coinsEarned,
          correctAnswer: correctAnswer,
        };
      } else if (currentAttempt >= maxAttempts) {
        console.log("Out of attempts!");
        setGameOver(true);

        // Check if user has already used continue option
        if (hasUsedContinue) {
          // User has already continued once, this is final loss
          return {
            outcome: "loss",
            feedback: clientFeedback,
            correctAnswer: correctAnswer,
            coinsEarned: coinsEarned,
            canOfferRewardedAd: false, // Don't offer rewarded ad, this is final
          };
        } else {
          // User can still continue by watching ad or spending coins
          return {
            outcome: "attemptLimitReached",
            feedback: clientFeedback,
            correctAnswer: correctAnswer,
            coinsEarned: coinsEarned,
            canOfferRewardedAd: true,
            canOfferCoinContinue: true,
          };
        }
      }

      console.log(
        "Submitted guess:",
        currentGuessString,
        "Feedback:",
        clientFeedback // Use transformed feedback
      );
      return {
        outcome: "continue",
        feedback: clientFeedback,
        attemptsRemaining: maxAttempts - currentAttempt,
      }; // Use transformed feedback
    } catch (error) {
      console.error("Error submitting guess:", error);
      throw error;
    }
  };

  // Function to continue game after watching ad or spending coins
  const continueGame = () => {
    setHasUsedContinue(true);
    setGameOver(false);
    // Note: attemptsUsed stays the same, but maxAttempts increases
  };

  // Function to reset the game state
  const resetGame = useCallback(() => {
    setGuesses([]);
    setCurrentGuess([]);
    setGameOver(false);
    setAttemptsUsed(0);
    setHasUsedContinue(false);
  }, []);

  // Calculate attempts remaining
  const maxAttempts = hasUsedContinue
    ? INITIAL_ATTEMPTS + CONTINUE_ATTEMPTS
    : INITIAL_ATTEMPTS;
  const attemptsRemaining = maxAttempts - attemptsUsed;

  // Expose state and functions needed by the component
  return {
    guesses,
    currentGuess,
    gameOver,
    attemptsUsed,
    attemptsRemaining,
    hasUsedContinue,
    setCurrentGuess,
    processGuess,
    continueGame,
    resetGame,
  };
};

export default useGameLogic;
