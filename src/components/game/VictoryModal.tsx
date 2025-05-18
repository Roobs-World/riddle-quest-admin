import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

interface VictoryModalProps {
  isVisible: boolean;
  attempts: number;
  coinsEarned: number;
  onNextLevelPress: () => void;
  // TODO: Add shareable emoji summary prop
}

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
