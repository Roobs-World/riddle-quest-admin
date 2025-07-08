import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "../../../contexts/AuthContext";
import CloseButton from "../../buttons/CloseButton";

// Placeholder array of preloaded avatar URLs
const preloadedAvatars = [
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar1.png?alt=media", // Replace with actual URLs
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar2.png?alt=media",
  "https://firebasestorage.googleapis.com/v0/b/your-project-id.appspot.com/o/avatars%2Fpreloaded%2Favatar3.png?alt=media",
  // Add more preloaded avatar URLs here
];

/**
 * Props for the PreloadedAvatarsModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {() => void} onCloseAvatarOptions - Function to close the avatar options modal as well.
 */
interface PreloadedAvatarsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCloseAvatarOptions: () => void;
}

/**
 * Modal component for selecting from preloaded avatars.
 * Displays a grid of preloaded avatar images for selection.
 */
const PreloadedAvatarsModal: React.FC<PreloadedAvatarsModalProps> = ({
  isVisible,
  onClose,
  onCloseAvatarOptions,
}) => {
  const { updatePlayerData } = useAuth();

  const handlePreloadedAvatarSelect = async (avatarUrl: string) => {
    try {
      // Update the avatarUrl in the user's Firestore document
      await updatePlayerData({ avatarUrl });
      Alert.alert("Success", "Avatar updated successfully!");
      onClose(); // Close modal on selection
      onCloseAvatarOptions(); // Also close the options modal if open
    } catch (error) {
      console.error("Error updating avatar:", error);
      Alert.alert("Error", "Could not update avatar. Please try again.");
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text className="text-lg font-bold text-gray-800 mb-4">
            Select Avatar
          </Text>
          <ScrollView className="max-h-60 mb-4">
            <View className="flex-row flex-wrap justify-center">
              {preloadedAvatars.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handlePreloadedAvatarSelect(url)}
                  className="m-2"
                >
                  <Image
                    source={{ uri: url }}
                    className="w-16 h-16 rounded-full"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            className="bg-gray-300 px-4 py-3 rounded-md w-full items-center"
            onPress={onClose}
          >
            <Text className="text-gray-800 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PreloadedAvatarsModal;
