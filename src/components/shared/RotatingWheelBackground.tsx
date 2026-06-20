import React, {useEffect} from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import WheelBg from "../../../assets/images/wheel-bg.svg";
import {dimensions} from "../../utils/responsive";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";

interface RotatingWheelBackgroundProps {
  isVisible: boolean;
  durationMs?: number;
  opacity?: number;
}

const {screenWidth: SCREEN_W, screenHeight: SCREEN_H} = dimensions;
const WHEEL_SIZE = Math.ceil(Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H));
const ROTATION_EPOCH_MS = Date.now();

const RotatingWheelBackground: React.FC<RotatingWheelBackgroundProps> = ({
  isVisible,
  durationMs = 12000,
  opacity = 1,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible && !isQASurfaceRuntimeActive()) {
      const elapsedMs = (Date.now() - ROTATION_EPOCH_MS) % durationMs;
      const initialRotation = elapsedMs / durationMs;
      const remainingDurationMs = Math.max(1, durationMs - elapsedMs);
      rotation.value = initialRotation;
      rotation.value = withSequence(
        withTiming(1, {
          duration: remainingDurationMs,
          easing: Easing.linear,
        }),
        withTiming(0, {
          duration: 0,
          easing: Easing.linear,
        }),
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: durationMs,
              easing: Easing.linear,
            }),
            withTiming(0, {
              duration: 0,
              easing: Easing.linear,
            }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [durationMs, isVisible, rotation]);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value * 360}deg`}],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          opacity,
        },
        wheelStyle,
      ]}
      pointerEvents="none"
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
    >
      <WheelBg width={WHEEL_SIZE} height={WHEEL_SIZE} />
    </Animated.View>
  );
};

export default RotatingWheelBackground;
