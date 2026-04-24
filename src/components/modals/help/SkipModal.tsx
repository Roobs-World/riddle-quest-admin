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
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import CoinSvg from "../../../../assets/images/coin.svg";

interface SkipModalProps {
  isVisible: boolean;
  userCoins: number;
  totalCoins?: number;
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
  const [rotationAnim] = useState(() => new Animated.Value(0));

  const spin = useMemo(() => {
    return rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  }, [rotationAnim]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isVisible) {
      rotationAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animation.start();
    }

    return () => {
      animation?.stop();
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    };
  }, [isVisible, rotationAnim]);

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
              height: MODAL_HEIGHT,
              alignItems: "center",
              paddingTop: verticalScale(36),
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={MODAL_HEIGHT * 1.2}
              style={{position: "absolute"}}
              preserveAspectRatio="none"
            />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: MODAL_HEIGHT,
                overflow: "hidden",
                borderRadius: 30,
              }}
            >
              <Animated.View
                style={{
                  position: "absolute",
                  left: (MODAL_WIDTH - wheelSize) / 2,
                  top: (MODAL_HEIGHT - wheelSize) / 2,
                  opacity: 0.25,
                  transform: [{rotate: spin}],
                }}
              >
                <WheelBg width={wheelSize} height={wheelSize} />
              </Animated.View>
            </View>
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
              <CoinSvg
                width={COIN_ICON_SIZE_LARGE * 1.5}
                height={COIN_ICON_SIZE_LARGE * 1.5}
                style={{marginBottom: verticalScale(24), marginTop: verticalScale(12)}}
              />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  color: "#FB9A2B",
                  textAlign: "center",
                }}
              >
                {AppStrings.GameScreenAlerts.COST_COINS_PREFIX}
                {skipCost + "\n\n"}
              </Text>
              <View
                style={{
                  width: "100%",
                  marginBottom: 20,
                  alignItems: "center",
                  marginTop: verticalScale(-50)
                }}
              >
                <View style={{width: "100%"}}>
                  <SegmentBgSvg width={MODAL_WIDTH - MODAL_CONTENT_PADDING * 2} height={86} />
                </View>
                <View
                  style={{
                    position: "absolute",
                    left: 22,
                    top: 9,
                  }}
                >
                  <ChestSvg width={62} height={62} />
                </View>

                <Text
                  style={{
                    position: "absolute",
                    left: 175,
                    top: 15,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "#7D7E84",
                  }}
                >
                  {AppStrings.VictoryModal.TOTAL_COINS_LABEL}
                </Text>
                <Text
                  style={{
                    position: "absolute",
                    left: 175,
                    top: 35,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    fontSize: TYPOGRAPHY.fontSize["3xl"],
                    color: "#000000",
                  }}
                >
                  {typeof totalCoins === "number" ? totalCoins : userCoins}
                </Text>
              </View>

              
              
              {!canAffordSkip && (
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    marginBottom: SPACING.lg,
                    textAlign: "center",
                  }}
                >
                  {AppStrings.GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE}
                </Text>
              )}
              <View style={{width: "100%", marginTop: SPACING.sm}}>
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
