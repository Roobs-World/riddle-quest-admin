import React, {useEffect, useMemo, useState} from "react";
import {View, Text, Modal, Animated, Easing} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY} from "src/styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WideButton from "src/components/buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
  MODAL_CONTENT_PADDING,
  wheelSize,
  COIN_ICON_SIZE_LARGE,
} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {verticalScale} from "@/utils/responsive";
import SegmentBgSvg from "../../../../assets/images/segment-bg.svg";
import ChestSvg from "../../../../assets/images/chest.svg";
import CoinSvg from "../../../../assets/images/coin.svg";
import {NewCoins} from "@/components/shared/NewCoins";

interface SkipModalProps {
  isVisible: boolean;
  userCoins: number;
  totalCoins: number;
  skipCost: number;
  onSkipLevel: () => void;
  onOpenShop: () => void;
  onClose: () => void;
}

const SkipModal: React.FC<SkipModalProps> = ({
  isVisible,
  userCoins,
  totalCoins,
  skipCost,
  onSkipLevel,
  onOpenShop,
  onClose,
}) => {
  const canAffordSkip = userCoins >= skipCost;

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: !canAffordSkip ? MODAL_HEIGHT * 1.6 : MODAL_HEIGHT * 1.4,
              alignItems: "center",
              paddingTop: verticalScale(36),
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={!canAffordSkip ? MODAL_HEIGHT * 1.6 : MODAL_HEIGHT * 1.4}
              style={{position: "absolute"}}
              preserveAspectRatio="none"
            />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(24)}}
            />
            <View
              style={{
                width: "80%",
                alignItems: "center",
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

              <NewCoins coinsEarned={-skipCost} totalCoins={totalCoins} />

              {!canAffordSkip && (
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    marginBottom: SPACING.lg,
                    marginTop: SPACING.lg,
                    textAlign: "center",
                  }}
                >
                  {AppStrings.GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE}
                </Text>
              )}
              <View style={{width: "100%", marginTop: SPACING.md}}>
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
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default SkipModal;
