import React from "react";
import { View, Text, Modal, TouchableOpacity } from "react-native";

/**
 * Props for the ProfileOverlay component.
 * @property {boolean} isVisible - Controls the visibility of the profile overlay.
 * @property {() => void} onClose - Function to call when the overlay is closed.
 * // TODO: Add props for user profile data
 */
interface ProfileOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Overlay component for displaying the user's profile information and stats.
 * It shows profile details and provides a way to close the overlay.
 * @param {ProfileOverlayProps} props - The props for the component.
 * @returns {React.FC<ProfileOverlayProps>} The rendered ProfileOverlay component.
 */
const ProfileOverlay: React.FC<ProfileOverlayProps> = ({
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
            Profile Overlay
          </Text>
          <Text className="text-lg text-gray-700 mb-4">
            Placeholder for User Profile Information and Stats
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

export default ProfileOverlay;
