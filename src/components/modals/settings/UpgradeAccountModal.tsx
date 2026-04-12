import React, { useState } from "react";
import { Alert, Modal, Text, View } from "react-native";
import { AppStrings } from "@/constants/AppStrings";
import { AuthService } from "@/services/AuthService";
import CloseButton from "@/components/buttons/CloseButton";
import GoogleSignInButton from "@/components/buttons/GoogleSignInButton";
import FacebookSignInButton from "@/components/buttons/FacebookSignInButton";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import { LOADING_SPINNER_SIZE } from "@/constants/loading";
import { SPACING, TYPOGRAPHY, COLORS } from "@/styles";
import { captureException } from "@/utils/sentry";
import { logger } from "@/utils/logger";
import { type FirebaseAuthTypes } from "@react-native-firebase/auth";

interface UpgradeAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const UpgradeAccountModal: React.FC<UpgradeAccountModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthError = (error: unknown) => {
    const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
    const code = typeof firebaseError?.code === "string" ? firebaseError.code : "";

    if (code === "auth/auth-popup-closed-by-user") {
      return;
    }

    if (
      code === "auth/credential-already-in-use" ||
      code === "auth/email-already-in-use" ||
      code === "auth/account-exists-with-different-credential"
    ) {
      Alert.alert(
        AppStrings.CommonAlerts.ERROR_TITLE,
        AppStrings.Profile.UPGRADE_ACCOUNT_PROVIDER_IN_USE
      );
      return;
    }

    Alert.alert(
      AppStrings.CommonAlerts.ERROR_TITLE,
      firebaseError?.message || AppStrings.Profile.UPGRADE_ACCOUNT_ERROR
    );
  };

  const linkWithGoogle = async () => {
    setIsLoading(true);
    try {
      await AuthService.linkAnonymousWithGoogle();
      Alert.alert(
        AppStrings.Profile.ALERT_SUCCESS_TITLE,
        AppStrings.Profile.UPGRADE_ACCOUNT_SUCCESS
      );
      onClose();
    } catch (error) {
      logger.error("Upgrade account (Google) error:", error);
      captureException(error);
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const linkWithFacebook = async () => {
    setIsLoading(true);
    try {
      await AuthService.linkAnonymousWithFacebook();
      Alert.alert(
        AppStrings.Profile.ALERT_SUCCESS_TITLE,
        AppStrings.Profile.UPGRADE_ACCOUNT_SUCCESS
      );
      onClose();
    } catch (error) {
      logger.error("Upgrade account (Facebook) error:", error);
      captureException(error);
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: SPACING.lg,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: COLORS.white,
            borderRadius: 18,
            padding: SPACING.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: SPACING.md,
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: COLORS.black,
              }}
            >
              {AppStrings.Profile.UPGRADE_ACCOUNT_TITLE}
            </Text>
            <CloseButton onPress={onClose} size={24} color={COLORS.black} />
          </View>

          <Text
            style={{
              fontFamily: TYPOGRAPHY.fontSecondary,
              fontSize: TYPOGRAPHY.fontSize.lg,
              color: "#333333",
              marginBottom: SPACING.lg,
              lineHeight: 22,
            }}
          >
            {AppStrings.Profile.UPGRADE_ACCOUNT_DESCRIPTION}
          </Text>

          <View style={{ gap: SPACING.md }}>
            <GoogleSignInButton onPress={linkWithGoogle} disabled={isLoading} />
            <FacebookSignInButton onPress={linkWithFacebook} disabled={isLoading} />
          </View>
        </View>

        <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />
      </View>
    </Modal>
  );
};

export default UpgradeAccountModal;

