import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from "react-native";

interface SlideInModalContentProps {
  isVisible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const ENTRY_OFFSET = 72;
const ENTRY_DURATION_MS = 320;

const SlideInModalContent: React.FC<SlideInModalContentProps> = ({
  isVisible,
  children,
  style,
}) => {
  const [translateY] = useState(() => new Animated.Value(ENTRY_OFFSET));

  useEffect(() => {
    if (!isVisible) {
      translateY.setValue(ENTRY_OFFSET);
      return;
    }

    translateY.setValue(ENTRY_OFFSET);
    Animated.timing(translateY, {
      toValue: 0,
      duration: ENTRY_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isVisible, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export default SlideInModalContent;
