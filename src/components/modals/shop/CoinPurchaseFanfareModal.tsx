import React, {useMemo, useState, useEffect} from "react";
import {View, Text, Modal, Animated, Easing} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import {TYPOGRAPHY} from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  wheelSize,
} from "../../../constants/layout";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {NewCoins} from "@/components/shared/NewCoins";

interface CoinPurchaseFanfareModalProps {
  isVisible: boolean;
  coinsPurchased: number;
  totalCoins: number;
  onClose: () => void;
}

const CoinPurchaseFanfareModal: React.FC<CoinPurchaseFanfareModalProps> = ({
  isVisible,
  coinsPurchased,
  totalCoins,
  onClose,
}) => {
  const modalHeight = MODAL_HEIGHT * 1.2;
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

  return (
    <Modal transparent animationType="fade" visible={isVisible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        onTouchEnd={onClose}
      >
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModalBg
              width={MODAL_WIDTH}
              height={modalHeight}
              preserveAspectRatio="none"
              style={{position: "absolute"}}
            />

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: modalHeight,
              }}
            >
              <MaskedView
                style={{
                  width: MODAL_WIDTH,
                  height: modalHeight,
                }}
                maskElement={
                  <View
                    style={{
                      width: MODAL_WIDTH,
                      height: modalHeight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ModalBg width={MODAL_WIDTH} height={modalHeight} preserveAspectRatio="none" />
                  </View>
                }
              >
                <View
                  style={{
                    width: MODAL_WIDTH,
                    height: modalHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Animated.View
                    style={{
                      position: "absolute",
                      opacity: 0.25,
                      transform: [{rotate: spin}],
                    }}
                  >
                    <WheelBg width={wheelSize} height={wheelSize} />
                  </Animated.View>
                </View>
              </MaskedView>
            </View>

            <View
              style={{
                position: "absolute",
                width: MODAL_WIDTH,
                height: modalHeight,
                alignItems: "center",
                justifyContent: "center",
                gap: MODAL_BUTTON_SPACER,
                padding: MODAL_CONTENT_PADDING,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  color: "black",
                  textAlign: "center",
                }}
              >
                {AppStrings.CoinPurchase.TITLE}
              </Text>

              <NewCoins coinsEarned={coinsPurchased} totalCoins={totalCoins} />
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default CoinPurchaseFanfareModal;
