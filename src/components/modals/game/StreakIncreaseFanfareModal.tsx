import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Modal, Animated, Easing } from "react-native";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import WheelBg from "../../../../assets/images/wheel-bg.svg";
import WideButton from "../../buttons/WideButton";
import { TYPOGRAPHY } from "../../../styles";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  MODAL_CONTENT_PADDING,
  MODAL_BUTTON_SPACER,
  wheelSize,
} from "../../../constants/layout";
import { AppStrings } from "../../../constants/AppStrings";

interface StreakIncreaseFanfareModalProps {
  isVisible: boolean;
  streakValue: number;
  onClose: () => void;
}

const StreakIncreaseFanfareModal: React.FC<StreakIncreaseFanfareModalProps> = ({
  isVisible,
  streakValue,
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
        })
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
      >
        <View
          style={{
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg
            width={MODAL_WIDTH}
            height={MODAL_HEIGHT}
            style={{ position: "absolute" }}
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
                transform: [{ rotate: spin }],
              }}
            >
              <WheelBg width={wheelSize} height={wheelSize} />
            </Animated.View>
          </View>

          <View
            style={{
              flex: 1,
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              gap: MODAL_BUTTON_SPACER * 2,
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
              {AppStrings.StreakFanfare.TITLE}
            </Text>

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontSecondaryBold,
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                color: "black",
                textAlign: "center",
              }}
            >
              {`${streakValue}${AppStrings.StreakFanfare.STREAK_SUFFIX}`}
            </Text>

            <View style={{ width: "100%", marginTop: 8 }}>
              <WideButton
                buttonText={AppStrings.StreakFanfare.CONTINUE_BUTTON}
                onPress={onClose}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default StreakIncreaseFanfareModal;
