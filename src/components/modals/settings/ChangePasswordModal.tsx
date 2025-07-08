import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { getAuth, EmailAuthProvider } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import CloseButton from "../../buttons/CloseButton";

// Define proper error interface for Firebase errors
interface FirebaseError {
  code: string;
  message: string;
  email?: string;
}

/**
 * Props for the ChangePasswordModal component.
 * @property {boolean} isVisible - Controls the visibility of the modal.
 * @property {() => void} onClose - Function to call when the modal is closed.
 */
interface ChangePasswordModalProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Modal component for changing user password.
 * Provides form fields for current password, new password, and confirmation.
 */
const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const handleChangePassword = async () => {
    // 1. Validate inputs (currentPassword, newPassword, confirmNewPassword)
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters long.");
      return;
    }

    const user = getAuth(getApp()).currentUser;

    if (!user || !user.email) {
      Alert.alert("Error", "User not logged in or email not available.");
      return;
    }

    try {
      // 3. Re-authenticate user if necessary
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);

      // 4. Call user.updatePassword(newPassword) with current user instance
      await user.updatePassword(newPassword);

      // 5. Handle success
      Alert.alert("Success", "Password updated successfully!");
      onClose(); // Close modal on completion
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      const firebaseError = error as FirebaseError;
      console.error("Error changing password:", firebaseError);
      let errorMessage = "An error occurred while changing password.";

      if (firebaseError.code === "auth/requires-recent-login") {
        errorMessage = "Please log in again to change your password.";
      } else if (firebaseError.code === "auth/invalid-credential") {
        errorMessage = "Invalid current password.";
      } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "New password is too weak.";
      } else if (firebaseError.message) {
        errorMessage = firebaseError.message;
      }

      Alert.alert("Error", errorMessage);
    }
  };

  const handleClose = () => {
    // Clear password fields when closing
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
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
            Change Password
          </Text>
          <TextInput
            className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current Password"
            secureTextEntry
          />
          <TextInput
            className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New Password"
            secureTextEntry
          />
          <TextInput
            className="border border-gray-300 p-3 rounded-md mb-4 text-gray-800"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Confirm New Password"
            secureTextEntry
          />
          <TouchableOpacity
            className="bg-blue-500 px-4 py-3 rounded-md mb-3 w-full items-center"
            onPress={handleChangePassword}
          >
            <Text className="text-white font-semibold">Save Changes</Text>
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

export default ChangePasswordModal;
