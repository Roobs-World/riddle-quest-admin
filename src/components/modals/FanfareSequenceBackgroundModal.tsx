import React from "react";
import {Modal, View} from "react-native";
import RotatingWheelBackground from "../shared/RotatingWheelBackground";

interface FanfareSequenceBackgroundModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const FanfareSequenceBackgroundModal: React.FC<FanfareSequenceBackgroundModalProps> = ({
  isVisible,
  onClose,
}) => {
  return (
    <Modal transparent animationType="none" visible={isVisible} onRequestClose={onClose}>
      <View
        pointerEvents="none"
        testID="fanfare-sequence-background"
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <RotatingWheelBackground isVisible={isVisible} />
      </View>
    </Modal>
  );
};

export default FanfareSequenceBackgroundModal;
