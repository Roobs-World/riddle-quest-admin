import React, {useCallback} from "react";
import {View, Text, Modal, Pressable} from "react-native";
import {TYPOGRAPHY} from "src/styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {t} from "../../../i18n";
import {verticalScale} from "@/utils/responsive";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import {OnboardingLogoHeader} from "../../branding/RiddleQuestLogo";

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
  /** Optional callback fired after the welcome modal is dismissed. */
  onDismiss?: () => void;
  onboardingProgress?: OnboardingProgress;
  showRotatingBackground?: boolean;
}

const WELCOME_COPY_TOP_OFFSET = verticalScale(132);

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isVisible,
  onClose,
  onDismiss,
  onboardingProgress,
  showRotatingBackground = true,
}) => {
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const handleDismiss = useCallback(() => {
    onClose();
    onDismiss?.();
  }, [onClose, onDismiss]);

  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={handleDismiss}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: showRotatingBackground ? "rgba(0,0,0,0.5)" : "transparent",
          paddingTop: verticalScale(30),
        }}
      >
        {showRotatingBackground ? <RotatingWheelBackground isVisible={isVisible} /> : null}

        <DecoratedModalShell
          isVisible={isVisible}
          width={MODAL_WIDTH}
          height={modalHeight}
          frameStyle={{
            overflow: "hidden",
            marginBottom: modalHeight * 0.28,
            paddingTop: verticalScale(30),
          }}
        >
          <Pressable onPress={handleDismiss} accessibilityRole="button" testID="welcome-modal-touch-target" style={{width: "100%", height: "100%"}}>
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
              <OnboardingLogoHeader />

              <View
                testID="welcome-modal-copy-block"
                style={{
                  width: "80%",
                  position: "absolute",
                  marginTop: WELCOME_COPY_TOP_OFFSET,
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
              {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
            </View>
          </Pressable>
        </DecoratedModalShell>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
