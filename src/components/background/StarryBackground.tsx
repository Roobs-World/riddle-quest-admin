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

// Further optimized star count for better performance
const OPTIMIZED_STAR_COUNT = 60; // Reduced from 80

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

// Optimized Animated Star Component with reduced complexity
const AnimatedStar: React.FC<{ star: Star }> = React.memo(({ star }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(star.opacity);
  const scale = useSharedValue(1);

  // Memoized animation calculations
  const moveParams = useMemo(
    () => ({
      moveX:
        star.movementRadius *
        Math.cos((star.movementDirection * Math.PI) / 180),
      moveY:
        star.movementRadius *
        Math.sin((star.movementDirection * Math.PI) / 180),
    }),
    [star.movementDirection, star.movementRadius]
  );

  // Optimized animation setup
  useEffect(() => {
    // Start movement animations with delay
    const timeoutId = setTimeout(() => {
      // Simplified X movement
      translateX.value = withRepeat(
        withSequence(
          withTiming(moveParams.moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveParams.moveX, {
            duration: star.animationDuration,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      // Simplified Y movement
      translateY.value = withRepeat(
        withSequence(
          withTiming(moveParams.moveY * 0.3, {
            // Reduced movement range
            duration: star.animationDuration * 1.5,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-moveParams.moveY * 0.3, {
            duration: star.animationDuration * 1.5,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );

      // Reduced opacity animation frequency for performance
      opacity.value = withRepeat(
        withSequence(
          withTiming(star.opacity * 0.6, {
            // Less dramatic opacity changes
            duration: 4000 + Math.random() * 4000, // Longer duration
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(star.opacity, {
            duration: 4000 + Math.random() * 4000,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1,
        true
      );

      // Simplified scale animation
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            // Smaller scale changes
            duration: 6000 + Math.random() * 3000, // Longer duration
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.95, {
            duration: 6000 + Math.random() * 3000,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      );
    }, star.animationDelay);

    return () => clearTimeout(timeoutId);
  }, [star, translateX, translateY, opacity, scale, moveParams]);

  // Optimized animated style with interpolation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  }, []);

  // Memoized static styles
  const staticStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: star.initialX,
      top: star.initialY,
      width: star.size,
      height: star.size,
      borderRadius: star.size / 2,
      backgroundColor: star.color,
      // Reduced shadow effects for performance
      shadowColor: star.color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4, // Reduced from 0.6
      shadowRadius: star.size * 1.2, // Reduced from 1.5
      elevation: 3, // Reduced from 6
    }),
    [star]
  );

  return <Animated.View style={[styles.star, staticStyle, animatedStyle]} />;
});

AnimatedStar.displayName = "AnimatedStar";

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
    elevation: 3, // Reduced from 5
    position: "absolute",
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, // Reduced from 0.8
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

  // Optimized star generation with better performance characteristics
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
        // Optimized size range
        size: Math.random() * 1.5 + 1, // 1-2.5px (reduced from 1-3px)
        // Optimized opacity for better performance
        opacity: Math.random() * 0.25 + 0.45, // 0.45-0.7 (tighter range)
        color: starColors[Math.floor(Math.random() * starColors.length)],
        // Slower animations for performance
        animationDuration: Math.random() * 15000 + 20000, // 20-35 seconds (increased)
        animationDelay: Math.random() * 10000, // Longer delay spread
        movementSpeed: Math.random() * 15 + 8, // Reduced movement speed
        movementDirection: Math.random() * 360,
        movementRadius: Math.random() * 8 + 4, // Smaller movement radius (4-12px)
      });
      starRefs.current.add(i);
    }

    return generatedStars;
  }, []);

  // Memoized star components for better performance
  const starComponents = useMemo(
    () => stars.map((star) => <AnimatedStar key={star.id} star={star} />),
    [stars]
  );

  return (
    <View style={styles.container}>
      {/* Background animated stars */}
      <View style={styles.starsContainer}>{starComponents}</View>

      {/* 3D Solar System */}
      <View style={styles.solarSystemContainer}>
        <SolarSystem3D />
      </View>
    </View>
  );
};

export default React.memo(StarryBackground);
