import React, {useEffect, useState} from "react";
import {Alert, Modal, Text, TouchableOpacity, View} from "react-native";
import {t} from "@/i18n";
import {AuthService} from "@/services/AuthService";
import {useModal} from "@/hooks/useModal";
import CloseButton from "@/components/buttons/CloseButton";
import GoogleSignInButton from "@/components/buttons/GoogleSignInButton";
import FacebookSignInButton from "@/components/buttons/FacebookSignInButton";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import {LOADING_SPINNER_SIZE} from "@/constants/loading";
import {AUTH_CONTENT_MAX_WIDTH, MODAL_CONTENT_PADDING} from "@/constants/layout";
import {SPACING, TYPOGRAPHY, COLORS} from "@/styles";
import {captureException} from "@/utils/sentry";
import {logger} from "@/utils/logger";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {
  extractErrorMessage,
  extractErrorCode,
} from "../../../utils/errorResolution";
import {
  isAccountAlreadyInUseError,
  isFacebookLoginCancellation,
  isGoogleSignInCancellation,
} from "../../../application/auth/authErrorMessages";

interface UpgradeAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialExistingAccountPromptVisible?: boolean;
}

const UpgradeAccountModal: React.FC<UpgradeAccountModalProps> = ({
  isVisible,
  onClose,
  initialExistingAccountPromptVisible = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExistingAccountModalVisible, setIsExistingAccountModalVisible] = useState(false);
  const {showInfoModal} = useModal();

  useEffect(() => {
    if (!isVisible) {
      const closePrompt = setTimeout(() => {
        setIsExistingAccountModalVisible(false);
      }, 0);

      return () => clearTimeout(closePrompt);
    }

    if (!initialExistingAccountPromptVisible) {
      return;
    }

    const openPrompt = setTimeout(() => {
      setIsExistingAccountModalVisible(true);
    }, 0);

    return () => clearTimeout(openPrompt);
  }, [initialExistingAccountPromptVisible, isVisible]);

  const handleAuthError = (error: unknown) => {
    const code = extractErrorCode(error) ?? "";
    const message = extractErrorMessage(error) ?? "";

    if (code === "auth/auth-popup-closed-by-user") {
      return;
    }

    if (isAccountAlreadyInUseError(error)) {
      setIsExistingAccountModalVisible(true);
      return;
    }

    Alert.alert(
      t("CommonAlerts.ERROR_TITLE"),
      message || t("Profile.UPGRADE_ACCOUNT_ERROR"),
    );
  };

  const linkWithGoogle = async () => {
    setIsLoading(true);
    try {
      await AuthService.linkAnonymousWithGoogle();
      onClose();
      showInfoModal({
        title: t("Profile.ALERT_SUCCESS_TITLE"),
        message: t("Profile.UPGRADE_ACCOUNT_SUCCESS"),
      });
    } catch (error) {
      if (isGoogleSignInCancellation(error)) {
        return;
      }

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
      const userCredential = await AuthService.linkAnonymousWithFacebook();
      if (!userCredential) {
        return;
      }

      onClose();
      showInfoModal({
        title: t("Profile.ALERT_SUCCESS_TITLE"),
        message: t("Profile.UPGRADE_ACCOUNT_SUCCESS"),
      });
    } catch (error) {
      if (isFacebookLoginCancellation(error)) {
        return;
      }

      logger.error("Upgrade account (Facebook) error:", error);
      captureException(error);
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutForExistingAccount = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setIsExistingAccountModalVisible(false);
      onClose();
    } catch (error) {
      logger.error("Upgrade account existing-account logout error:", error);
      captureException(error);
      Alert.alert(t("Settings.LOGOUT_ERROR_TITLE"), t("Settings.LOGOUT_ERROR_MESSAGE"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: SPACING.lg,
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{width: "100%", maxWidth: AUTH_CONTENT_MAX_WIDTH}}>
          <View
            style={{
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
                {t("Profile.UPGRADE_ACCOUNT_TITLE")}
              </Text>
              <CloseButton onPress={onClose} size={24} color="black" />
            </View>

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "#333333",
                marginBottom: SPACING.lg,
                lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.normal,
              }}
            >
              {t("Profile.UPGRADE_ACCOUNT_DESCRIPTION")}
            </Text>

            <View style={{gap: SPACING.md}}>
              <GoogleSignInButton onPress={linkWithGoogle} disabled={isLoading} />
              <FacebookSignInButton onPress={linkWithFacebook} disabled={isLoading} />
            </View>
          </View>
        </SlideInModalContent>

        <PulsingSpinner visible={isLoading} size={LOADING_SPINNER_SIZE} />

        <Modal
          visible={isExistingAccountModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={() => setIsExistingAccountModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.55)",
              padding: SPACING.lg,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: AUTH_CONTENT_MAX_WIDTH,
                backgroundColor: COLORS.white,
                borderRadius: 16,
                padding: MODAL_CONTENT_PADDING,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.xl,
                  color: COLORS.black,
                  marginBottom: SPACING.sm,
                }}
              >
                {t("Profile.UPGRADE_ACCOUNT_EXISTING_ACCOUNT_TITLE")}
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#333333",
                  lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
                }}
              >
                {t("Profile.UPGRADE_ACCOUNT_EXISTING_ACCOUNT_DESCRIPTION")}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: SPACING.sm,
                  marginTop: SPACING.lg,
                }}
              >
                <TouchableOpacity
                  onPress={() => setIsExistingAccountModalVisible(false)}
                  style={{
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "#4B5563",
                    }}
                  >
                    {t("CommonAlerts.CANCEL_BUTTON")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogoutForExistingAccount}
                  style={{
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "#DC2626",
                    }}
                  >
                    {t("Settings.LOGOUT_BUTTON")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

export default UpgradeAccountModal;
