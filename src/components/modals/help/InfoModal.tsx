import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY, SPACING } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WideButton from "../../buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
} from "../../../constants/layout";

interface InfoModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({
  isVisible,
  title,
  message,
  onClose,
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
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
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={MODAL_CLOSE_BUTTON_POSITION}
            />
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
            <View style={{ width: "100%", marginTop: SPACING.lg }}>
              <WideButton buttonText="OK" onPress={onClose} disabled={false} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default InfoModal;

