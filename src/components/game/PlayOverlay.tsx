import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";

/**
 * Props for the PlayOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the play overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 * // TODO: Add props for selecting game mode if needed
 */
interface PlayOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  // TODO: Add props for selecting game mode if needed
  // Placeholder props for game mode selection
  onSelectChallenge?: () => void;
  onSelectClassic?: () => void;
}

/**
 * Overlay component for selecting game modes or starting a new game.
 * It shows available play options and provides a way to close the overlay.
 * @param {PlayOverlayProps} props - The props for the component.
 * @returns {React.FC<PlayOverlayProps>} The rendered PlayOverlay component.
 */
const PlayOverlay: React.FC<PlayOverlayProps> = ({ isVisible, onClose }) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-4">
            Play Overlay
          </Text>
          <Text className="text-lg text-gray-700 mb-4">
            Placeholder for Play Options (e.g., Challenge, Classic)
          </Text>
          {/* Placeholder: Challenge Mode Button will go here */}
          {/* Placeholder: Classic Mode Button will go here */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 px-4 py-2 rounded"
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PlayOverlay;
