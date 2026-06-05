import React, {useCallback, useEffect} from "react";
import {View, Text, Modal} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "src/styles";
import {
  MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_CLOSE_BUTTON_POSITION, CARD_BORDER_RADIUS, CARD_PADDING, CARD_MARGIN_BOTTOM, COLOR_CLUE_INDICATOR_SIZE, COLOR_CLUE_BORDER_RADIUS, COLOR_CLUE_MARGIN_RIGHT, CLOSE_BUTTON_SIZE, MODAL_MAX_HEIGHT, } from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {verticalScale} from "@/utils/responsive";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";
import {logger} from "@/utils/logger";

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onboardingProgress?: OnboardingProgress;
}

const INSTRUCTIONS_MODAL_HEIGHT = Math.min(MODAL_HEIGHT * 1.5, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT * 1.5);

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
              height: INSTRUCTIONS_MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={INSTRUCTIONS_MODAL_HEIGHT}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />
            {/* Decorative wave - clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={INSTRUCTIONS_MODAL_HEIGHT * 1.05}
              style={{position: "absolute", top: -INSTRUCTIONS_MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            {onboardingProgress ? <OnboardingProgressBadge {...onboardingProgress} /> : null}
            <View
              style={{
                flex: 1,
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
                  marginTop: verticalScale(28),
                }}
              />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize.title,
                  color: "black",
                  textAlign: "center",
                  marginTop: verticalScale(16),
                }}
              >
                {t("Instructions.TITLE")}
              </Text>

              <View
                style={{
                  width: "100%",
                }}
              >
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

              <View style={{width: "100%"}}>
                <WideButton buttonText={t("Instructions.GOT_IT_BUTTON")} onPress={handleClose} />
              </View>
            </View>
          </View>
        </SlideInModalContent>
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
        color: "black",
        textAlign: "center",
      }}
    >
      {title}
    </Text>
    {description && (
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          color: "black",
          textAlign: "center",
        }}
      >
        {description}
      </Text>
    )}
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
    <Text
      style={{
        flex: 1,
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.sm,
        color: "black",
      }}
    >
      {text}
    </Text>
  </View>
);

export default InstructionsModal;
