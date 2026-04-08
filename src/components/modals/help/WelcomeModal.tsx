import React, { useEffect } from "react";
import { View, Text, Modal, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const WHEEL_SIZE = Math.ceil(Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H));

import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import { TYPOGRAPHY } from "src/styles";
import WideButton from "../../buttons/WideButton";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
} from "../../../constants/layout";
import { SPACING } from "../../../styles";

interface WelcomeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
  /** When false, "Start Tutorial" is not shown (e.g. no tutorial riddles available). Defaults to true when onStartTutorial is provided. */
  showStartTutorial?: boolean;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isVisible,
  onClose,
  onStartTutorial,
  showStartTutorial = true,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      rotation.value = withRepeat(
        withTiming(1, { duration: 12000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
    }
    return () => cancelAnimation(rotation);
  }, [isVisible, rotation]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  const handleStartTutorial = () => {
    onStartTutorial?.();
    onClose();
  };

  const canShowStartTutorial = Boolean(onStartTutorial && showStartTutorial);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
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
        {/* Rotating background wheel */}
        <Animated.View
          style={[
            { position: "absolute", width: WHEEL_SIZE, height: WHEEL_SIZE },
            wheelStyle,
          ]}
          pointerEvents="none"
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <WheelBg width={WHEEL_SIZE} height={WHEEL_SIZE} />
        </Animated.View>

        {/* Modal card */}
        <View
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            marginBottom: SCREEN_H * 0.15,
          }}
        >
          {/* Card shape background */}
          <ModalBg
            width={MODAL_WIDTH}
            height={MODAL_HEIGHT}
            style={{ position: "absolute" }}
          />

          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
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
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.title,
                color: "black",
                textAlign: "center",
                marginTop: SPACING.lg,
              }}
            >
              Welcome to{"\n"}Qwordly!
            </Text>

            {/* Body text */}
            <View style={{ width: "100%", gap: SPACING.md }}>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: "black",
                  textAlign: "center",
                }}
              >
                Solve engaging riddles by guessing the answer letter by letter.
                Use the colour clues to narrow down each guess.
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: "black",
                  textAlign: "center",
                }}
              >
                Earn coins, beat daily challenges, and climb the leaderboard.
              </Text>
            </View>

            {/* Buttons */}
            <View style={{ width: "100%", gap: MODAL_BUTTON_SPACER }}>
              {canShowStartTutorial ? (
                <>
                  <WideButton buttonText="Start Tutorial" onPress={handleStartTutorial} />
                  <WideButton
                    buttonText="Skip to Play"
                    onPress={onClose}
                    buttonColor="bg-gray-500"
                  />
                </>
              ) : (
                <WideButton
                  buttonText="Let's Play!"
                  onPress={onClose}
                  buttonColor={onStartTutorial ? "bg-gray-500" : undefined}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
