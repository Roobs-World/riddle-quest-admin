import React, {useCallback, useEffect} from "react";
import {Image, Modal, Pressable, Text, View} from "react-native";
import {t} from "../../../i18n";
import {TYPOGRAPHY, SPACING} from "../../../styles";
import {AVATAR_SIZE_LARGE, MODAL_CONTENT_PADDING, MODAL_WIDTH, MODAL_HEIGHT, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {moderateScale, verticalScale} from "../../../utils/responsive";
import RotatingWheelBackground from "@/components/shared/RotatingWheelBackground";
import {useAuth} from "@/contexts/AuthContext";
import {logger} from "@/utils/logger";
import DecoratedModalShell from "../../shared/DecoratedModalShell";

interface WelcomeBackModalProps {
  isVisible: boolean;
  onClose: () => void;
  username: string;
  onDismiss?: () => void;
}

const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({isVisible, onClose, username, onDismiss}) => {
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const {playerData} = useAuth();
  const avatarUrl = playerData?.avatarUrl ?? null;
  const avatarRadius = AVATAR_SIZE_LARGE / 2;
  const initial = (username || t("Profile.GUEST_USERNAME")).charAt(0).toUpperCase();

  const handleDismiss = useCallback(() => {
    onClose();
    onDismiss?.();
  }, [onClose, onDismiss]);

  useEffect(() => {
    if (!__DEV__ || !isVisible) {
      return;
    }

    logger.debug("[WelcomeBackModal QA] Scheduling dev auto-dismiss");
    const timer = setTimeout(() => {
      logger.debug("[WelcomeBackModal QA] Dev auto-dismiss firing");
      handleDismiss();
    }, 1500);

    return () => clearTimeout(timer);
  }, [handleDismiss, isVisible]);

  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={handleDismiss}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />
        <DecoratedModalShell isVisible={isVisible} width={MODAL_WIDTH} height={modalHeight}>
          <Pressable onPress={handleDismiss} accessibilityRole="button" testID="welcome-back-modal-touch-target" style={{width: "100%", height: "100%"}}>
            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                padding: MODAL_CONTENT_PADDING,
              }}
            >
              {avatarUrl ? (
                <Image
                  key={avatarUrl}
                  testID="welcome-back-avatar-image"
                  source={{uri: avatarUrl}}
                  style={{
                    width: AVATAR_SIZE_LARGE * 2,
                    height: AVATAR_SIZE_LARGE * 2,
                    borderRadius: avatarRadius,
                    borderWidth: moderateScale(3),
                    borderColor: "#FFFFFF",
                    marginBottom: verticalScale(12),
                  }}
                />
              ) : (
                <View
                  style={{
                    width: AVATAR_SIZE_LARGE,
                    height: AVATAR_SIZE_LARGE,
                    borderRadius: avatarRadius,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: moderateScale(3),
                    borderColor: "#FFFFFF",
                    marginBottom: verticalScale(12),
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: TYPOGRAPHY.fontSize.display,
                      fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    }}
                  >
                    {initial}
                  </Text>
                </View>
              )}

              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  color: "black",
                  textAlign: "center",
                }}
              >
                {t("WelcomeBackModal.TITLE")}
              </Text>
              <Text
                style={{
                  marginTop: SPACING.md,
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "black",
                  textAlign: "center",
                }}
              >
                {username || t("Profile.GUEST_USERNAME")}
              </Text>
              <Text
                style={{
                  marginTop: verticalScale(12),
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "black",
                  textAlign: "center",
                }}
              >
                {t("WelcomeBackModal.TAP_TO_CONTINUE")}
              </Text>
            </View>
          </Pressable>
        </DecoratedModalShell>
      </View>
    </Modal>
  );
};

export default WelcomeBackModal;
