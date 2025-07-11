import React from "react";
import { View, Text, Modal, ScrollView } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import WideButton from "../../buttons/WideButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";
import { TYPOGRAPHY } from "src/styles";

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
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            width: 335,
            height: 423,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg style={{ position: "absolute" }} />
          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 20,
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(28),
                color: "white",
                textAlign: "center",
              }}
            >
              How to Play
            </Text>

            <ScrollView
              style={{ flex: 1, width: "100%", maxHeight: 280, marginTop: 10 }}
              contentContainerStyle={{
                alignItems: "center",
              }}
            >
              <InstructionCard
                title="The Goal"
                description="Guess the hidden riddle in 3 tries using the color clues to guide you."
              />
              <InstructionCard title="Color Clues">
                <View style={{ gap: 12, alignItems: "flex-start" }}>
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
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      width: "100%",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        fontSize: scale(18),
        color: "white",
        textAlign: "center",
        marginBottom: 8,
      }}
    >
      {title}
    </Text>
    {description && (
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondary,
          fontSize: scale(14),
          color: "white",
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
        width: 24,
        height: 24,
        backgroundColor: color,
        borderRadius: 4,
        marginRight: 12,
      }}
    />
    <Text
      style={{
        flex: 1,
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: scale(14),
        color: "white",
      }}
    >
      {text}
    </Text>
  </View>
);

export default InstructionsModal;
