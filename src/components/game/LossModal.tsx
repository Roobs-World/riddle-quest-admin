import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

interface LossModalProps {
  isVisible: boolean;
  correctAnswer: string;
  onRetryPress: () => void;
}

const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onRetryPress,
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
          <Text className="text-2xl font-bold text-red-600 mb-4">
            You Lost!
          </Text>
          <Text className="text-lg text-gray-800 mb-4">
            The answer was: {correctAnswer}
          </Text>
          <View className="flex-row mt-4">
            <TouchableOpacity
              onPress={onRetryPress}
              className="bg-blue-500 px-4 py-2 rounded mr-4"
            >
              <Text className="text-white font-bold">Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LossModal;
