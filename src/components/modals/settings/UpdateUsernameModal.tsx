import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../../../contexts/AuthContext";
import CloseButton from "../../buttons/CloseButton";

// Define proper error interface for Firebase errors
interface FirebaseError {
  code: string;
  message: string;
  email?: string;
}

/**
 * Props for the UpdateUsernameModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 * @property {string} currentUsername - The current username to display as default.
 */
interface UpdateUsernameModalProps {
  isVisible: boolean;
  onClose: () => void;
  currentUsername: string;
}

/**
 * Modal component for updating username.
 * Provides form field for new username with validation.
 */
const UpdateUsernameModal: React.FC<UpdateUsernameModalProps> = ({
  isVisible,
  onClose,
  currentUsername,
}) => {
  const { updatePlayerData } = useAuth();
  const [newUsername, setNewUsername] = useState(currentUsername || "");

  const handleUpdateUsername = async () => {
    if (newUsername.trim() === "") {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

    // Add a check for minimum length, e.g., 3 characters
    if (newUsername.trim().length < 3) {
      Alert.alert("Error", "Username must be at least 3 characters long.");
      return;
    }

    try {
      const processFormSubmissionCallable = getFunctions(
        getApp()
      ).httpsCallable("processFormSubmission");
      const result = await processFormSubmissionCallable({
        formType: "profileUpdate",
        formData: {
          displayName: newUsername, // Use displayName as per backend function
        },
      });

      const responseData = result.data as { success: boolean; message: string }; // Explicit type casting

      if (responseData.success) {
        Alert.alert("Success", responseData.message);
        // Update client-side player data with the new username
        // NOTE: The backend updates 'displayName', assuming client uses 'username'
        // Ensure consistency between backend and frontend field names or map them.
        updatePlayerData({ username: newUsername }); // Assuming username is the correct field to update
        onClose();
      } else {
        // This else block might not be reached if backend throws HttpsError
        Alert.alert("Error", responseData.message || "Username update failed.");
      }
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("Error updating username:", firebaseError);
      let errorMessage = "An error occurred.";
      if (firebaseError.code === "invalid-argument") {
        errorMessage = "Invalid username data provided.";
      } else if (firebaseError.code === "internal") {
        errorMessage = "Server error updating username.";
      } else if (firebaseError.message) {
        // Catch other potential errors with a message
        errorMessage = firebaseError.message;
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const handleClose = () => {
    // Reset to original username when closing
    setNewUsername(currentUsername || "");
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-white p-6 rounded-lg m-4 w-11/12 max-w-sm relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={handleClose} size={20} />
          </View>

          <Text className="text-lg font-bold text-gray-800 mb-4">
            Update Username
          </Text>
          <TextInput
            className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
            value={newUsername}
            onChangeText={setNewUsername}
            placeholder="Enter new username"
            autoCapitalize="none"
          />
          <TouchableOpacity
            className="bg-blue-500 px-4 py-3 rounded-md mb-3 w-full items-center"
            onPress={handleUpdateUsername}
          >
            <Text className="text-white font-semibold">Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-300 px-4 py-3 rounded-md w-full items-center"
            onPress={handleClose}
          >
            <Text className="text-gray-800 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateUsernameModal;
