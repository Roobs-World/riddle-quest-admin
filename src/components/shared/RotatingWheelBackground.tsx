import React, {useEffect} from "react";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import WheelBg from "../../../assets/images/wheel-bg.svg";
import {dimensions} from "../../utils/responsive";

interface RotatingWheelBackgroundProps {
  isVisible: boolean;
  durationMs?: number;
  opacity?: number;
}

const {screenWidth: SCREEN_W, screenHeight: SCREEN_H} = dimensions;
const WHEEL_SIZE = Math.ceil(Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H));

const RotatingWheelBackground: React.FC<RotatingWheelBackgroundProps> = ({
  isVisible,
  durationMs = 12000,
  opacity = 1,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      rotation.value = withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
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
