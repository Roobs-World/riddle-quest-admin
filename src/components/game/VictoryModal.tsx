import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

/**
 * Props for the VictoryModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {number} attempts - The number of attempts taken to solve the riddle.
 * @property {number} coinsEarned - The number of coins earned from solving the riddle.
 * @property {() => void} onNextLevelPress - Function to call when the Next Level button is pressed.
 */
interface VictoryModalProps {
  isVisible: boolean;
  attempts: number;
  coinsEarned: number;
  onNextLevelPress: () => void;
  // TODO: Add shareable emoji summary prop
}

/**
 * Modal component displayed when the player wins the game.
 * It shows the number of attempts, coins earned, and provides an option to go to the next level.
 * @param {VictoryModalProps} props - The props for the component.
 * @returns {React.FC<VictoryModalProps>} The rendered VictoryModal component.
 */
const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  attempts,
  coinsEarned,
  onNextLevelPress,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg items-center">
          <Text className="text-2xl font-bold text-green-600 mb-4">
            Victory!
          </Text>
          <Text className="text-lg text-gray-800 mb-2">
            Attempts: {attempts}
          </Text>
          <Text className="text-lg text-gray-800 mb-4">
            Coins Earned: {coinsEarned}
          </Text>
          {/* TODO: Display shareable emoji summary */}
          <View className="flex-row mt-4">
            <TouchableOpacity
              onPress={onNextLevelPress}
              className="bg-blue-500 px-4 py-2 rounded mr-4"
            >
              <Text className="text-white font-bold">Next Level</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default VictoryModal;
