import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";
import { TYPOGRAPHY } from "src/styles";
import WideButton from "../../buttons/WideButton";

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isVisible, onClose }) => {
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
              width: "85%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{ position: "absolute", top: -80, right: -20, zIndex: 10 }}
            />
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: scale(28),
                color: "white",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Welcome to Qwordly!
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: scale(16),
                color: "white",
                marginBottom: 15,
                textAlign: "center",
              }}
            >
              Ready for an exciting riddle adventure? Solve engaging riddles by
              guessing the answer letter by letter. Each puzzle is a
              mini-mystery waiting to be solved!
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: scale(16),
                color: "white",
                marginBottom: 25,
                textAlign: "center",
              }}
            >
              Earn coins, unlock new levels, and challenge yourself daily.
              Let&apos;s get started!
            </Text>
            <WideButton buttonText="Let's Play!" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
