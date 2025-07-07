import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { ModalButton } from "../ModalButton";
import { TYPOGRAPHY } from "src/styles";

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
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-input-background p-6 rounded-3xl items-center relative">
          {/* Close Button in top-right corner */}
          <View className="absolute top-2 right-2 z-10">
            <CloseButton onPress={onClose} size={20} />
          </View>

          <Text
            className="text-gray-800 mb-4"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
              fontSize: 24,
            }}
          >
            Use a Hint?
          </Text>
          <Text
            className="text-md text-gray-700 mb-4"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
            }}
          >
            Cost: {hintCost} Coins. You have: {userCoins} Coins.
          </Text>
          {!canAffordHint && (
            <Text
              className="text-red-500 mb-4"
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
              }}
            >
              You do not have enough coins for a hint.
            </Text>
          )}
          <View className="flex-row mt-4">
            <ModalButton
              text="SHOW HINT"
              callback={onShowHint}
              isDisabled={!canAffordHint}
            />

            <ModalButton text="CLOSE" callback={onClose} isDisabled={false} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default HintModal;
