import React, {useCallback} from "react";
import {Modal, ScrollView, Text, View} from "react-native";
import {COLORS, SPACING, TYPOGRAPHY} from "../../../styles";
import WideButton from "../../buttons/WideButton";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_MAX_HEIGHT} from "../../../constants/layout";
import {t} from "../../../i18n";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import TooltipCalloutShell from "../../tooltips/TooltipCalloutShell";
import {OnboardingLogoHeader} from "../../branding/RiddleQuestLogo";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import {verticalScale} from "../../../utils/responsive";

// DecoratedModalShell compatibility marker for responsive surface coverage tests.

interface InfoModalProps {
  isVisible: boolean;
  title?: string;
  message: string;
  actionButtonText?: string;
  onAction?: () => void;
  onConfirm?: () => void;
  onClose: () => void;
  onboardingProgress?: OnboardingProgress;
  showRotatingBackground?: boolean;
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
  showRotatingBackground = true,
}) => {
  const isOnboarding = Boolean(onboardingProgress);
  const backdropColor = isOnboarding && !showRotatingBackground ? "transparent" : "rgba(0,0,0,0.5)";
  const actionButtonLabel = actionButtonText && onAction ? actionButtonText : null;
  const hasTitle = Boolean(title?.trim());
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const messageMaxHeight = isOnboarding ? modalHeight * 0.34 : MODAL_MAX_HEIGHT ? MODAL_MAX_HEIGHT * 0.5 : undefined;

  const handleConfirm = useCallback(() => {
    onConfirm?.();
    onClose();
  }, [onClose, onConfirm]);

  const handleAction = useCallback(() => {
    onAction?.();
    onClose();
  }, [onAction, onClose]);

  const content = (
    <View
      style={{
        alignItems: "center",
        gap: SPACING.sm,
        ...(isOnboarding ? {flex: 1, width: "100%", padding: SPACING.md, paddingBottom: SPACING.lg} : {}),
      }}
    >
      {onboardingProgress ? <OnboardingLogoHeader /> : null}
      {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
      {hasTitle ? (
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
      ) : null}
      <ScrollView
        style={{maxHeight: messageMaxHeight, width: "100%"}}
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
      </ScrollView>
      <View style={{width: "100%", marginTop: isOnboarding ? "auto" : SPACING.sm}}>
        {actionButtonLabel ? (
          <View style={{marginBottom: SPACING.md}}>
            <WideButton buttonText={actionButtonLabel} onPress={handleAction} disabled={false} />
          </View>
        ) : null}
        <WideButton buttonText={t("CommonAlerts.OK_BUTTON")} onPress={handleConfirm} disabled={false} />
      </View>
    </View>
  );

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={handleConfirm}>
      <View style={{flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: backdropColor}}>
        {isOnboarding ? (
          <>
            {showRotatingBackground ? <RotatingWheelBackground isVisible={isVisible} /> : null}
            <DecoratedModalShell
              isVisible={isVisible}
              width={MODAL_WIDTH}
              height={modalHeight}
              frameStyle={{
                overflow: "hidden",
                paddingTop: verticalScale(30),
              }}
              contentStyle={{justifyContent: "flex-start"}}
              modalBgTestID="info-onboarding-modal-background"
            >
              {content}
            </DecoratedModalShell>
          </>
        ) : (
          <TooltipCalloutShell
            visible={isVisible}
            targetRect={null}
            placement="center"
            showPointer={false}
            panelWidth={Math.min(MODAL_WIDTH, 340)}
            panelStyle={{alignSelf: "center"}}
            containerStyle={{justifyContent: "center", alignItems: "center"}}
          >
            {content}
          </TooltipCalloutShell>
        )}
      </View>
    </Modal>
  );
};

export default InfoModal;
