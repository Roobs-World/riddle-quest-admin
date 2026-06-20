import React, {useCallback} from "react";
import {Modal, Pressable, ScrollView, Text, View} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import {COLORS, TYPOGRAPHY} from "src/styles";
import {
  MODAL_WIDTH,
  MODAL_CONTENT_PADDING,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  COLOR_CLUE_INDICATOR_SIZE,
  COLOR_CLUE_BORDER_RADIUS,
  COLOR_CLUE_MARGIN_RIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_HEIGHT,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import TooltipCalloutShell from "../../tooltips/TooltipCalloutShell";
import {OnboardingLogoHeader} from "../../branding/RiddleQuestLogo";
import RotatingWheelBackground from "../../shared/RotatingWheelBackground";
import DecoratedModalShell from "../../shared/DecoratedModalShell";
import {verticalScale} from "../../../utils/responsive";

// DecoratedModalShell compatibility marker for responsive surface coverage tests.

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onboardingProgress?: OnboardingProgress;
  showRotatingBackground?: boolean;
}

const INSTRUCTIONS_MODAL_HEIGHT = Math.min(MODAL_MAX_HEIGHT ?? 600, 560);

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isVisible,
  onClose,
  onDismiss,
  onboardingProgress,
  showRotatingBackground = true,
}) => {
  const handleClose = useCallback(() => {
    onClose();
    onDismiss?.();
  }, [onClose, onDismiss]);
  const isOnboarding = Boolean(onboardingProgress);
  const backdropColor = isOnboarding && !showRotatingBackground ? "transparent" : "rgba(0,0,0,0.5)";
  const modalHeight = isOnboarding
    ? INSTRUCTIONS_MODAL_HEIGHT
    : Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const scrollMaxHeight = INSTRUCTIONS_MODAL_HEIGHT * 0.64;
  const instructionContent = (
    <View
      style={{
        width: "100%",
        ...(isOnboarding ? {gap: SPACING.xs, paddingTop: SPACING.xs} : {}),
      }}
    >
      <InstructionCard
        title={t("Instructions.GOAL_TITLE")}
        description={t("Instructions.GOAL_DESCRIPTION")}
        compact={isOnboarding}
      />
      <InstructionCard title={t("Instructions.COLOR_CLUES_TITLE")} compact={isOnboarding}>
        <View style={{gap: SPACING.sm, alignItems: "flex-start"}}>
          <ColorClue color="#22c55e" text={t("Instructions.COLOR_CORRECT")} compact={isOnboarding} />
          <ColorClue color="#eab308" text={t("Instructions.COLOR_MISPLACED")} compact={isOnboarding} />
          <ColorClue color="#ef4444" text={t("Instructions.COLOR_WRONG")} compact={isOnboarding} />
        </View>
      </InstructionCard>
      <InstructionCard
        title={t("Instructions.TIPS_TITLE")}
        description={t("Instructions.TIPS_DESCRIPTION")}
        compact={isOnboarding}
      />
    </View>
  );

  const content = (
    <View
      style={{
        width: "100%",
        ...(isOnboarding ? {flex: 1} : {}),
        alignItems: "center",
        justifyContent: isOnboarding ? "flex-start" : "space-between",
        padding: MODAL_CONTENT_PADDING,
        paddingBottom: isOnboarding ? MODAL_CONTENT_PADDING : MODAL_CONTENT_PADDING + SPACING.md,
      }}
    >
      {!isOnboarding ? (
        <CloseButton
          onPress={handleClose}
          size={CLOSE_BUTTON_SIZE}
          style={{
            ...MODAL_CLOSE_BUTTON_POSITION,
            marginTop: 28,
          }}
        />
      ) : null}
      {onboardingProgress ? <OnboardingLogoHeader /> : null}
      {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
      {isOnboarding ? (
        instructionContent
      ) : (
        <ScrollView
          style={{width: "100%", maxHeight: scrollMaxHeight}}
          contentContainerStyle={{paddingBottom: SPACING.md}}
          showsVerticalScrollIndicator={false}
        >
          {instructionContent}
        </ScrollView>
      )}

      {!isOnboarding ? (
        <View style={{width: "100%"}}>
          <WideButton buttonText={t("Instructions.GOT_IT_BUTTON")} onPress={handleClose} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={handleClose}>
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
              modalBgTestID="instructions-onboarding-modal-background"
            >
              <Pressable
                accessibilityLabel={t("WelcomeBackModal.TAP_TO_CONTINUE")}
                accessibilityRole="button"
                onPress={handleClose}
                style={{width: "100%", height: "100%"}}
                testID="instructions-onboarding-touch-target"
              >
                {content}
              </Pressable>
            </DecoratedModalShell>
          </>
        ) : (
          <TooltipCalloutShell
            visible={isVisible}
            targetRect={null}
            placement="center"
            showPointer={false}
            panelWidth={Math.min(MODAL_WIDTH, 360)}
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

const InstructionCard = ({
  title,
  description,
  children,
  compact = false,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) => (
  <View
    style={{
      borderRadius: CARD_BORDER_RADIUS,
      padding: compact ? SPACING.sm : CARD_PADDING,
      marginBottom: compact ? 0 : CARD_MARGIN_BOTTOM,
      width: "100%",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: compact ? TYPOGRAPHY.fontSize.xl : TYPOGRAPHY.fontSize["2xl"],
        color: COLORS.black,
        textAlign: "center",
      }}
    >
      {title}
    </Text>
    {description ? (
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          color: COLORS.black,
          textAlign: "center",
          lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.snug,
        }}
      >
        {description}
      </Text>
    ) : null}
    {children}
  </View>
);

const ColorClue = ({color, text, compact = false}: {color: string; text: string; compact?: boolean}) => (
  <View style={{flexDirection: "row", alignItems: "center"}}>
    <View
      style={{
        width: COLOR_CLUE_INDICATOR_SIZE,
        height: COLOR_CLUE_INDICATOR_SIZE,
        backgroundColor: color,
        borderRadius: COLOR_CLUE_BORDER_RADIUS,
        marginRight: COLOR_CLUE_MARGIN_RIGHT,
      }}
    />
    <Text
      style={{
        flex: 1,
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.sm,
        color: COLORS.black,
        lineHeight: TYPOGRAPHY.fontSize.sm * (compact ? TYPOGRAPHY.lineHeight.snug : TYPOGRAPHY.lineHeight.normal),
      }}
    >
      {text}
    </Text>
  </View>
);

export default InstructionsModal;
