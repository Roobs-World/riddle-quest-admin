import React, { useRef, useEffect } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

// Turn the SVG <Circle> into an Animated component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PulsingSpinner({
  size = 200, // overall spinner size
  dotCount = 8, // number of dots around the ring
  dotRadius = 30, // base radius of each dot
  duration = 1000, // total loop time (ms)
  color = "#555",
}) {
  // create one Animated.Value per dot
  const animValues = useRef(
    Array.from({ length: dotCount }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // slow individual pulses by doubling their duration
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

  const center = size / 2;
  const ringRadius = center - dotRadius;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {animValues.map((val, i) => {
          const angle = (2 * Math.PI * i) / dotCount - Math.PI / 2;
          const cx = center + ringRadius * Math.cos(angle);
          const cy = center + ringRadius * Math.sin(angle);

          // radius interpolates from full → half
          const radius = val.interpolate({
            inputRange: [0, 1],
            outputRange: [dotRadius, dotRadius * 0.5],
          });
          // opacity interpolates from full → faint
          const opacity = val.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.2],
          });

          return (
            <AnimatedCircle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill={color}
              opacity={opacity}
            />
          );
        })}
      </Svg>
    </View>
  );
}
