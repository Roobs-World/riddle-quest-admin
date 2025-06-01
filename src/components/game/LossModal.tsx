import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";

/**
 * Props for the LossModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {string} correctAnswer - The correct answer to display in the modal.
 * @property {() => void} onRetry - Function to call when the Retry button is pressed.
 * @property {() => void} onHome - Function to call when the Home button is pressed.
 */
interface LossModalProps {
  isVisible: boolean;
  correctAnswer: string;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Modal component displayed when the player loses the game.
 * It shows the correct answer and provides options to retry or go home.
 * @param {LossModalProps} props - The props for the component.
 * @returns {React.FC<LossModalProps>} The rendered LossModal component.
 */
const LossModal: React.FC<LossModalProps> = ({
  isVisible,
  correctAnswer,
  onRetry,
  onHome,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      // onRequestClose={onHome} // Optional: close modal on back press
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-6 rounded-lg m-4 items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onHome} size={20} />
          </View>

          <Text className="text-2xl font-bold mb-4 text-red-600">Loss!</Text>
          <Text className="text-base mb-4">
            Correct Answer: {correctAnswer}
          </Text>
          <TouchableOpacity
            className="bg-blue-500 px-4 py-2 rounded mb-2"
            onPress={onRetry}
          >
            <Text className="text-white text-lg font-semibold">Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-300 px-4 py-2 rounded"
            onPress={onHome}
          >
            <Text className="text-black text-lg font-semibold">Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default LossModal;
