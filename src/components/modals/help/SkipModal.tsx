import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_INSET,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_TOP_OFFSET,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

interface SkipModalProps {
  isVisible: boolean;
  userCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
  onClose: () => void;
}

const SkipModal: React.FC<SkipModalProps> = ({
  isVisible,
  userCoins,
  skipCost,
  onSkipLevel,
  onClose,
}) => {
  const canAffordSkip = userCoins >= skipCost;
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
              style={{
                position: "absolute",
                top: MODAL_CLOSE_TOP_OFFSET,
                right: -CLOSE_BUTTON_INSET,
                zIndex: 10,
              }}
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
              Skip the level?
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
              Cost: {skipCost} Coins. You have: {userCoins} Coins.
            </Text>
            {!canAffordSkip && (
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#CC0000",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                You do not have enough coins to skip a level.
              </Text>
            )}
            <View style={{ width: "100%", marginTop: SPACING.lg }}>
              <WideButton
                buttonText="SKIP LEVEL"
                onPress={() => {
                  onClose();
                  onSkipLevel();
                }}
                disabled={!canAffordSkip}
              />
              <View style={{ marginTop: SPACING.md }}>
                <WideButton
                  buttonText="CLOSE"
                  onPress={onClose}
                  disabled={false}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SkipModal;
