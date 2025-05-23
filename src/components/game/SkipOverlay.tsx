import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

interface SkipOverlayProps {
  isVisible: boolean;
  userCoins: number;
  skipCost: number;
  onConfirmSkip: () => void;
  onClose: () => void;
}

const SkipOverlay: React.FC<SkipOverlayProps> = ({
  isVisible,
  userCoins,
  skipCost,
  onConfirmSkip,
  onClose,
}) => {
  const canAffordSkip = userCoins >= skipCost;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg items-center">
          <Text className="text-xl font-bold text-gray-800 mb-4">
            Skip Level?
          </Text>
          <Text className="text-md text-gray-700 mb-4">
            Cost: {skipCost} Coins. You have: {userCoins} Coins.
          </Text>
          {!canAffordSkip && (
            <Text className="text-red-500 mb-4">
              You do not have enough coins to skip this level.
            </Text>
          )}
          <View className="flex-row mt-4">
            <TouchableOpacity
              onPress={onConfirmSkip}
              className={`px-4 py-2 rounded mr-4 ${
                canAffordSkip ? "bg-red-500" : "bg-gray-400"
              }`}
              disabled={!canAffordSkip}
            >
              <Text className="text-white font-bold">Skip Level</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-500 px-4 py-2 rounded"
            >
              <Text className="text-white font-bold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SkipOverlay;
