/**
 * @fileoverview HintModal component - Modal for purchasing gameplay hints in Qwordly.
 */

import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

interface HintModalProps {
  isVisible: boolean;
  userCoins: number;
  hintCost: number;
  onShowHint: () => void;
  onClose: () => void;
}

const HintModal: React.FC<HintModalProps> = ({
  isVisible,
  userCoins,
  hintCost,
  onShowHint,
  onClose,
}) => {
  const canAffordHint = userCoins >= hintCost;

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
              Use a Hint?
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
              Cost: {hintCost} Coins. You have: {userCoins} Coins.
            </Text>

            {!canAffordHint && (
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#FF6B6B",
                  marginBottom: SPACING.lg,
                  textAlign: "center",
                }}
              >
                You do not have enough coins for a hint.
              </Text>
            )}

            <View style={{ width: "100%", marginTop: SPACING.lg }}>
              <WideButton
                buttonText="SHOW HINT"
                onPress={() => { onClose(); onShowHint(); }}
                disabled={!canAffordHint}
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

export default HintModal;

