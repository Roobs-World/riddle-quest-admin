import React, { useState } from "react";
import { View, Text, Modal, TextInput, Alert } from "react-native";
import { getAuth, EmailAuthProvider } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "src/components/buttons/WideButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";

interface FirebaseError {
  code: string;
  message: string;
  email?: string;
}

interface ChangePasswordModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const handleChangePassword = async () => {
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
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);

      Alert.alert("Success", "Password updated successfully!");
      handleClose();
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = "An error occurred while changing password.";
      if (firebaseError.code === "auth/invalid-credential") {
        errorMessage = "Invalid current password.";
      }
      Alert.alert("Error", errorMessage);
    }
  };

  const handleClose = () => {
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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View style={{ width: "80%", alignItems: "center" }}>
            <CloseButton
              onPress={handleClose}
              size={20}
              style={{ position: "absolute", top: -20, right: -20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(24),
                color: "white",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Change Password
            </Text>
            <TextInput
              style={{
                backgroundColor: "white",
                width: "100%",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                fontFamily: TYPOGRAPHY.fontSecondary,
              }}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current Password"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{
                backgroundColor: "white",
                width: "100%",
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
                fontFamily: TYPOGRAPHY.fontSecondary,
              }}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{
                backgroundColor: "white",
                width: "100%",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontFamily: TYPOGRAPHY.fontSecondary,
              }}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder="Confirm New Password"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <WideButton buttonText="Save" onPress={handleChangePassword} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ChangePasswordModal;
