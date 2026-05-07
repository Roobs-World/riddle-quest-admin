import React from "react";
import {View, Text, Modal} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {TYPOGRAPHY} from "src/styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  COLOR_CLUE_INDICATOR_SIZE,
  COLOR_CLUE_BORDER_RADIUS,
  COLOR_CLUE_MARGIN_RIGHT,
  CLOSE_BUTTON_SIZE,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {verticalScale} from "@/utils/responsive";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import OnboardingProgressBadge from "../OnboardingProgressBadge";
import {OnboardingProgress} from "../../../types/ModalTypes";

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onboardingProgress?: OnboardingProgress;
}

const INSTRUCTIONS_MODAL_HEIGHT = MODAL_HEIGHT * 1.5;

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isVisible,
  onClose,
  onboardingProgress,
}) => {
  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible}>
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
              height={MODAL_HEIGHT * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            {onboardingProgress ? (
              <OnboardingProgressBadge {...onboardingProgress} />
            ) : null}
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
                onPress={onClose}
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
                {AppStrings.Instructions.TITLE}
              </Text>

              <View
                style={{
                  width: "100%",
                }}
              >
                <InstructionCard
                  title={AppStrings.Instructions.GOAL_TITLE}
                  description={AppStrings.Instructions.GOAL_DESCRIPTION}
                />
                <InstructionCard title={AppStrings.Instructions.COLOR_CLUES_TITLE}>
                  <View style={{gap: SPACING.sm, alignItems: "flex-start"}}>
                    <ColorClue color="#22c55e" text={AppStrings.Instructions.COLOR_CORRECT} />
                    <ColorClue color="#eab308" text={AppStrings.Instructions.COLOR_MISPLACED} />
                    <ColorClue color="#ef4444" text={AppStrings.Instructions.COLOR_WRONG} />
                  </View>
                </InstructionCard>
                <InstructionCard
                  title={AppStrings.Instructions.TIPS_TITLE}
                  description={AppStrings.Instructions.TIPS_DESCRIPTION}
                />
              </View>

              <View style={{width: "100%"}}>
                <WideButton buttonText={AppStrings.Instructions.GOT_IT_BUTTON} onPress={onClose} />
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
