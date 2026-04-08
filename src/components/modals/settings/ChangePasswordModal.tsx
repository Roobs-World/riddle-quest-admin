import React, { useState } from "react";
import { View, Text, Modal, TextInput, Alert } from "react-native";
import { getAuth, EmailAuthProvider } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "src/components/buttons/WideButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_INSET,
  CLOSE_BUTTON_SIZE,
  INPUT_BORDER_RADIUS,
  INPUT_PADDING,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

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

  const inputStyle = {
    backgroundColor: "white" as const,
    width: "100%" as const,
    borderRadius: INPUT_BORDER_RADIUS,
    padding: INPUT_PADDING,
    fontFamily: TYPOGRAPHY.fontSecondary,
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
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          <View style={{ width: "80%", alignItems: "center" }}>
            <CloseButton
              onPress={handleClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                top: -CLOSE_BUTTON_INSET,
                right: -CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: "black",
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              Change Password
            </Text>
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.sm }}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current Password"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.sm }}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.lg }}
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
