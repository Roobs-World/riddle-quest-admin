import React, {useEffect} from "react";
import {View, Text, Modal, Dimensions} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get("window");
const WHEEL_SIZE = Math.ceil(Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H));

import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import Logo from "../../../../assets/images/main-logo.svg";
import {TYPOGRAPHY} from "src/styles";
import {MODAL_WIDTH, MODAL_HEIGHT, MODAL_CONTENT_PADDING, MODAL_BUTTON_SPACER} from "../../../constants/layout";
import {SPACING} from "../../../styles";
import {AppStrings, getAppLanguage} from "../../../constants/AppStrings";
import {verticalScale} from "@/utils/responsive";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
  /** Optional callback fired after the welcome modal is dismissed. */
  onDismiss?: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({isVisible, onClose, onDismiss}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      rotation.value = withRepeat(withTiming(1, {duration: 12000, easing: Easing.linear}), -1, false);
    } else {
      cancelAnimation(rotation);
    }
    return () => cancelAnimation(rotation);
  }, [isVisible, rotation]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value * 360}deg`}],
  }));

  const handleDismiss = () => {
    onClose();
    onDismiss?.();
  };

  const letsPlayText =
    getAppLanguage() === "en" ? AppStrings.WelcomeModal.LETS_PLAY : AppStrings.Navigation.PLAY_BUTTON;

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={handleDismiss}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          paddingTop: verticalScale(30),
        }}
      >
        {/* Rotating background wheel */}
        <Animated.View
          style={[{position: "absolute", width: WHEEL_SIZE, height: WHEEL_SIZE}, wheelStyle]}
          pointerEvents="none"
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <WheelBg width={WHEEL_SIZE} height={WHEEL_SIZE} />
        </Animated.View>

        {/* Modal card */}
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: SCREEN_H * 0.15,
              paddingTop: verticalScale(30),
            }}
          >
            {/* Card shape background */}
            <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{position: "absolute"}} />

            {/* Decorative wave - clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={MODAL_HEIGHT * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />

            {/* Content */}
            <View
              style={{
                flex: 1,
                width: "100%",
                alignItems: "center",
                justifyContent: "space-between",
                padding: MODAL_CONTENT_PADDING,
                paddingTop: MODAL_CONTENT_PADDING,
              }}
            >
              {/* Title */}
              <Logo width={"100%"} style={{position: "absolute", marginTop: SPACING.lg}} />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "black",
                  textAlign: "center",
                  marginTop: verticalScale(80),
                }}
              >
                {AppStrings.WelcomeModal.WELCOME_TITLE}
              </Text>

              {/* Body text */}
              <View
                style={{
                  width: "80%",
                  position: "absolute",
                  marginTop: verticalScale(170),
                }}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    textAlign: "center",
                    position: "absolute",
                    marginTop: verticalScale(80),
                  }}
                >
                  {AppStrings.WelcomeModal.SOLVE_RIDDLES_TEXT}
                </Text>
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "black",
                    textAlign: "center",
                  }}
                >
                  {AppStrings.WelcomeModal.EARN_COINS_TEXT}
                </Text>
              </View>
            </View>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
