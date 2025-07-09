/**
 * @fileoverview VictoryModal component - Celebration modal for successful riddle solving.
 *
 * This modal is displayed when a player successfully solves a riddle, providing
 * a celebratory experience with game statistics, coin rewards, and sharing options.
 * It includes an emoji grid representation of the player's guesses for social
 * sharing and provides navigation options to continue playing or return home.
 *
 * @author Qwordly Development Team
 * @version 1.0.0
 * @since 2024
 */

import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import type { SubmittedGuess } from "../../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../../utils/gameUtils"; // Import the utility function
import CloseButton from "../../buttons/CloseButton";

/**
 * Props interface for the VictoryModal component.
 *
 * @property {boolean} isVisible - Controls modal visibility state
 * @property {number} attempts - Number of attempts taken to solve the riddle
 * @property {number} coinsEarned - Coins awarded for solving the riddle
 * @property {() => void} onNextLevel - Callback to proceed to next level
 * @property {() => void} onHome - Callback to return to home screen
 * @property {SubmittedGuess[]} guesses - Array of submitted guesses with feedback
 */
interface VictoryModalProps {
  /** Controls whether the modal is visible */
  isVisible: boolean;

  /** Number of attempts taken to solve the riddle (1-5) */
  attempts: number;

  /** Number of coins earned from solving the riddle */
  coinsEarned: number;

  /** Function called when player chooses to go to next level */
  onNextLevel: () => void;

  /** Function called when player chooses to return home */
  onHome: () => void;

  /**
   * Array of submitted guesses with feedback data.
   * Used to generate the emoji grid for sharing.
   */
  guesses: SubmittedGuess[];
}

/**
 * VictoryModal Component
 *
 * A celebratory modal that displays when a player successfully solves a riddle.
 * This component provides positive reinforcement, shows performance statistics,
 * and offers sharing capabilities through an emoji grid representation of the
 * player's solution path.
 *
 * Modal Content:
 * - Victory celebration message
 * - Number of attempts taken
 * - Coins earned (if any)
 * - Shareable emoji grid of guesses
 * - Navigation buttons (Next Level, Home)
 * - Close button for quick exit
 *
 * Visual Design:
 * - Slide-in animation for engaging entrance
 * - Semi-transparent background overlay
 * - Rounded card layout with cream background
 * - Green "Victory!" header for positive reinforcement
 * - Clear typography hierarchy for information
 *
 * Features:
 * - Automatic emoji grid generation from guesses
 * - Conditional coin display (only if coins earned)
 * - Multiple navigation options for user choice
 * - Accessible design with proper button roles
 * - Responsive layout for different screen sizes
 *
 * User Experience:
 * - Celebrates player achievement
 * - Provides clear game statistics
 * - Enables social sharing through emoji grid
 * - Offers clear next steps (continue or quit)
 * - Quick exit option with close button
 *
 * Usage Example:
 * ```tsx
 * <VictoryModal
 *   isVisible={showVictory}
 *   attempts={playerAttempts}
 *   coinsEarned={calculateCoins(attempts)}
 *   onNextLevel={handleNextLevel}
 *   onHome={handleReturnHome}
 *   guesses={playerGuesses}
 * />
 * ```
 *
 * @param {VictoryModalProps} props - Component props
 * @returns {JSX.Element} Rendered victory celebration modal
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  onNextLevel,
  onHome,
  guesses,
}) => {
  /**
   * Generate emoji grid representation of the player's guesses.
   * This creates a shareable visual summary of the solution path
   * using colored squares to represent correct, partial, and incorrect letters.
   */
  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {}}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-cream-light p-6 rounded-lg w-11/12 max-w-sm items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onHome} size={20} />
          </View>

          {/* Victory Celebration Header */}
          <Text className="text-3xl font-bold mb-4 text-green-500">
            Victory!
          </Text>

          {/* Performance Statistics */}
          <Text className="text-lg mb-2 text-gray-800">
            Solved in {attempts} attempts!
          </Text>

          {/* Conditional Coin Reward Display */}
          {coinsEarned > 0 && (
            <Text className="text-lg mb-4 text-gray-800">
              Coins Earned: {coinsEarned}
            </Text>
          )}

          {/* Emoji Grid Summary for Sharing */}
          {guesses.length > 0 && (
            <View className="mb-4 items-center">
              <Text className="text-gray-800 text-lg font-bold mb-2">
                Share your result:
              </Text>
              <Text className="text-xl leading-relaxed">{emojiSummary}</Text>
            </View>
          )}

          {/* Navigation Action Buttons */}
          <TouchableOpacity
            className="bg-blue-500 py-3 px-6 rounded-md mb-3"
            onPress={onNextLevel}
            accessibilityRole="button"
            accessibilityLabel="Go to next level"
            accessibilityHint="Continue to the next riddle challenge"
          >
            <Text className="text-white text-lg font-semibold">Next Level</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-gray-300 py-3 px-6 rounded-md"
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel="Return to home screen"
            accessibilityHint="Go back to the main menu"
          >
            <Text className="text-gray-800 text-lg font-semibold">Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default VictoryModal;
