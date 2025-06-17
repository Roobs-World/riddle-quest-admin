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
import SolarSystem3D from "./SolarSystem3D";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Reduced star count since we now have the 3D solar system as main focus
const OPTIMIZED_STAR_COUNT = 80;

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

      // Subtle twinkling effect (reduced intensity for background stars)
      opacity.value = withRepeat(
        withSequence(
          withTiming(star.opacity * 0.4, {
            duration: 3000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 3000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );

      // Very gentle scale pulsing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, {
            duration: 4000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.9, {
            duration: 4000 + Math.random() * 2000,
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
          // Reduced glow effect since we want 3D solar system to be the focus
          shadowColor: star.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: star.size * 1.5,
          elevation: 6,
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
    zIndex: 0,
  },
  solarSystemContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1, // Above the stars
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
    zIndex: 0, // Behind the solar system
  },
});

const StarryBackground: React.FC = () => {
  // Performance tracking
  const starRefs = useRef<Set<number>>(new Set());

  // Generate background star pool with reduced intensity for background effect
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
        // Smaller stars for background effect
        size: Math.random() * 2 + 1, // 1-3px
        // Reduced opacity for background
        opacity: Math.random() * 0.3 + 0.4, // 0.4-0.7 instead of higher values
        color: starColors[Math.floor(Math.random() * starColors.length)],
        animationDuration: Math.random() * 10000 + 15000, // Slower: 15-25 seconds
        animationDelay: Math.random() * 8000, // Longer delay spread
        movementSpeed: Math.random() * 20 + 10,
        movementDirection: Math.random() * 360,
        movementRadius: Math.random() * 10 + 5, // Smaller movement radius
      });
      starRefs.current.add(i);
    }

    return generatedStars;
  }, []);

  return (
    <View style={styles.container}>
      {/* Background animated stars */}
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <AnimatedStar key={star.id} star={star} />
        ))}
      </View>

      {/* 3D Solar System */}
      <View style={styles.solarSystemContainer}>
        <SolarSystem3D />
      </View>
    </View>
  );
};

export default StarryBackground;
