import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";
import CloseButton from "../buttons/CloseButton";

/**
 * Props for the HomeOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the home overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 */
interface HomeOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Overlay component for the Home screen accessed from the bottom navigation.
 * It serves as a placeholder for future home screen content.
 * @param {HomeOverlayProps} props - The props for the component.
 * @returns {React.FC<HomeOverlayProps>} The rendered HomeOverlay component.
 */
const HomeOverlay: React.FC<HomeOverlayProps> = ({ isVisible, onClose }) => {
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
            Home Overlay
          </Text>
          <Text className="text-lg text-gray-700 mb-4">
            Placeholder for Home Screen Content
          </Text>
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

export default HomeOverlay;
