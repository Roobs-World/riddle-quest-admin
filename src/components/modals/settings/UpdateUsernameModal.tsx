import React, { useState } from "react";
import { View, Text, Modal, TextInput, Alert } from "react-native";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../../../contexts/AuthContext";
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

interface UpdateUsernameModalProps {
  isVisible: boolean;
  onClose: () => void;
  currentUsername: string;
}

const UpdateUsernameModal: React.FC<UpdateUsernameModalProps> = ({
  isVisible,
  onClose,
  currentUsername,
}) => {
  const { updatePlayerData } = useAuth();
  const [newUsername, setNewUsername] = useState(currentUsername || "");

  const handleUpdateUsername = async () => {
    if (newUsername.trim() === "") {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_USERNAME_EMPTY);
      return;
    }

    if (newUsername.trim().length < 3) {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_USERNAME_TOO_SHORT);
      return;
    }

    try {
      const processFormSubmissionCallable = httpsCallable(
        getFunctions(getApp()),
        "updateUsername"
      );
      const result = await processFormSubmissionCallable({
        username: newUsername,
      });

      const responseData = result.data as { success: boolean; message: string };

      if (responseData.success) {
        Alert.alert(AppStrings.CommonAlerts.SUCCESS_TITLE, responseData.message);
        updatePlayerData({ username: newUsername });
        onClose();
      } else {
        Alert.alert(
          AppStrings.CommonAlerts.ERROR_TITLE,
          responseData.message || AppStrings.Profile.ALERT_USERNAME_UPDATE_FAILED
        );
      }
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage: string = AppStrings.Profile.ALERT_AN_ERROR_OCCURRED;
      if (firebaseError.code === "already-exists") {
        errorMessage = AppStrings.Profile.ALERT_USERNAME_ALREADY_TAKEN;
      }
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, errorMessage);
    }
  };

  const handleClose = () => {
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
              {AppStrings.Profile.UPDATE_USERNAME_TITLE}
            </Text>
            <TextInput
              style={{
                backgroundColor: "white",
                width: "100%",
                borderRadius: INPUT_BORDER_RADIUS,
                padding: INPUT_PADDING,
                marginBottom: SPACING.lg,
                fontFamily: TYPOGRAPHY.fontSecondary,
              }}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder={AppStrings.Profile.ENTER_NEW_USERNAME_PLACEHOLDER}
              placeholderTextColor="#888"
              autoCapitalize="none"
            />
            <WideButton buttonText={AppStrings.Profile.SAVE_BUTTON} onPress={handleUpdateUsername} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateUsernameModal;

