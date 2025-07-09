import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { ModalButton } from "../ModalButton";
import { TYPOGRAPHY } from "src/styles";

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
            Skip the level?
          </Text>
          <Text
            className="text-md text-gray-700 mb-4"
            style={{
              fontFamily: TYPOGRAPHY.fontPrimary,
            }}
          >
            Cost: {skipCost} Coins. You have: {userCoins} Coins.
          </Text>
          {!canAffordSkip && (
            <Text
              className="text-red-500 mb-4"
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
              }}
            >
              You do not have enough coins to skip a level.
            </Text>
          )}
          <View className="flex-row mt-4">
            <ModalButton
              text="SKIP LEVEL"
              callback={onSkipLevel}
              isDisabled={!canAffordSkip}
            />

            <ModalButton text="CLOSE" callback={onClose} isDisabled={false} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SkipModal;
