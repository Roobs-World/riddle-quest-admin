import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";

interface WelcomeOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-6 rounded-lg m-4 relative max-w-sm">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold mb-4 text-center">
            Welcome to Qwordly!
          </Text>
          <Text className="text-base mb-4 text-center text-gray-700">
            Ready for an exciting riddle adventure?
          </Text>
          <Text className="text-base mb-4 text-center text-gray-600">
            Solve engaging riddles by guessing the answer letter by letter. Each
            puzzle is a mini-mystery waiting to be solved!
          </Text>
          <Text className="text-base mb-6 text-center text-gray-600">
            Earn coins, unlock new levels, and challenge yourself daily.
            Let&apos;s get started!
          </Text>
          <TouchableOpacity
            className="mt-4 bg-blue-500 py-3 px-6 rounded-lg self-center"
            onPress={onClose}
          >
            <Text className="text-white text-lg font-semibold">
              Let&apos;s Play!
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default WelcomeOverlay;
