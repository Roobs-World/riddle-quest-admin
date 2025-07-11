import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import { scale } from "src/utils/responsive";
import WideButton from "src/components/buttons/WideButton";

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
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseButton
              onPress={onClose}
              size={20}
              style={{
                position: "absolute",
                top: -100,
                right: -20,
                zIndex: 10,
              }}
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
              Skip the level?
            </Text>
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondary,
                fontSize: scale(18),
                color: "white",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Cost: {skipCost} Coins. You have: {userCoins} Coins.
            </Text>
            {!canAffordSkip && (
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: scale(16),
                  color: "#FF6B6B",
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                You do not have enough coins to skip a level.
              </Text>
            )}
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              <WideButton
                buttonText="SKIP LEVEL"
                onPress={onSkipLevel}
                disabled={!canAffordSkip}
              />

              <WideButton
                buttonText="CLOSE"
                onPress={onClose}
                disabled={false}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SkipModal;
