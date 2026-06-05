import React, {useCallback, useEffect} from "react";
import {View, Text, Modal} from "react-native";
import {TYPOGRAPHY, SPACING} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "../../buttons/WideButton";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import {logger} from "@/utils/logger";

interface InfoModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  actionButtonText?: string;
  onAction?: () => void;
  onConfirm?: () => void;
  onClose: () => void;
  onboardingProgress?: OnboardingProgress;
}

const InfoModal: React.FC<InfoModalProps> = ({
  isVisible,
  title,
  message,
  actionButtonText,
  onAction,
  onConfirm,
  onClose,
  onboardingProgress,
}) => {
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onClose();
  }, [onClose, onConfirm]);

  const handleAction = useCallback(() => {
    onAction?.();
    onClose();
  }, [onAction, onClose]);

  useEffect(() => {
    if (!__DEV__ || !isVisible) {
      return;
    }

    logger.debug("[InfoModal QA] Scheduling dev auto-dismiss");
    const timer = setTimeout(() => {
      logger.debug("[InfoModal QA] Dev auto-dismiss firing");
      handleConfirm();
    }, 1500);

    return () => clearTimeout(timer);
  }, [handleConfirm, isVisible]);

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={handleConfirm}>
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
              height: modalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={modalHeight} style={{position: "absolute"}} />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={modalHeight * 1.1}
              style={{position: "absolute", top: -modalHeight * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}

            <View
              style={{
                width: "80%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.title,
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  color: "black",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {message}
              </Text>
              <View style={{width: "100%", marginTop: SPACING.lg}}>
                {actionButtonText && onAction ? (
                  <View style={{marginBottom: SPACING.md}}>
                    <WideButton buttonText={actionButtonText} onPress={handleAction} disabled={false} />
                  </View>
                ) : null}
                <WideButton buttonText={t("CommonAlerts.OK_BUTTON")} onPress={handleConfirm} disabled={false} />
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default InfoModal;
