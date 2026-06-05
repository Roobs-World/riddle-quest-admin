import React, {useEffect, useRef, useState} from "react";
import {View, Text, Modal, TextInput} from "react-native";
import {useAuth} from "../../../contexts/AuthContext";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "src/components/buttons/WideButton";
import PulsingSpinner from "src/components/loading/PulsingSpinner";
import {TYPOGRAPHY} from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {t} from "../../../i18n";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  INPUT_BORDER_RADIUS,
  INPUT_PADDING,
  CLOSE_BUTTON_INSET,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import {callValidatedFunction} from "../../../utils/firebaseFunctions";
import {getUpdateUsernameErrorMessage} from "../../../application/errors/cloudFunctionErrorMessages";
import {BasicSuccessMessageOutputSchema, UpdateUsernameInputSchema} from "../../../validation/cloudFunctionsSchemas";

interface UpdateUsernameModalProps {
  isVisible: boolean;
  onClose: () => void;
  currentUsername: string;
}

const UpdateUsernameModal: React.FC<UpdateUsernameModalProps> = ({isVisible, onClose, currentUsername}) => {
  const COMPACT_MODAL_HEIGHT = Math.min(MODAL_HEIGHT * 0.75, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 0.75);
  const compactContentHeight = Math.min(MODAL_HEIGHT * 0.56, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 0.56);
  const {updatePlayerData} = useAuth();
  const [newUsername, setNewUsername] = useState(currentUsername || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const previousVisibleRef = useRef(isVisible);
  const previousUsernameRef = useRef(currentUsername);

  useEffect(() => {
    const didOpen = isVisible && !previousVisibleRef.current;
    const usernameChanged = currentUsername !== previousUsernameRef.current;
    previousVisibleRef.current = isVisible;
    previousUsernameRef.current = currentUsername;

    if (isVisible && (didOpen || usernameChanged)) {
      setNewUsername(currentUsername || "");
      setUsernameError("");
    }
  }, [currentUsername, isVisible]);

  const validateUsername = (username: string): string | null => {
    if (!username) {
      return t("Profile.ALERT_USERNAME_EMPTY");
    }

    if (username.length < 3) {
      return t("Profile.ALERT_USERNAME_TOO_SHORT");
    }

    return null;
  };

  const handleUpdateUsername = async () => {
    const trimmedUsername = newUsername.trim();
    if (isSubmitting) {
      return;
    }

    setUsernameError("");
    const validationError = validateUsername(trimmedUsername);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const responseData = await callValidatedFunction(
        "updateUsername",
        {
          username: trimmedUsername,
        },
        UpdateUsernameInputSchema,
        BasicSuccessMessageOutputSchema,
      );

      if (responseData.success) {
        await updatePlayerData({username: trimmedUsername});
        onClose();
      } else {
        setUsernameError(responseData.message || t("Profile.ALERT_USERNAME_UPDATE_FAILED"));
      }
    } catch (error) {
      setUsernameError(getUpdateUsernameErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    setNewUsername(currentUsername || "");
    setUsernameError("");
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: compactContentHeight,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={compactContentHeight}
              style={{position: "absolute"}}
              preserveAspectRatio="none"
            />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={COMPACT_MODAL_HEIGHT * 1.1}
              style={{
                position: "absolute",
                top: -COMPACT_MODAL_HEIGHT * 0.05,
                left: -MODAL_WIDTH * 0.05,
              }}
            />
            <CloseButton
              onPress={handleClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                marginTop: verticalScale(-130),
                right: CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
            />
            <View style={{width: "80%", alignItems: "center"}}>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {t("Profile.UPDATE_USERNAME_TITLE")}
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
                onChangeText={(value) => {
                  setNewUsername(value);
                  if (usernameError) {
                    setUsernameError("");
                  }
                }}
                placeholder={t("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
                placeholderTextColor="#888"
                autoCapitalize="none"
                testID="update-username-input"
                accessibilityLabel={t("Profile.ENTER_NEW_USERNAME_PLACEHOLDER")}
              />
              {usernameError ? (
                <Text
                  testID="username-error-text"
                  style={{
                    width: "100%",
                    color: "#B42318",
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    marginTop: -SPACING.sm,
                    marginBottom: SPACING.md,
                  }}
                >
                  {usernameError}
                </Text>
              ) : null}
              <WideButton
                buttonText={t("Profile.SAVE_BUTTON")}
                onPress={handleUpdateUsername}
                disabled={isSubmitting}
                testID="update-username-save-button"
              />
            </View>
          </View>
        </SlideInModalContent>
      </View>
      <PulsingSpinner visible={isSubmitting} opacity={0.35} />
    </Modal>
  );
};

export default UpdateUsernameModal;
