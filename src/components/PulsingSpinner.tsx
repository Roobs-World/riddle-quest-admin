import React, { useRef, useEffect, useMemo } from "react";
import {
  Animated,
  Easing,
  View,
  Modal,
  Dimensions,
  StyleSheet,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

// Turn the SVG <Circle> into an Animated component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PulsingSpinnerProps {
  size?: number; // overall spinner size
  dotCount?: number; // number of dots around the ring
  dotRadius?: number; // base radius of each dot
  duration?: number; // total loop time (ms)
  // Overlay props
  visible?: boolean; // whether to show as overlay
  opacity?: number; // overlay opacity
}

const PulsingSpinner = React.memo(function PulsingSpinner({
  size = 200, // overall spinner size
  dotCount = 8, // number of dots around the ring
  dotRadius = 15, // base radius of each dot
  duration = 1000, // total loop time (ms)
  // Overlay defaults
  visible,
  opacity = 0.5,
}: PulsingSpinnerProps) {
  // Create stable animated values that don't change between renders
  const animValues = useRef(
    Array.from({ length: dotCount }, () => new Animated.Value(0))
  ).current;

  // Memoize expensive calculations to prevent recalculation on every render
  const calculations = useMemo(() => {
    const center = size / 2;
    const ringRadius = center - dotRadius;

    // Pre-calculate all dot positions to avoid recalculation during render
    const dotPositions = Array.from({ length: dotCount }, (_, i) => {
      const angle = (2 * Math.PI * i) / dotCount - Math.PI / 2;
      return {
        cx: center + ringRadius * Math.cos(angle),
        cy: center + ringRadius * Math.sin(angle),
      };
    });

    return { center, ringRadius, dotPositions };
  }, [size, dotCount, dotRadius]);

  // Memoize interpolated values to prevent recreation on every render
  const interpolatedValues = useMemo(() => {
    return animValues.map((val) => ({
      radius: val.interpolate({
        inputRange: [0, 1],
        outputRange: [dotRadius, dotRadius * 0.5],
      }),
      opacity: val.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.2],
      }),
    }));
  }, [animValues, dotRadius]);

  useEffect(() => {
    // Only recreate animation if dependencies actually change
    const dotAnimationDuration = (duration * 2) / dotCount;
    const staggerDelay = duration / dotCount;

    // build per-dot pulse: grow then reset
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
      ])
    );

    // calculate tail gap so total loop = duration
    const totalPulseTime = staggerDelay * (dotCount - 1) + dotAnimationDuration;
    const tailDelay = Math.max(0, duration - totalPulseTime);

    // single loop: stagger pulses then wait tailDelay
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.stagger(staggerDelay, pulseSequences),
        Animated.delay(tailDelay),
      ])
    );

    loopAnimation.start();
    return () => loopAnimation.stop();
  }, [animValues, duration, dotCount]);

  // Memoize spinner content to prevent recreation unless dependencies change
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
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={[styles.svgContainer, { width: size, height: size }]}
        >
          {calculations.dotPositions.map((position, i) => (
            <AnimatedCircle
              key={i}
              cx={position.cx}
              cy={position.cy}
              r={interpolatedValues[i].radius}
              fill="#FEC880"
              opacity={interpolatedValues[i].opacity}
            />
          ))}
        </Svg>
      </View>
    ),
    [size, calculations.dotPositions, interpolatedValues]
  );

  // Memoize screen dimensions to prevent recalculation (always called, not conditionally)
  const screenData = useMemo(() => Dimensions.get("screen"), []);

  // If visible prop is provided, render as overlay
  if (visible !== undefined) {
    if (!visible) {
      return null;
    }

    return (
      <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View
          style={[
            styles.overlayContainer,
            {
              backgroundColor: `rgba(0, 0, 0, ${opacity})`,
              width: screenData.width,
              height: screenData.height,
            },
          ]}
        >
          {spinnerContent}
        </View>
      </Modal>
    );
  }

  // Otherwise, render as inline component
  return spinnerContent;
});

const styles = StyleSheet.create({
  overlayContainer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 9999,
  },
  spinnerContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  svgContainer: {
    position: "absolute",
  },
});

export default PulsingSpinner;
