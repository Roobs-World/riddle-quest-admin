import React from "react";
import { View, Text, Modal, ScrollView } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { TYPOGRAPHY } from "src/styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_SCROLLABLE_MAX_HEIGHT,
  CLOSE_BUTTON_INSET,
  CARD_BORDER_RADIUS,
  CARD_PADDING,
  CARD_MARGIN_BOTTOM,
  COLOR_CLUE_INDICATOR_SIZE,
  COLOR_CLUE_BORDER_RADIUS,
  COLOR_CLUE_MARGIN_RIGHT,
  CLOSE_BUTTON_SIZE,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

interface InstructionsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: MODAL_CONTENT_PADDING,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                top: CLOSE_BUTTON_INSET,
                right: CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: "black",
                textAlign: "center",
              }}
            >
              How to Play
            </Text>

            <ScrollView
              style={{
                flex: 1,
                width: "100%",
                maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT,
                marginTop: SPACING.sm,
              }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              <InstructionCard
                title="The Goal"
                description="Guess the hidden riddle in 3 tries using the color clues to guide you."
              />
              <InstructionCard title="Color Clues">
                <View style={{ gap: SPACING.sm, alignItems: "flex-start" }}>
                  <ColorClue
                    color="#22c55e"
                    text="Letter is correct and in the right position"
                  />
                  <ColorClue
                    color="#eab308"
                    text="Letter is in the word but wrong position"
                  />
                  <ColorClue
                    color="#ef4444"
                    text="Letter is not in the word at all"
                  />
                </View>
              </InstructionCard>
              <InstructionCard
                title="Tips for Success"
                description="Start with common letters and use the color feedback to narrow down your guesses. Remember, you only have 3 attempts!"
              />
            </ScrollView>

            <WideButton buttonText="Got It!" onPress={onClose} />
          </View>
        </View>
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
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: CARD_BORDER_RADIUS,
      padding: CARD_PADDING,
      marginBottom: CARD_MARGIN_BOTTOM,
      width: "100%",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: TYPOGRAPHY.fontSize.lg,
        color: "black",
        textAlign: "center",
        marginBottom: SPACING.sm,
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

const ColorClue = ({ color, text }: { color: string; text: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
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
