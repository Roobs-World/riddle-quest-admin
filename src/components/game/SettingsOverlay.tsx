import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

/**
 * Props for the SettingsOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the settings overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 * // TODO: Add props for settings options (Sound, Haptics, Help, Logout, Reset Stats)
 */
interface SettingsOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  // TODO: Add props for settings options (Sound, Haptics, Help, Logout, Reset Stats)
}

/**
 * Overlay component for displaying application settings.
 * It shows various settings options and provides a way to close the overlay.
 * @param {SettingsOverlayProps} props - The props for the component.
 * @returns {React.FC<SettingsOverlayProps>} The rendered SettingsOverlay component.
 */
const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg items-center">
          <Text className="text-2xl font-bold text-gray-800 mb-4">
            Settings
          </Text>
          <Text className="text-lg text-gray-700 mb-4">
            Placeholder for Settings Options
          </Text>
          {/* TODO: Add toggles and buttons for settings */}
          <TouchableOpacity
            onPress={onClose}
            className="bg-gray-500 px-4 py-2 rounded mt-4"
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default SettingsOverlay;
