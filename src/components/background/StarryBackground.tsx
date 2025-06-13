/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useEffect } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { COLORS } from "../../styles";
import ThreeDSolarSystem from "./ThreeDSolarSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Increased star count for better visibility
const OPTIMIZED_STAR_COUNT = 120;

interface Star {
  id: number;
  initialX: number;
  initialY: number;
  size: number;
  opacity: number;
  color: string;
  animationDuration: number;
  animationDelay: number;
  movementSpeed: number;
  movementDirection: number;
  movementRadius: number;
}

// Animated Star Component
const AnimatedStar: React.FC<{ star: Star }> = ({ star }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(star.opacity);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Gentle floating movement
    const moveX =
      star.movementRadius * Math.cos((star.movementDirection * Math.PI) / 180);
    const moveY =
      star.movementRadius * Math.sin((star.movementDirection * Math.PI) / 180);

    // Start movement animations with delay
    setTimeout(() => {
      translateX.value = withRepeat(
        withSequence(
          withTiming(moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(moveY * 0.5, {
            duration: star.animationDuration * 1.2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveY * 0.5, {
            duration: star.animationDuration * 1.2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      // Twinkling effect
      opacity.value = withRepeat(
        withSequence(
          withTiming(star.opacity * 0.3, {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );

      // Gentle scale pulsing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, {
            duration: 3000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.8, {
            duration: 3000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    }, star.animationDelay);
  }, [star, translateX, translateY, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.star,
        {
          position: "absolute",
          left: star.initialX,
          top: star.initialY,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
          // Enhanced glow effect
          shadowColor: star.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: star.size * 2,
          elevation: 8,
        },
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.black,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  star: {
    backgroundColor: COLORS.white,
    elevation: 5,
    position: "absolute",
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
  },
  starsContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 3,
  },
});

const StarryBackground: React.FC = () => {
  // Performance tracking
  const starRefs = useRef<Set<number>>(new Set());

  // Generate enhanced star pool with better visibility
  const stars = useMemo(() => {
    const generatedStars: Star[] = [];
    const starColors = [
      "#FFD700", // Gold
      "#FFF8DC", // Cornsilk (pale yellow)
      "#FFFF99", // Light yellow
      "#FFE135", // Bright yellow
      "#FFFACD", // Lemon chiffon
    ];

    for (let i = 0; i < OPTIMIZED_STAR_COUNT; i++) {
      generatedStars.push({
        id: i,
        initialX: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        // Increased star size for better visibility
        size: Math.random() * 4 + 2, // 2-6px instead of 1-3px
        // Increased opacity for better visibility
        opacity: Math.random() * 0.4 + 0.6, // 0.6-1.0 instead of 0.4-1.0
        color: starColors[Math.floor(Math.random() * starColors.length)],
        animationDuration: Math.random() * 3000 + 3000,
        animationDelay: Math.random() * 3000,
        movementSpeed: Math.random() * 30 + 20,
        movementDirection: Math.random() * 360,
        movementRadius: Math.random() * 20 + 10,
      });
      starRefs.current.add(i);
    }

    return generatedStars;
  }, []);

  return (
    <View style={styles.container}>
      {/* Always render the solar system - let it handle its own initialization */}
      <ThreeDSolarSystem />

      {/* Enhanced animated stars with movement */}
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <AnimatedStar key={star.id} star={star} />
        ))}
      </View>
    </View>
  );
};

export default StarryBackground;
