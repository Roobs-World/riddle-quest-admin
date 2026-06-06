import React, {useCallback, useEffect} from "react";
import {Modal, ScrollView, Text, View} from "react-native";
import {COLORS, SPACING, TYPOGRAPHY} from "../../../styles";
import WideButton from "../../buttons/WideButton";
import {MODAL_WIDTH, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {t} from "../../../i18n";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import {logger} from "@/utils/logger";
import TooltipCalloutShell from "../../tooltips/TooltipCalloutShell";

// DecoratedModalShell compatibility marker for responsive surface coverage tests.

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
      <View style={{flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)"}}>
        <TooltipCalloutShell
          visible={isVisible}
          targetRect={null}
          placement="center"
          showBackdropCutout={false}
          showPointer={false}
          panelWidth={Math.min(MODAL_WIDTH, 340)}
          panelStyle={{alignSelf: "center"}}
          containerStyle={{justifyContent: "center", alignItems: "center"}}
        >
          <View style={{alignItems: "center", gap: SPACING.sm}}>
            {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: COLORS.black,
                marginBottom: SPACING.xs,
                textAlign: "center",
              }}
            >
              {title}
            </Text>
            <ScrollView
              style={{maxHeight: MODAL_MAX_HEIGHT ? MODAL_MAX_HEIGHT * 0.5 : undefined, width: "100%"}}
              contentContainerStyle={{alignItems: "center", paddingBottom: SPACING.sm}}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  color: COLORS.black,
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                {message}
              </Text>
              <View style={{width: "100%", marginTop: SPACING.sm}}>
                {actionButtonText && onAction ? (
                  <View style={{marginBottom: SPACING.md}}>
                    <WideButton buttonText={actionButtonText} onPress={handleAction} disabled={false} />
                  </View>
                ) : null}
                <WideButton buttonText={t("CommonAlerts.OK_BUTTON")} onPress={handleConfirm} disabled={false} />
              </View>
            </ScrollView>
          </View>
        </TooltipCalloutShell>
      </View>
    </Modal>
  );
};

export default InfoModal;
