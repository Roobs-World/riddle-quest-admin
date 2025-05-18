import { useState } from "react";

// Define the feedback types for each letter
type Feedback = "green" | "yellow" | "gray" | null;

// Define the structure for a submitted guess with feedback
interface SubmittedGuess {
  guess: string[]; // The 5 letters of the guess
  feedback: Feedback[]; // Feedback for each letter
}

interface UseGameLogicProps {
  correctAnswer: string[];
}

const useGameLogic = ({ correctAnswer }: UseGameLogicProps) => {
  // State for the list of submitted guesses (now includes feedback)
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  // State for the current guess being typed
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  // State to track game over status
  const [gameOver, setGameOver] = useState(false);

  // Function to generate feedback for a submitted guess
  const generateFeedback = (guess: string[], answer: string[]): Feedback[] => {
    const feedback: Feedback[] = Array(5).fill(null);
    const answerLetterCounts: { [key: string]: number } = {};
    answer.forEach((letter) => {
      answerLetterCounts[letter] = (answerLetterCounts[letter] || 0) + 1;
    });

    // First pass: Check for green (correct letter and position)
    const usedIndices: boolean[] = Array(5).fill(false);
    guess.forEach((letter, index) => {
      if (letter === answer[index]) {
        feedback[index] = "green";
        answerLetterCounts[letter] = --answerLetterCounts[letter];
        usedIndices[index] = true;
      }
    });

    // Second pass: Check for yellow (correct letter wrong position) and gray (not in word)
    guess.forEach((letter, index) => {
      if (!usedIndices[index]) {
        if (answerLetterCounts[letter] && answerLetterCounts[letter] > 0) {
          feedback[index] = "yellow";
          answerLetterCounts[letter] = --answerLetterCounts[letter];
        } else {
          feedback[index] = "gray";
        }
      }
    });

    return feedback;
  };

  // Logic to handle processing a submitted guess (extracted from handleKeyPress)
  const processGuess = (guess: string[]) => {
    const currentGuessString = guess.join("");
    const correctAnswerString = correctAnswer.join("");

    // Generate feedback using the new function
    const feedback = generateFeedback(guess, correctAnswer);

    // Create a new submitted guess object
    const newSubmittedGuess: SubmittedGuess = {
      guess: guess,
      feedback: feedback,
    };

    // Add the new submitted guess to the list of guesses
    setGuesses((prevGuesses) => [...prevGuesses, newSubmittedGuess]);
    // Clear the current guess
    setCurrentGuess([]);

    // Check for win/loss conditions
    if (currentGuessString === correctAnswerString) {
      console.log("You won!");
      setGameOver(true); // Set game over on win
      return { outcome: "win", feedback: feedback };
    } else if (guesses.length + 1 === 6) {
      console.log("You lost! The answer was:", correctAnswerString);
      setGameOver(true); // Set game over on loss
      return { outcome: "loss", feedback: feedback };
    }

    console.log("Submitted guess:", currentGuessString, "Feedback:", feedback);
    return { outcome: "continue", feedback: feedback };
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
    generateFeedback, // Keeping this for now, might remove later if not needed directly by UI
    resetGame, // Expose the reset function
  };
};

export default useGameLogic;
