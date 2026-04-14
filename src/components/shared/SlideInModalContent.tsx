import React, { useEffect, useRef } from "react";
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

const ENTRY_OFFSET = 28;
const ENTRY_DURATION_MS = 220;

const SlideInModalContent: React.FC<SlideInModalContentProps> = ({
  isVisible,
  children,
  style,
}) => {
  const translateY = useRef(new Animated.Value(ENTRY_OFFSET)).current;

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
