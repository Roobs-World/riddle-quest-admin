import React, { useState } from "react";
import { View } from "react-native";
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
import { Player } from "../../types/Player";
import { SoundManager } from "../../services/SoundManager";
import useGameLogic from "../../hooks/useGameLogic";
import { checkAnyOverlayVisible } from "../../utils/overlayUtils";
import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../../types/OverlayTypes";
interface GameScreenProps {
  correctAnswer: string[];
  riddleText: string;
  userCoins: number;
  hintCost: number;
  skipCost: number;
  onGameWin: (attempts: number, coinsEarned: number) => void;
  onGameLoss: (correctAnswer: string) => void;
  onHintUsed: (cost: number) => void;
  onSkipUsed: (cost: number) => void;
  onNextLevel: () => void; // For Victory modal
  onRetry: () => void; // For Loss modal
  overlayState: GameScreenOverlayState;
  overlayActions: GameScreenOverlayActions;
}

// Accept props in the component signature, including overlay state and actions
const GameScreen = ({
  correctAnswer,
  riddleText,
  userCoins,
  hintCost,
  skipCost,
  onGameWin,
  onGameLoss,
  onHintUsed,
  onSkipUsed,
  onNextLevel,
  onRetry,
  overlayState,
  overlayActions,
}: GameScreenProps) => {
  // Remove state variables moved to the hook
  // const [guesses, setGuesses] = useState<SubmittedGuess[]>([]);
  // const [currentGuess, setCurrentGuess] = useState<string[]>([]);
  // const [gameOver, setGameOver] = useState(false);

  // State for player data (remains in component if needed for UI, otherwise move out)
  const [playerData, setPlayerData] = useState<Player | null>(null);

  // Placeholder for the correct answer (will now come from props)
  // const correctAnswer = "WINDY".split(""); // Example answer for the placeholder riddle

  // Use the new game logic hook, passing the correctAnswer from props
  const {
    guesses,
    currentGuess,
    gameOver,
    setCurrentGuess,
    processGuess,
    resetGame,
  } = useGameLogic({ correctAnswer });

  // Derived state to check if any overlay/modal is visible using the utility function and state from props
  const isAnyOverlayVisible = checkAnyOverlayVisible(
    overlayState.isVictoryModalVisible,
    overlayState.isLossModalVisible,
    overlayState.isHintOverlayVisible,
    overlayState.isSkipOverlayVisible,
    overlayState.isHomeOverlayVisible,
    overlayState.isPlayOverlayVisible,
    overlayState.isProfileOverlayVisible,
    overlayState.isSettingsOverlayVisible
  );

  // Update handleKeyPress to use the hook's functions and call callbacks
  const handleKeyPress = (key: string) => {
    // Do nothing if the game is over or a modal/overlay is visible
    if (gameOver || isAnyOverlayVisible) return;

    if (key === "DELETE") {
      // Remove the last letter from the current guess using the hook's setCurrentGuess
      setCurrentGuess((prevGuess) => prevGuess.slice(0, -1));
    } else if (key === "ENTER") {
      // Only process if the current guess is 5 letters long (hook handles guess count)
      if (currentGuess.length === 5) {
        // Use the processGuess function from the hook
        const result = processGuess(currentGuess);

        // Handle outcomes based on the result from the hook and call callbacks
        if (result.outcome === "win") {
          SoundManager.playSuccess(); // Play success sound (can also be moved to callback)
          overlayActions.setIsVictoryModalVisible(true); // Show victory modal using action from props
          onGameWin(guesses.length + 1, 0); // Call the win callback (TODO: calculate coins earned)
        } else if (result.outcome === "loss") {
          SoundManager.playNegative(); // Play negative sound (can also be moved to callback)
          overlayActions.setIsLossModalVisible(true); // Show loss modal using action from props
          onGameLoss(correctAnswer.join("")); // Call the loss callback
        }

        console.log(
          "Submitted guess:",
          currentGuess.join(""),
          "Feedback:",
          result.feedback
        );
      } else if (currentGuess.length < 5) {
        console.log("Guess must be 5 letters long.");
        // TODO: Provide visual feedback to the user that the guess is too short (e.g., shake animation)
      }
      // The hook's processGuess handles the guess count limit, so we don't need the explicit check here
    } else if (currentGuess.length < 5 && guesses.length < 6) {
      // Keep guess count check for adding letters
      // Add the letter to the current guess using the hook's setCurrentGuess
      setCurrentGuess((prevGuess) => [...prevGuess, key.toUpperCase()]); // Store letters as uppercase
    }
    console.log(`Key pressed: ${key}`);
  };

  // Placeholder functions for header button actions (remain in component, call callbacks and use overlay actions)
  const handleHintPress = () => {
    if (gameOver || isAnyOverlayVisible) return; // Do nothing if game is over or any overlay is visible
    console.log("Hint button pressed");
    overlayActions.setIsHintOverlayVisible(true); // Show hint overlay using action from props
  };

  const handleSkipPress = () => {
    if (gameOver || isAnyOverlayVisible) return; // Do nothing if game is over or any overlay is visible
    console.log("Skip button pressed");
    overlayActions.setIsSkipOverlayVisible(true); // Show skip overlay using action from props
  };

  // Update modal button actions to call callbacks and manage local modal state using overlay actions
  const handleNextLevelPress = () => {
    console.log("Next Level button pressed");
    overlayActions.setIsVictoryModalVisible(false); // Hide modal using action from props
    resetGame(); // Reset game state using the hook
    onNextLevel(); // Call the next level callback
  };

  const handleRetryPress = () => {
    console.log("Retry button pressed");
    overlayActions.setIsLossModalVisible(false); // Hide modal using action from props
    resetGame(); // Reset game state using the hook
    onRetry(); // Call the retry callback
  };

  // Handler for showing hint (remains in component, calls callback and uses overlay actions)
  const handleShowHint = () => {
    if (userCoins >= hintCost) {
      //setUserCoins((prevCoins) => prevCoins - hintCost); // Coin deduction handled by callback
      overlayActions.setIsHintOverlayVisible(false); // Hide overlay using action from props
      onHintUsed(hintCost); // Call the hint used callback

      // Find an unrevealed letter in the correct answer and display it
      const hintIndex = correctAnswer.findIndex(
        (letter, index) => currentGuess[index] !== letter // Find a position where the current guess doesn't match the answer
      );

      if (hintIndex !== -1 && currentGuess.length < 5) {
        // Add the hint letter to the current guess at the hintIndex if the spot is empty or doesn't match
        // Use the hook's setCurrentGuess
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
        // Use the hook's setCurrentGuess
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

      //console.log("Coins remaining:", userCoins - hintCost); // Coin deduction handled by callback
    } else {
      console.log("Not enough coins for a hint.");
      // The button is disabled in the overlay, so this case might not be strictly necessary,
      // but it's good for robustness.
    }
  };

  // Handler for closing hint overlay (remains in component, uses overlay actions)
  const handleCloseHintOverlay = () => {
    overlayActions.setIsHintOverlayVisible(false); // Hide overlay using action from props
  };

  // Handler for confirming skip (remains in component, calls callback and uses overlay actions)
  const handleConfirmSkip = () => {
    if (userCoins >= skipCost) {
      //setUserCoins((prevCoins) => prevCoins - skipCost); // Coin deduction handled by callback
      overlayActions.setIsSkipOverlayVisible(false); // Hide overlay using action from props
      overlayActions.setIsLossModalVisible(true); // Show loss modal (or a specific skip modal if needed later) using action from props
      onSkipUsed(skipCost); // Call the skip used callback

      // TODO: Implement logic to load the next level or move on after skipping
      //console.log("Level skipped. Coins remaining:", userCoins - skipCost); // Coin deduction handled by callback
    } else {
      console.log("Not enough coins to skip.");
      // The button is disabled in the overlay, so this case might not be strictly necessary,
      // but it's good for robustness.
    }
  };

  // Handler for closing skip overlay (remains in component, uses overlay actions)
  const handleCloseSkipOverlay = () => {
    overlayActions.setIsSkipOverlayVisible(false); // Hide overlay using action from props
  };

  // Handlers for bottom navigation overlay buttons (remain in component, uses overlay actions)
  const handlePlayPress = () => {
    console.log("Play button pressed (Bottom Nav)");
    if (gameOver || isAnyOverlayVisible) return; // Do nothing if any overlay is visible
    overlayActions.setIsPlayOverlayVisible(true); // Show Play overlay using action from props
  };

  const handleProfilePress = () => {
    console.log("Profile button pressed (Bottom Nav)");
    if (gameOver || isAnyOverlayVisible) return; // Do nothing if any overlay is visible
    overlayActions.setIsProfileOverlayVisible(true); // Show Profile overlay using action from props
  };

  const handleSettingsPress = () => {
    console.log("Settings button pressed (Bottom Nav)");
    if (gameOver || isAnyOverlayVisible) return; // Do nothing if any overlay is visible
    overlayActions.setIsSettingsOverlayVisible(true); // Show Settings overlay using action from props
  };

  // Handlers for closing bottom navigation overlays (remain in component, uses overlay actions)
  const handleCloseHomeOverlay = () => {
    overlayActions.setIsHomeOverlayVisible(false); // Hide Home overlay using action from props
  };

  const handleClosePlayOverlay = () => {
    overlayActions.setIsPlayOverlayVisible(false); // Hide Play overlay using action from props
  };

  const handleCloseProfileOverlay = () => {
    overlayActions.setIsProfileOverlayVisible(false); // Hide Profile overlay using action from props
  };

  const handleCloseSettingsOverlay = () => {
    overlayActions.setIsSettingsOverlayVisible(false); // Hide Settings overlay using action from props
  };

  // Placeholder riddle text (will come from props)
  // const currentRiddle =
  //   "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?";

  return (
    <View className="flex-1 items-center justify-between bg-cream-light">
      {/* Integrated Header Component */}
      <Header
        level={1} // TODO: Level should come from props
        score={0} // TODO: Score should come from props
        coins={userCoins} // Coins come from props
        onHintPress={handleHintPress}
        onSkipPress={handleSkipPress}
      />

      {/* Main content area */}
      <View className="flex-1 items-center justify-center w-full">
        {/* Integrated RiddleText Component */}
        <RiddleText riddle={riddleText} />
        {/* Riddle text comes from props */}

        {/* Integrated GuessGrid Component */}
        {/* Pass the submitted guesses (with feedback) and the current guess to GuessGrid */}
        <GuessGrid guesses={guesses} currentGuess={currentGuess} />
      </View>

      {/* Integrated Keyboard Component */}
      {/* Disable keyboard input if game is over or a modal/overlay is visible */}
      {!(gameOver || isAnyOverlayVisible) && (
        <Keyboard onKeyPress={handleKeyPress} />
      )}

      {/* Integrated BottomNavigationBar Component */}
      <BottomNavigationBar
        onPlayPress={handlePlayPress}
        onProfilePress={handleProfilePress}
        onSettingsPress={handleSettingsPress}
      />

      {/* Victory and Loss Modals */}
      {/* Modals remain here but trigger external callbacks and use overlay state/actions */}
      <VictoryModal
        isVisible={overlayState.isVictoryModalVisible} // Use state from props
        attempts={guesses.length} // Pass the number of attempts from hook
        coinsEarned={0} // TODO: Calculate and pass actual coins earned (via callback/props)
        onNextLevelPress={handleNextLevelPress}
      />

      <LossModal
        isVisible={overlayState.isLossModalVisible} // Use state from props
        correctAnswer={correctAnswer.join("")} // Pass the correct answer string from props
        onRetryPress={handleRetryPress}
      />

      {/* Hint Overlay */}
      {/* Overlay remains here but triggers external callback and uses overlay state/actions */}
      <HintOverlay
        isVisible={overlayState.isHintOverlayVisible} // Use state from props
        currentCoins={userCoins} // Coins come from props
        hintCost={hintCost} // Hint cost comes from props
        onShowHintPress={handleShowHint}
        onClose={handleCloseHintOverlay}
      />

      {/* Skip Overlay */}
      {/* Overlay remains here but triggers external callback and uses overlay state/actions */}
      <SkipOverlay
        isVisible={overlayState.isSkipOverlayVisible} // Use state from props
        currentCoins={userCoins} // Coins come from props
        skipCost={skipCost} // Skip cost comes from props
        onConfirmSkipPress={handleConfirmSkip}
        onClose={handleCloseSkipOverlay}
      />

      {/* Bottom Navigation Overlays */}
      {/* These overlays remain in the component for now, using overlay state/actions */}
      <PlayOverlay
        isVisible={overlayState.isPlayOverlayVisible} // Use state from props
        onClose={handleClosePlayOverlay}
      />
      <ProfileOverlay
        isVisible={overlayState.isProfileOverlayVisible} // Use state from props
        onClose={handleCloseProfileOverlay}
      />
      <SettingsOverlay
        isVisible={overlayState.isSettingsOverlayVisible} // Use state from props
        onClose={handleCloseSettingsOverlay}
      />
    </View>
  );
};

export default GameScreen;
