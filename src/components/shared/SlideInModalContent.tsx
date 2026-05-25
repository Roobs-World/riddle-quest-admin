import React, {useEffect, useState} from "react";
import {Animated, Easing, StyleProp, ViewStyle} from "react-native";
import {dimensions} from "../../utils/responsive";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";

interface SlideInModalContentProps {
  isVisible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const ENTRY_OFFSET = 72;
const ENTRY_DURATION_MS = 420;
const OFFSCREEN_TRANSLATE_Y = (dimensions?.screenHeight ?? 800) + ENTRY_OFFSET;

const SlideInModalContent: React.FC<SlideInModalContentProps> = ({isVisible, children, style}) => {
  const [translateY] = useState(() => new Animated.Value(OFFSCREEN_TRANSLATE_Y));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const toValue = isVisible ? 0 : OFFSCREEN_TRANSLATE_Y;
    const opacityTarget = isVisible ? 1 : 0;
    const easing = isVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic);

    if (isQASurfaceRuntimeActive()) {
      translateY.setValue(toValue);
      opacity.setValue(opacityTarget);
      return;
    }

    if (isVisible) {
      translateY.setValue(OFFSCREEN_TRANSLATE_Y);
      opacity.setValue(0);
    }

    const animations = [
      Animated.timing(translateY, {
        toValue,
        duration: ENTRY_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: opacityTarget,
        duration: ENTRY_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
    ];

    const startAnimations = () => {
      if (typeof Animated.parallel === "function") {
        Animated.parallel(animations).start();
        return;
      }

      animations.forEach((animation) => animation.start());
    };

    if (isVisible) {
      const animationFrame = requestAnimationFrame(startAnimations);
      return () => cancelAnimationFrame(animationFrame);
    }

    if (typeof Animated.parallel === "function") {
      Animated.parallel(animations).start();
      return;
    }

    animations.forEach((animation) => animation.start());
  }, [isVisible, opacity, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{translateY}],
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default SlideInModalContent;
