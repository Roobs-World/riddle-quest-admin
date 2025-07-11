import React, { useState } from "react";
import { View, Text, Modal, TextInput, Alert } from "react-native";
import { getFunctions } from "@react-native-firebase/functions";
import { getApp } from "@react-native-firebase/app";
import { useAuth } from "../../../contexts/AuthContext";
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
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

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
          displayName: newUsername,
        },
      });

      const responseData = result.data as { success: boolean; message: string };

      if (responseData.success) {
        Alert.alert("Success", responseData.message);
        updatePlayerData({ username: newUsername });
        onClose();
      } else {
        Alert.alert("Error", responseData.message || "Username update failed.");
      }
    } catch (error) {
      const firebaseError = error as FirebaseError;
      let errorMessage = "An error occurred.";
      if (firebaseError.code === "already-exists") {
        errorMessage = "Username already taken.";
      }
      Alert.alert("Error", errorMessage);
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
              style={{ position: "absolute", top: -60, right: -20, zIndex: 10 }}
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
              Update Username
            </Text>
            <TextInput
              style={{
                backgroundColor: "white",
                width: "100%",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontFamily: TYPOGRAPHY.fontSecondary,
              }}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              placeholderTextColor="#888"
              autoCapitalize="none"
            />
            <WideButton buttonText="Save" onPress={handleUpdateUsername} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateUsernameModal;
