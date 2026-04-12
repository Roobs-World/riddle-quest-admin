import React, { useState } from "react";
import { View, Text, Modal, TextInput, Alert } from "react-native";
import { getAuth, EmailAuthProvider } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "src/components/buttons/WideButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import { AppStrings } from "../../../constants/AppStrings";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
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
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_PASSWORD_FIELDS_EMPTY);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_PASSWORDS_DO_NOT_MATCH);
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_PASSWORD_TOO_SHORT);
      return;
    }

    const user = getAuth(getApp()).currentUser;

    if (!user || !user.email) {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_USER_NOT_LOGGED_IN);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);

      Alert.alert(AppStrings.CommonAlerts.SUCCESS_TITLE, AppStrings.Profile.ALERT_PASSWORD_UPDATE_SUCCESS);
      handleClose();
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = AppStrings.Profile.ALERT_PASSWORD_CHANGE_ERROR;
      if (firebaseError.code === "auth/invalid-credential") {
        errorMessage = AppStrings.Profile.ALERT_INVALID_CURRENT_PASSWORD;
      }
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, errorMessage);
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
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={handleClose}
            size={CLOSE_BUTTON_SIZE}
            style={MODAL_CLOSE_BUTTON_POSITION}
          />
          <View style={{ width: "80%", alignItems: "center" }}>
            
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: "black",
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              {AppStrings.Profile.CHANGE_PASSWORD_TITLE}
            </Text>
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.sm }}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={AppStrings.Profile.CURRENT_PASSWORD_PLACEHOLDER}
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.sm }}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={AppStrings.Profile.NEW_PASSWORD_PLACEHOLDER}
              placeholderTextColor="#888"
              secureTextEntry
            />
            <TextInput
              style={{ ...inputStyle, marginBottom: SPACING.lg }}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder={AppStrings.Profile.CONFIRM_NEW_PASSWORD_PLACEHOLDER}
              placeholderTextColor="#888"
              secureTextEntry
            />
            <WideButton buttonText={AppStrings.Profile.SAVE_BUTTON} onPress={handleChangePassword} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ChangePasswordModal;

