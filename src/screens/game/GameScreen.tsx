import React, { useState } from "react";
import { View, Text } from "react-native";
import Keyboard from "../../components/game/Keyboard";
import Header from "../../components/game/Header";
import RiddleText from "../../components/game/RiddleText";
import GuessGrid from "../../components/game/GuessGrid";
import BottomNavigationBar from "../../components/game/BottomNavigationBar";
import VictoryModal from "../../components/game/VictoryModal";
import LossModal from "../../components/game/LossModal";
import HintOverlay from "../../components/game/HintOverlay";
import SkipOverlay from "../../components/game/SkipOverlay";
import PlayOverlay from "../../components/game/PlayOverlay";
import ProfileOverlay from "../../components/game/ProfileOverlay";
import SettingsOverlay from "../../components/game/SettingsOverlay";

// Define the structure for a single guess row (5 letters)
// type GuessRow = (string | null)[]; // Old type

// Define the feedback types for each letter
type Feedback = "green" | "yellow" | "gray" | null;

// Define the structure for a submitted guess with feedback
interface SubmittedGuess {
  guess: string[]; // The 5 letters of the guess
  feedback: Feedback[]; // Feedback for each letter
}

const GameScreen = () => {
  // State for the list of submitted guesses (now includes feedback)
  const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  // State for the current guess being typed
  const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  // Placeholder for the correct answer
  const correctAnswer = "WINDY".split(""); // Example answer for the placeholder riddle
  // State to track game over status
  const [gameOver, setGameOver] = useState(false);
  // State to control modal visibility
  const [isVictoryModalVisible, setIsVictoryModalVisible] = useState(false);
  const [isLossModalVisible, setIsLossModalVisible] = useState(false);
  // State to control hint/skip overlay visibility
  const [isHintOverlayVisible, setIsHintOverlayVisible] = useState(false);
  const [isSkipOverlayVisible, setIsSkipOverlayVisible] = useState(false);
  const [isHomeOverlayVisible, setIsHomeOverlayVisible] = useState(false);
  const [isPlayOverlayVisible, setIsPlayOverlayVisible] = useState(false);
  const [isProfileOverlayVisible, setIsProfileOverlayVisible] = useState(false);
  const [isSettingsOverlayVisible, setIsSettingsOverlayVisible] =
    useState(false);
  // Placeholder state for user's coins
  const [userCoins, setUserCoins] = useState(100);
  const hintCost = 50; // Define hint cost
  const skipCost = 50; // Define skip cost

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

  // Basic function to handle key presses from the keyboard
  const handleKeyPress = (key: string) => {
    // Do nothing if the game is over or a modal/overlay is visible
    if (
      gameOver ||
      isVictoryModalVisible ||
      isLossModalVisible ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return;

    if (key === "DELETE") {
      // Remove the last letter from the current guess
      setCurrentGuess((prevGuess) => prevGuess.slice(0, -1));
    } else if (key === "ENTER") {
      // Only process if the current guess is 5 letters long and we have less than 6 guesses
      if (currentGuess.length === 5 && guesses.length < 6) {
        const currentGuessString = currentGuess.join("");
        const correctAnswerString = correctAnswer.join("");

        // Generate feedback using the new function
        const feedback = generateFeedback(currentGuess, correctAnswer);

        // Create a new submitted guess object
        const newSubmittedGuess: SubmittedGuess = {
          guess: currentGuess,
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
          setIsVictoryModalVisible(true); // Show victory modal
          // TODO: Implement win logic (e.g., update stats, award coins)
        } else if (guesses.length + 1 === 6) {
          console.log("You lost! The answer was:", correctAnswerString);
          setGameOver(true); // Set game over on loss
          setIsLossModalVisible(true); // Show loss modal
          // TODO: Implement loss logic (e.g., show loss modal, reveal answer)
        }

        console.log(
          "Submitted guess:",
          currentGuessString,
          "Feedback:",
          feedback
        );
      } else if (currentGuess.length < 5) {
        console.log("Guess must be 5 letters long.");
        // TODO: Provide visual feedback to the user that the guess is too short (e.g., shake animation)
      }
      // If guesses.length is 6 or more, do nothing on ENTER
    } else if (currentGuess.length < 5 && guesses.length < 6) {
      // Add the letter to the current guess if it's less than 5 letters long
      // and we haven't exceeded the maximum number of guesses
      setCurrentGuess((prevGuess) => [...prevGuess, key.toUpperCase()]); // Store letters as uppercase
    }
    console.log(`Key pressed: ${key}`);
  };

  // Placeholder functions for header button actions
  const handleHintPress = () => {
    if (
      gameOver ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return; // Do nothing if game is over or any overlay is visible
    console.log("Hint button pressed");
    setIsHintOverlayVisible(true); // Show hint overlay
  };

  const handleSkipPress = () => {
    if (
      gameOver ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return; // Do nothing if game is over or any overlay is visible
    console.log("Skip button pressed");
    setIsSkipOverlayVisible(true); // Show skip overlay
  };

  // Placeholder functions for modal button actions
  const handleNextLevelPress = () => {
    console.log("Next Level button pressed");
    // Reset game state for the next level
    setGuesses([]);
    setCurrentGuess([]);
    setGameOver(false);
    setIsVictoryModalVisible(false); // Hide modal
    // TODO: Implement logic to load the next level riddle and update level in Header
  };

  const handleRetryPress = () => {
    console.log("Retry button pressed");
    // Reset game state to start over
    setGuesses([]);
    setCurrentGuess([]);
    setGameOver(false);
    setIsLossModalVisible(false); // Hide modal
    // TODO: Potentially reload the same riddle or fetch a new one if game mode requires
  };

  // Handler for showing hint
  const handleShowHint = () => {
    if (userCoins >= hintCost) {
      setUserCoins((prevCoins) => prevCoins - hintCost); // Deduct coins
      setIsHintOverlayVisible(false); // Hide overlay

      // Find an unrevealed letter in the correct answer and display it
      const hintIndex = correctAnswer.findIndex(
        (letter, index) => currentGuess[index] !== letter // Find a position where the current guess doesn't match the answer
      );

      if (hintIndex !== -1 && currentGuess.length < 5) {
        // Add the hint letter to the current guess at the hintIndex if the spot is empty or doesn't match
        setCurrentGuess((prevGuess) => {
          const newGuess = [...prevGuess];
          // If the current guess is shorter, fill with nulls to the hint index
          while (newGuess.length < hintIndex) {
            newGuess.push(null as any); // Use null as any to match string | null type if needed
          }
          newGuess[hintIndex] = correctAnswer[hintIndex];
          // Ensure the guess length doesn't exceed 5 after adding the hint
          return newGuess.slice(0, 5);
        });
        console.log("Hint used: Revealed letter at position", hintIndex + 1);
      } else if (currentGuess.length === 5 && hintIndex !== -1) {
        // If the current guess is already 5 letters, replace the letter at the hint index
        setCurrentGuess((prevGuess) => {
          const newGuess = [...prevGuess];
          newGuess[hintIndex] = correctAnswer[hintIndex];
          return newGuess;
        });
        console.log("Hint used: Replaced letter at position", hintIndex + 1);
      } else {
        console.log("Hint not needed or not possible.");
        // This might happen if the guess is already correct or full with correct letters
        // TODO: Provide feedback to the user if a hint cannot be provided
      }

      console.log("Coins remaining:", userCoins - hintCost);
    } else {
      console.log("Not enough coins for a hint.");
      // The button is disabled in the overlay, so this case might not be strictly necessary,
      // but it's good for robustness.
    }
  };

  // Handler for closing hint overlay
  const handleCloseHintOverlay = () => {
    setIsHintOverlayVisible(false); // Hide overlay
  };

  // Handler for confirming skip
  const handleConfirmSkip = () => {
    if (userCoins >= skipCost) {
      setUserCoins((prevCoins) => prevCoins - skipCost); // Deduct coins
      setIsSkipOverlayVisible(false); // Hide overlay
      setGameOver(true); // End the game (as skipping means not solving)
      setIsLossModalVisible(true); // Show loss modal (or a specific skip modal if needed later)

      // TODO: Implement logic to load the next level or move on after skipping
      console.log("Level skipped. Coins remaining:", userCoins - skipCost);
    } else {
      console.log("Not enough coins to skip.");
      // The button is disabled in the overlay, so this case might not be strictly necessary,
      // but it's good for robustness.
    }
  };

  // Handler for closing skip overlay
  const handleCloseSkipOverlay = () => {
    setIsSkipOverlayVisible(false); // Hide overlay
  };

  // Handlers for bottom navigation overlay buttons
  const handlePlayPress = () => {
    console.log("Play button pressed (Bottom Nav)");
    if (
      gameOver ||
      isVictoryModalVisible ||
      isLossModalVisible ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return; // Do nothing if any overlay is visible
    setIsPlayOverlayVisible(true); // Show Play overlay
  };

  const handleProfilePress = () => {
    console.log("Profile button pressed (Bottom Nav)");
    if (
      gameOver ||
      isVictoryModalVisible ||
      isLossModalVisible ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return; // Do nothing if any overlay is visible
    setIsProfileOverlayVisible(true); // Show Profile overlay
  };

  const handleSettingsPress = () => {
    console.log("Settings button pressed (Bottom Nav)");
    if (
      gameOver ||
      isVictoryModalVisible ||
      isLossModalVisible ||
      isHintOverlayVisible ||
      isSkipOverlayVisible ||
      isHomeOverlayVisible ||
      isPlayOverlayVisible ||
      isProfileOverlayVisible ||
      isSettingsOverlayVisible
    )
      return; // Do nothing if any overlay is visible
    setIsSettingsOverlayVisible(true); // Show Settings overlay
  };

  // Handlers for closing bottom navigation overlays
  const handleCloseHomeOverlay = () => {
    setIsHomeOverlayVisible(false); // Hide Home overlay
  };

  const handleClosePlayOverlay = () => {
    setIsPlayOverlayVisible(false); // Hide Play overlay
  };

  const handleCloseProfileOverlay = () => {
    setIsProfileOverlayVisible(false); // Hide Profile overlay
  };

  const handleCloseSettingsOverlay = () => {
    setIsSettingsOverlayVisible(false); // Hide Settings overlay
  };

  // Placeholder riddle text
  const currentRiddle =
    "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?";

  return (
    <View className="flex-1 items-center justify-between bg-cream-light">
      {/* Integrated Header Component */}
      <Header
        level={1}
        score={0}
        coins={userCoins}
        onHintPress={handleHintPress}
        onSkipPress={handleSkipPress}
      />

      {/* Main content area */}
      <View className="flex-1 items-center justify-center w-full">
        {/* Integrated RiddleText Component */}
        <RiddleText riddle={currentRiddle} />

        {/* Integrated GuessGrid Component */}
        {/* Pass the submitted guesses (with feedback) and the current guess to GuessGrid */}
        <GuessGrid guesses={guesses} currentGuess={currentGuess} />
      </View>

      {/* Integrated Keyboard Component */}
      {/* Disable keyboard input if game is over or a modal/overlay is visible */}
      {!(
        gameOver ||
        isVictoryModalVisible ||
        isLossModalVisible ||
        isHintOverlayVisible ||
        isSkipOverlayVisible ||
        isHomeOverlayVisible ||
        isPlayOverlayVisible ||
        isProfileOverlayVisible ||
        isSettingsOverlayVisible
      ) && <Keyboard onKeyPress={handleKeyPress} />}

      {/* Integrated BottomNavigationBar Component */}
      <BottomNavigationBar
        onPlayPress={handlePlayPress}
        onProfilePress={handleProfilePress}
        onSettingsPress={handleSettingsPress}
      />

      {/* Victory and Loss Modals */}
      <VictoryModal
        isVisible={isVictoryModalVisible}
        attempts={guesses.length} // Pass the number of attempts
        coinsEarned={0} // TODO: Calculate and pass actual coins earned
        onNextLevelPress={handleNextLevelPress}
      />

      <LossModal
        isVisible={isLossModalVisible}
        correctAnswer={correctAnswer.join("")} // Pass the correct answer string
        onRetryPress={handleRetryPress}
      />

      {/* Hint Overlay */}
      <HintOverlay
        isVisible={isHintOverlayVisible}
        currentCoins={userCoins}
        hintCost={hintCost}
        onShowHintPress={handleShowHint}
        onClose={handleCloseHintOverlay}
      />

      {/* Skip Overlay */}
      <SkipOverlay
        isVisible={isSkipOverlayVisible}
        currentCoins={userCoins}
        skipCost={skipCost}
        onConfirmSkipPress={handleConfirmSkip}
        onClose={handleCloseSkipOverlay}
      />

      {/* Bottom Navigation Overlays */}
      <PlayOverlay
        isVisible={isPlayOverlayVisible}
        onClose={handleClosePlayOverlay}
      />
      <ProfileOverlay
        isVisible={isProfileOverlayVisible}
        onClose={handleCloseProfileOverlay}
      />
      <SettingsOverlay
        isVisible={isSettingsOverlayVisible}
        onClose={handleCloseSettingsOverlay}
      />
    </View>
  );
};

export default GameScreen;
