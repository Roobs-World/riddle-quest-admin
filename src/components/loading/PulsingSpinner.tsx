/**
 * @fileoverview PulsingSpinner component - loading indicator with pulsing dot animation.
 */

import React, {useEffect, useMemo, useState} from "react";
import {Animated, Easing, Modal, StyleSheet, View} from "react-native";
import {styles, COLORS} from "../../styles";
import {AppStrings} from "../../constants/AppStrings";
import SlideInModalContent from "../shared/SlideInModalContent";
import {isQASurfaceRuntimeActive} from "../../qa/qaRuntime";

interface PulsingSpinnerProps {
  size?: number;
  dotCount?: number;
  dotRadius?: number;
  duration?: number;
  visible?: boolean;
  opacity?: number;
}

const localStyles = StyleSheet.create({
  dot: {
    position: "absolute",
  },
});

const PulsingSpinner = React.memo(function PulsingSpinner({
  size = 200,
  dotCount = 8,
  dotRadius = 15,
  duration = 1000,
  visible,
  opacity = 0.5,
}: PulsingSpinnerProps) {
  const [animValues] = useState(() => Array.from({length: dotCount}, () => new Animated.Value(0)));

  const calculations = useMemo(() => {
    const center = size / 2;
    const ringRadius = center - dotRadius;
    const dotPositions = Array.from({length: dotCount}, (_, i) => {
      const angle = (2 * Math.PI * i) / dotCount - Math.PI / 2;
      return {
        left: center + ringRadius * Math.cos(angle) - dotRadius,
        top: center + ringRadius * Math.sin(angle) - dotRadius,
      };
    });

    return {dotPositions};
  }, [size, dotCount, dotRadius]);

  const interpolatedValues = useMemo(
    () =>
      animValues.map((val) => ({
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.5],
        }),
        opacity: val.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.2],
        }),
      })),
    [animValues],
  );
  const shouldAnimate = visible !== false && !isQASurfaceRuntimeActive();

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    const dotAnimationDuration = (duration * 2) / dotCount;
    const staggerDelay = duration / dotCount;

    const pulseSequences = animValues.map((val) =>
      Animated.sequence([
        Animated.timing(val, {
          toValue: 1,
          duration: dotAnimationDuration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const totalPulseTime = staggerDelay * (dotCount - 1) + dotAnimationDuration;
    const tailDelay = Math.max(0, duration - totalPulseTime);

    const loopAnimation = Animated.loop(
      Animated.sequence([Animated.stagger(staggerDelay, pulseSequences), Animated.delay(tailDelay)]),
    );

    loopAnimation.start();
    return () => loopAnimation.stop();
  }, [animValues, duration, dotCount, shouldAnimate]);

  const spinnerContent = useMemo(
    () => (
      <View
        style={[
          styles.spinnerContainer,
          {
            width: size,
            height: size,
            minWidth: size,
            minHeight: size,
            maxWidth: size,
            maxHeight: size,
          },
        ]}
        accessibilityLabel={AppStrings.Accessibility.LOADING}
        accessibilityRole="progressbar"
      >
        <View testID="spinner-ring" style={[styles.svgContainer, {width: size, height: size}]}>
          {calculations.dotPositions.map((position, i) => (
            <Animated.View
              key={i}
              testID="spinner-dot"
              style={[
                localStyles.dot,
                {
                  width: dotRadius * 2,
                  height: dotRadius * 2,
                  borderRadius: dotRadius,
                  backgroundColor: COLORS.primaryOrangeLight,
                  left: position.left,
                  top: position.top,
                  opacity: interpolatedValues[i].opacity,
                  transform: [{scale: interpolatedValues[i].scale}],
                },
              ]}
            />
          ))}
        </View>
      </View>
    ),
    [size, calculations.dotPositions, dotRadius, interpolatedValues],
  );

  if (visible !== undefined) {
    if (!visible) {
      return null;
    }

    return (
      <Modal
        transparent={true}
        visible={visible}
        animationType="none"
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
        hardwareAccelerated={true}
      >
        <View
          style={[
            styles.spinnerWrapper,
            {
              backgroundColor: `rgba(0, 0, 0, ${opacity})`,
            },
          ]}
        >
          <SlideInModalContent isVisible={visible}>{spinnerContent}</SlideInModalContent>
        </View>
      </Modal>
    );
  }

  return spinnerContent;
});

export default PulsingSpinner;
