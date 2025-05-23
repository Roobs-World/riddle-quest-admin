import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

interface InstructionsOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const InstructionsOverlay: React.FC<InstructionsOverlayProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-6 rounded-lg m-4">
          <Text className="text-xl font-bold mb-4">How to Play</Text>
          <Text className="text-base mb-4">
            Guess the hidden riddle in 6 tries.
          </Text>
          <Text className="text-base mb-4">
            After each guess, the color of the letters will change to show how
            close your guess was.
          </Text>
          <Text className="text-base mb-4">Here's what the colors mean:</Text>
          <Text className="text-base mb-2 font-semibold">Examples:</Text>
          <Text className="text-base mb-2">
            - <Text style={{ color: "green" }}>GREEN</Text>: The letter is in
            the word and in the correct spot.
          </Text>
          <Text className="text-base mb-2">
            - <Text style={{ color: "yellow" }}>YELLOW</Text>: The letter is in
            the word but in the wrong spot.
          </Text>
          <Text className="text-base mb-4">
            - <Text style={{ color: "gray" }}>GRAY</Text>: The letter is not in
            the word in any spot.
          </Text>
          <TouchableOpacity
            className="mt-6 bg-blue-500 py-3 px-6 rounded-lg self-center"
            onPress={onClose}
          >
            <Text className="text-white text-lg font-semibold">Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default InstructionsOverlay;
