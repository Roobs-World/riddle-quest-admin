import React from "react";
import { View, Text, Modal } from "react-native";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY } from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";
import { AppStrings } from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface SkipModalProps {
  isVisible: boolean;
  userCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
  onOpenShop: () => void;
  onClose: () => void;
}

const SkipModal: React.FC<SkipModalProps> = ({
  isVisible,
  userCoins,
  skipCost,
  onSkipLevel,
  onOpenShop,
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
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE}
            style={MODAL_CLOSE_BUTTON_POSITION}
          />
          <View
            style={{
              width: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: "black",
                marginBottom: SPACING.lg,
                textAlign: "center",
              }}
            >
              {AppStrings.GameScreenAlerts.SKIP_MODAL_TITLE}
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
              {AppStrings.GameScreenAlerts.COST_COINS_PREFIX}{skipCost}{AppStrings.GameScreenAlerts.COST_COINS_MIDDLE}{userCoins}{AppStrings.GameScreenAlerts.COST_COINS_SUFFIX}
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
                {AppStrings.GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE}
              </Text>
            )}
            <View style={{ width: "100%", marginTop: SPACING.lg }}>
              <WideButton
                buttonText={
                  canAffordSkip
                    ? AppStrings.GameScreenAlerts.SKIP_LEVEL_BUTTON
                    : AppStrings.Navigation.BUY_COINS_BUTTON
                }
                onPress={() => {
                  onClose();
                  if (canAffordSkip) {
                    onSkipLevel();
                  } else {
                    onOpenShop();
                  }
                }}
                disabled={false}
              />
              <View style={{ marginTop: SPACING.md }}>
                <WideButton
                  buttonText={AppStrings.CommonAlerts.CLOSE_BUTTON}
                  onPress={onClose}
                  disabled={false}
                />
              </View>
            </View>
          </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default SkipModal;

