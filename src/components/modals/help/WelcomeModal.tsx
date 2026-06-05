import React, {useCallback, useEffect} from "react";
import {View, Text, Modal, Pressable} from "react-native";

import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import Logo from "../../../../assets/images/main-logo.svg";
import {TYPOGRAPHY} from "src/styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import {verticalScale} from "@/utils/responsive";
import SlideInModalContent from "../../shared/SlideInModalContent";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import {logger} from "@/utils/logger";

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
  /** Optional callback fired after the welcome modal is dismissed. */
  onDismiss?: () => void;
  onboardingProgress?: OnboardingProgress;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({isVisible, onClose, onDismiss, onboardingProgress}) => {
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const handleDismiss = useCallback(() => {
    onClose();
    onDismiss?.();
  }, [onClose, onDismiss]);

  useEffect(() => {
    if (!__DEV__ || !isVisible) {
      return;
    }

    logger.debug("[WelcomeModal QA] Scheduling dev auto-dismiss");
    const timer = setTimeout(() => {
      logger.debug("[WelcomeModal QA] Dev auto-dismiss firing");
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
          paddingTop: verticalScale(30),
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />

        {/* Modal card */}
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <Pressable onPress={handleDismiss} accessibilityRole="button" testID="welcome-modal-touch-target">
            <View
              style={{
                width: MODAL_WIDTH,
                height: modalHeight,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                marginBottom: modalHeight * 0.28,
                paddingTop: verticalScale(30),
              }}
            >
              {/* Card shape background */}
              <ModalBg width={MODAL_WIDTH} height={modalHeight} style={{position: "absolute"}} />

              {/* Decorative wave - clipped to card bounds */}
              <HomeBg
                width={MODAL_WIDTH * 1.1}
                height={modalHeight * 1.1}
                style={{position: "absolute", top: -modalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
              />
              {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}

              {/* Content */}
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: MODAL_CONTENT_PADDING,
                  paddingTop: MODAL_CONTENT_PADDING,
                }}
              >
                {/* Title */}
                <Logo width={"100%"} style={{position: "absolute", marginTop: SPACING.lg}} />
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontPrimary,
                    fontSize: TYPOGRAPHY.fontSize["2xl"],
                    color: "black",
                    textAlign: "center",
                    marginTop: verticalScale(80),
                  }}
                >
                  {t("WelcomeModal.WELCOME_TITLE")}
                </Text>

                {/* Body text */}
                <View
                  style={{
                    width: "80%",
                    position: "absolute",
                    marginTop: verticalScale(170),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "black",
                      textAlign: "center",
                      position: "absolute",
                      marginTop: verticalScale(80),
                    }}
                  >
                    {t("WelcomeModal.SOLVE_RIDDLES_TEXT")}
                  </Text>
                  <Text
                    style={{
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      fontSize: TYPOGRAPHY.fontSize.base,
                      color: "black",
                      textAlign: "center",
                    }}
                  >
                    {t("WelcomeModal.EARN_COINS_TEXT")}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
