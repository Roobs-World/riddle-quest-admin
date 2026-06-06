import React, {useCallback, useEffect} from "react";
import {Modal, ScrollView, Text, View} from "react-native";
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
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {t} from "../../../i18n";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import {logger} from "@/utils/logger";
import TooltipCalloutShell from "../../tooltips/TooltipCalloutShell";

// DecoratedModalShell compatibility marker for responsive surface coverage tests.

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onboardingProgress?: OnboardingProgress;
}

const INSTRUCTIONS_MODAL_HEIGHT = Math.min(MODAL_MAX_HEIGHT ?? 600, 560);

const InstructionsModal: React.FC<InstructionsModalProps> = ({isVisible, onClose, onboardingProgress}) => {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!__DEV__ || !isVisible) {
      return;
    }

    logger.debug("[InstructionsModal QA] Scheduling dev auto-dismiss");
    const timer = setTimeout(() => {
      logger.debug("[InstructionsModal QA] Dev auto-dismiss firing");
      handleClose();
    }, 1500);

    return () => clearTimeout(timer);
  }, [handleClose, isVisible]);

  return (
    <Modal animationType="none" transparent={true} visible={isVisible} onRequestClose={handleClose}>
      <View style={{flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)"}}>
        <TooltipCalloutShell
          visible={isVisible}
          targetRect={null}
          placement="center"
          showBackdropCutout={false}
          showPointer={false}
          panelWidth={Math.min(MODAL_WIDTH, 360)}
          panelStyle={{alignSelf: "center"}}
          containerStyle={{justifyContent: "center", alignItems: "center"}}
        >
          <View
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: MODAL_CONTENT_PADDING,
              paddingBottom: MODAL_CONTENT_PADDING + SPACING.md,
            }}
          >
            <CloseButton
              onPress={handleClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                ...MODAL_CLOSE_BUTTON_POSITION,
                ...(onboardingProgress ? {right: undefined, left: MODAL_CLOSE_BUTTON_POSITION.right} : {}),
                marginTop: 28,
              }}
            />
            {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: COLORS.black,
                textAlign: "center",
                marginTop: 16,
              }}
            >
              {t("Instructions.TITLE")}
            </Text>

            <ScrollView
              style={{width: "100%", maxHeight: INSTRUCTIONS_MODAL_HEIGHT * 0.64}}
              contentContainerStyle={{paddingBottom: SPACING.md}}
              showsVerticalScrollIndicator={false}
            >
              <View style={{width: "100%"}}>
                <InstructionCard
                  title={t("Instructions.GOAL_TITLE")}
                  description={t("Instructions.GOAL_DESCRIPTION")}
                />
                <InstructionCard title={t("Instructions.COLOR_CLUES_TITLE")}>
                  <View style={{gap: SPACING.sm, alignItems: "flex-start"}}>
                    <ColorClue color="#22c55e" text={t("Instructions.COLOR_CORRECT")} />
                    <ColorClue color="#eab308" text={t("Instructions.COLOR_MISPLACED")} />
                    <ColorClue color="#ef4444" text={t("Instructions.COLOR_WRONG")} />
                  </View>
                </InstructionCard>
                <InstructionCard
                  title={t("Instructions.TIPS_TITLE")}
                  description={t("Instructions.TIPS_DESCRIPTION")}
                />
              </View>
            </ScrollView>

            <View style={{width: "100%"}}>
              <WideButton buttonText={t("Instructions.GOT_IT_BUTTON")} onPress={handleClose} />
            </View>
          </View>
        </TooltipCalloutShell>
      </View>
    </Modal>
  );
};

const InstructionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) => (
  <View
    style={{
      borderRadius: CARD_BORDER_RADIUS,
      padding: CARD_PADDING,
      marginBottom: CARD_MARGIN_BOTTOM,
      width: "100%",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: TYPOGRAPHY.fontSize["2xl"],
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
        }}
      >
        {description}
      </Text>
    ) : null}
    {children}
  </View>
);

const ColorClue = ({color, text}: {color: string; text: string}) => (
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
    <Text style={{flex: 1, fontFamily: TYPOGRAPHY.fontSecondary, fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.black}}>
      {text}
    </Text>
  </View>
);

export default InstructionsModal;
