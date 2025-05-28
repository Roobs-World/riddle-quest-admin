import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import type { SubmittedGuess } from "../../hooks/types";
import { generateFeedbackEmojiGrid } from "../../utils/gameUtils"; // Import the utility function

/**
 * Props for the VictoryModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {number} attempts - The number of attempts taken to solve the riddle.
 * @property {number} coinsEarned - The number of coins earned from solving the riddle.
 * @property {() => void} onNextLevel - Function to call when the Next Level button is pressed.
 * @property {() => void} onHome - Function to call when the Home button is pressed.
 * @property {SubmittedGuess[]} guesses - The list of submitted guesses with feedback.
 */
interface VictoryModalProps {
  isVisible: boolean;
  attempts: number;
  coinsEarned: number;
  onNextLevel: () => void;
  onHome: () => void;
  guesses: SubmittedGuess[];
}

/**
 * Modal component displayed when the player wins the game.
 * It shows the number of attempts, coins earned, and provides options to go to the next level or return to the home screen.
 * @param {VictoryModalProps} props - The props for the component.
 * @returns {React.FC<VictoryModalProps>} The rendered VictoryModal component.
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  onNextLevel,
  onHome,
  guesses,
}) => {
  const emojiSummary = generateFeedbackEmojiGrid(guesses);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => {}}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-cream-light p-6 rounded-lg w-11/12 max-w-sm items-center">
          <Text className="text-3xl font-bold mb-4 text-green-500">
            Victory!
          </Text>
          <Text className="text-lg mb-2 text-gray-800">
            Solved in {attempts} attempts!
          </Text>
          {coinsEarned > 0 && (
            <Text className="text-lg mb-4 text-gray-800">
              Coins Earned: {coinsEarned}
            </Text>
          )}

          {/* Emoji Grid Summary */}
          {guesses.length > 0 && (
            <View className="mb-4 items-center">
              <Text className="text-gray-800 text-lg font-bold mb-2">
                Share your result:
              </Text>
              <Text className="text-xl leading-relaxed">{emojiSummary}</Text>
            </View>
          )}

          {/* Buttons */}
          <TouchableOpacity
            className="bg-blue-500 py-3 px-6 rounded-md mb-3"
            onPress={onNextLevel}
          >
            <Text className="text-white text-lg font-semibold">Next Level</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-300 py-3 px-6 rounded-md"
            onPress={onHome}
          >
            <Text className="text-gray-800 text-lg font-semibold">Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default VictoryModal;
